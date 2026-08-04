import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  LinearFilter,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Points,
  PointsMaterial,
  ShaderMaterial,
  SRGBColorSpace,
  Vector3,
} from "three";
import { D20_FACE_DEFINITIONS, getD20LabelQuaternion, type D20FaceDefinition } from "./D20FaceMapping.mjs";
import type { D20Quality } from "./D20Types";

type InsetFace = {
  face: D20FaceDefinition;
  points: Vector3[];
  vertexKeys: string[];
};

const vertexKey = (vertex: Vector3) => vertex.toArray().map((component) => component.toFixed(6)).join("|");

function pushTriangle(target: number[], first: Vector3, second: Vector3, third: Vector3) {
  target.push(...first.toArray(), ...second.toArray(), ...third.toArray());
}

export function createBeveledD20Geometry(radius: number, bevelAmount: number, highlightedValue: number) {
  const facePositions: number[] = [];
  const edgePositions: number[] = [];
  const cornerPositions: number[] = [];
  const insetFaces: InsetFace[] = D20_FACE_DEFINITIONS.map((face) => {
    const center = face.center.clone().multiplyScalar(radius);
    const points = face.vertices.map((vertex) => center.clone().lerp(vertex.clone().multiplyScalar(radius), 1 - bevelAmount));
    pushTriangle(facePositions, points[0], points[1], points[2]);
    return { face, points, vertexKeys: face.vertices.map(vertexKey) };
  });

  const edges = new Map<string, Array<{ pointA: Vector3; pointB: Vector3 }>>();
  const cornerPoints = new Map<string, Vector3[]>();
  for (const inset of insetFaces) {
    inset.vertexKeys.forEach((key, index) => {
      const points = cornerPoints.get(key) ?? [];
      points.push(inset.points[index]);
      cornerPoints.set(key, points);
    });
    [[0, 1], [1, 2], [2, 0]].forEach(([start, end]) => {
      const pair = [inset.vertexKeys[start], inset.vertexKeys[end]].sort();
      const key = pair.join("~");
      const pointA = inset.vertexKeys[start] === pair[0] ? inset.points[start] : inset.points[end];
      const pointB = inset.vertexKeys[start] === pair[0] ? inset.points[end] : inset.points[start];
      const records = edges.get(key) ?? [];
      records.push({ pointA, pointB });
      edges.set(key, records);
    });
  }

  for (const records of edges.values()) {
    if (records.length !== 2) throw new Error("A regular d20 edge must belong to exactly two faces.");
    pushTriangle(edgePositions, records[0].pointA, records[0].pointB, records[1].pointB);
    pushTriangle(edgePositions, records[0].pointA, records[1].pointB, records[1].pointA);
  }

  for (const points of cornerPoints.values()) {
    if (points.length !== 5) throw new Error("A regular d20 vertex must meet exactly five faces.");
    const center = points.reduce((sum, point) => sum.add(point), new Vector3()).multiplyScalar(1 / points.length);
    const axis = center.clone().normalize();
    const tangent = new Vector3(0, 1, 0).cross(axis);
    if (tangent.lengthSq() < 1e-6) tangent.set(1, 0, 0);
    tangent.normalize();
    const bitangent = axis.clone().cross(tangent).normalize();
    const ordered = [...points].sort((left, right) => {
      const leftOffset = left.clone().sub(center);
      const rightOffset = right.clone().sub(center);
      return Math.atan2(leftOffset.dot(bitangent), leftOffset.dot(tangent)) - Math.atan2(rightOffset.dot(bitangent), rightOffset.dot(tangent));
    });
    for (let index = 1; index < ordered.length - 1; index += 1) pushTriangle(cornerPositions, ordered[0], ordered[index], ordered[index + 1]);
  }

  const positions = [...facePositions, ...edgePositions, ...cornerPositions];
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  D20_FACE_DEFINITIONS.forEach((face, faceIndex) => {
    geometry.addGroup(faceIndex * 3, 3, face.value === highlightedValue ? 1 : 0);
  });
  geometry.addGroup(facePositions.length / 3, (edgePositions.length + cornerPositions.length) / 3, 2);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.userData.regularIcosahedron = { faces: 20, vertices: 12, edges: 30, bevelAmount };
  return geometry;
}

function createNumberTexture(value: number, palette: "standard" | "result" = "standard") {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 192;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The browser could not create a d20 numeral texture.");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `900 ${value >= 10 ? 132 : 146}px Georgia, serif`;
  context.lineJoin = "round";
  const isResult = palette === "result";
  context.shadowColor = isResult ? "rgba(8, 2, 8, .98)" : "rgba(28, 12, 0, .95)";
  context.shadowBlur = 8;
  context.shadowOffsetY = 5;
  context.lineWidth = 10;
  context.strokeStyle = isResult ? "#210611" : "#4a2503";
  context.strokeText(String(value), 128, 96);
  const gold = context.createLinearGradient(0, 38, 0, 154);
  gold.addColorStop(0, isResult ? "#ffffff" : "#fff0a1");
  gold.addColorStop(0.28, isResult ? "#c9f8ff" : "#e4aa35");
  gold.addColorStop(0.62, isResult ? "#42d4ff" : "#9a570d");
  gold.addColorStop(1, isResult ? "#f1fdff" : "#f4c65d");
  context.fillStyle = gold;
  context.fillText(String(value), 128, 96);
  context.lineWidth = 2;
  context.strokeStyle = isResult ? "rgba(255, 255, 255, .96)" : "rgba(255, 242, 175, .9)";
  context.strokeText(String(value), 128, 94);
  if (value === 6 || value === 16) {
    const underlineHalfWidth = Math.min(82, Math.max(42, context.measureText(String(value)).width * 0.43));
    context.beginPath();
    context.moveTo(128 - underlineHalfWidth, 164);
    context.lineTo(128 + underlineHalfWidth, 164);
    context.lineCap = "round";
    context.lineWidth = 13;
    context.strokeStyle = isResult ? "#210611" : "#4a2503";
    context.stroke();
    context.lineWidth = 7;
    context.strokeStyle = gold;
    context.stroke();
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function createMarbleMaterial() {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    uniforms: { uTime: { value: 0 }, uTone: { value: new Color(0x20bdf2) } },
    vertexShader: `
      varying vec3 vLocal;
      void main() {
        vLocal = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vLocal;
      uniform float uTime;
      uniform vec3 uTone;
      void main() {
        float ribbonA = smoothstep(.78, .98, sin(vLocal.x * 8.0 + sin(vLocal.y * 6.0) + uTime * .18) * .5 + .5);
        float ribbonB = smoothstep(.82, .99, sin(vLocal.z * 10.0 - vLocal.y * 5.0 - uTime * .13) * .5 + .5);
        float alpha = (ribbonA * .19 + ribbonB * .14) * smoothstep(1.0, .2, length(vLocal));
        gl_FragColor = vec4(uTone, alpha);
      }
    `,
  });
}

function seededRandom(seedState: { value: number }) {
  seedState.value = (seedState.value * 1664525 + 1013904223) >>> 0;
  return seedState.value / 4294967296;
}

export function createD20Model(radius: number, bevelAmount: number, quality: D20Quality, highlightedValue: number) {
  const group = new Group();
  group.name = "manufactured-blue-resin-d20";
  const faceMaterial = new MeshPhysicalMaterial({
    color: 0x004f99,
    emissive: 0x001126,
    emissiveIntensity: 0.24,
    metalness: 0.02,
    roughness: 0.1,
    transmission: quality === "high" ? 0.58 : 0.22,
    thickness: 2.2,
    ior: 1.46,
    attenuationColor: new Color(0x003f91),
    attenuationDistance: 1.05,
    clearcoat: 1,
    clearcoatRoughness: 0.065,
    transparent: true,
    opacity: quality === "high" ? 0.965 : 0.99,
    side: DoubleSide,
  });
  const resultFaceMaterial = faceMaterial.clone();
  const bevelMaterial = faceMaterial.clone();
  bevelMaterial.color.set(0x003a77);
  bevelMaterial.roughness = 0.14;
  bevelMaterial.transmission = quality === "high" ? 0.43 : 0.12;
  const shell = new Mesh(createBeveledD20Geometry(radius, bevelAmount, highlightedValue), [faceMaterial, resultFaceMaterial, bevelMaterial]);
  shell.castShadow = true;
  shell.receiveShadow = true;
  shell.renderOrder = 2;
  group.add(shell);

  const marbleMaterial = createMarbleMaterial();
  const innerResin = new Mesh(new IcosahedronGeometry(radius * 0.82, 1), marbleMaterial);
  innerResin.scale.set(0.92, 1.04, 0.96);
  innerResin.rotation.set(0.3, -0.48, 0.18);
  innerResin.renderOrder = 1;
  group.add(innerResin);

  const glitterCount = quality === "high" ? 92 : 38;
  const glitterPositions = new Float32Array(glitterCount * 3);
  const seed = { value: 0x20d20 };
  for (let index = 0; index < glitterCount; index += 1) {
    let x = 0;
    let y = 0;
    let z = 0;
    do {
      x = seededRandom(seed) * 2 - 1;
      y = seededRandom(seed) * 2 - 1;
      z = seededRandom(seed) * 2 - 1;
    } while (x * x + y * y + z * z > 0.63);
    glitterPositions.set([x * radius, y * radius, z * radius], index * 3);
  }
  const glitterGeometry = new BufferGeometry();
  glitterGeometry.setAttribute("position", new Float32BufferAttribute(glitterPositions, 3));
  const glitter = new Points(glitterGeometry, new PointsMaterial({ color: 0xa9efff, size: quality === "high" ? 0.032 : 0.038, transparent: true, opacity: 0.46, depthTest: false, depthWrite: false, blending: AdditiveBlending }));
  glitter.renderOrder = 3;
  group.add(glitter);

  const labelGeometry = new PlaneGeometry(radius * 0.66, radius * 0.47);
  let resultLabelMaterial: MeshStandardMaterial | null = null;
  for (const face of D20_FACE_DEFINITIONS) {
    const labelMaterial = new MeshStandardMaterial({
      map: createNumberTexture(face.value),
      color: 0xffcf63,
      emissive: 0x5b2a00,
      emissiveIntensity: 0.25,
      metalness: 0.82,
      roughness: 0.23,
      transparent: true,
      alphaTest: 0.04,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
    });
    const label = new Mesh(labelGeometry, labelMaterial);
    label.name = `d20-face-${face.value}`;
    label.position.copy(face.center).multiplyScalar(radius).addScaledVector(face.normal, radius * 0.012);
    label.quaternion.copy(getD20LabelQuaternion(face));
    label.renderOrder = 4;
    group.add(label);
    if (face.value === highlightedValue) resultLabelMaterial = labelMaterial;
  }

  let resultHighlightApplied = false;
  const applyResultHighlight = () => {
    if (resultHighlightApplied || !resultLabelMaterial) return;
    resultHighlightApplied = true;
    resultFaceMaterial.color.set(0xa01838);
    resultFaceMaterial.emissive.set(0x4b020e);
    resultFaceMaterial.emissiveIntensity = 0.72;
    resultFaceMaterial.roughness = 0.16;
    resultFaceMaterial.transmission = quality === "high" ? 0.25 : 0.08;
    resultFaceMaterial.attenuationColor.set(0x7a0b25);

    const standardNumberTexture = resultLabelMaterial.map;
    resultLabelMaterial.map = createNumberTexture(highlightedValue, "result");
    resultLabelMaterial.color.set(0xffffff);
    resultLabelMaterial.emissive.set(0x087d9f);
    resultLabelMaterial.emissiveIntensity = 0.68;
    resultLabelMaterial.metalness = 0.46;
    resultLabelMaterial.roughness = 0.16;
    resultLabelMaterial.needsUpdate = true;
    standardNumberTexture?.dispose();
  };

  group.userData.d20Materials = { faceMaterial, resultFaceMaterial, bevelMaterial, marbleMaterial, resultLabelMaterial, applyResultHighlight };
  return group;
}
