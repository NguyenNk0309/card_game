import {
  IcosahedronGeometry,
  Matrix4,
  Quaternion,
  Vector3,
} from "three";

const WORLD_UP = new Vector3(0, 1, 0);
const NUMBER_UP = new Vector3(0, 0, -1);
const OPPOSITE_VALUE_PAIRS = [
  [20, 1],
  [14, 7],
  [8, 13],
  [2, 19],
  [17, 4],
  [12, 9],
  [6, 15],
  [10, 11],
  [16, 5],
  [3, 18],
];

function extractFaces() {
  const geometry = new IcosahedronGeometry(1, 0);
  const positions = geometry.getAttribute("position");
  const faces = [];
  for (let faceIndex = 0; faceIndex < 20; faceIndex += 1) {
    const vertices = [0, 1, 2].map((offset) => new Vector3().fromBufferAttribute(positions, faceIndex * 3 + offset));
    const center = vertices[0].clone().add(vertices[1]).add(vertices[2]).multiplyScalar(1 / 3);
    const normal = new Vector3().subVectors(vertices[1], vertices[0]).cross(new Vector3().subVectors(vertices[2], vertices[0])).normalize();
    if (normal.dot(center) < 0) normal.negate();
    // The first vertex provides a stable tangent used to keep every numeral upright.
    const preferredUp = vertices[0].clone().sub(center).projectOnPlane(normal).normalize();
    faces.push({ faceIndex, vertices, center, normal, preferredUp });
  }
  geometry.dispose();
  return faces;
}

function assignValues(faces) {
  const remaining = new Set(faces.map((face) => face.faceIndex));
  const values = new Map();
  let pairIndex = 0;
  while (remaining.size) {
    const faceIndex = Math.min(...remaining);
    remaining.delete(faceIndex);
    const face = faces[faceIndex];
    let oppositeIndex = -1;
    let oppositeDot = Infinity;
    for (const candidateIndex of remaining) {
      const dot = face.normal.dot(faces[candidateIndex].normal);
      if (dot < oppositeDot) {
        oppositeDot = dot;
        oppositeIndex = candidateIndex;
      }
    }
    if (oppositeIndex < 0) throw new Error("Could not pair every d20 face.");
    remaining.delete(oppositeIndex);
    const [frontValue, oppositeValue] = OPPOSITE_VALUE_PAIRS[pairIndex];
    values.set(faceIndex, frontValue);
    values.set(oppositeIndex, oppositeValue);
    pairIndex += 1;
  }
  return values;
}

function canonicalOrientation(normal, preferredUp) {
  const alignFace = new Quaternion().setFromUnitVectors(normal, WORLD_UP);
  const alignedNumberUp = preferredUp.clone().applyQuaternion(alignFace).projectOnPlane(WORLD_UP).normalize();
  const signedAngle = Math.atan2(
    WORLD_UP.dot(alignedNumberUp.clone().cross(NUMBER_UP)),
    alignedNumberUp.dot(NUMBER_UP),
  );
  const alignNumber = new Quaternion().setFromAxisAngle(WORLD_UP, signedAngle);
  return alignNumber.multiply(alignFace).normalize();
}

const BASE_FACES = extractFaces();
const FACE_VALUES = assignValues(BASE_FACES);

export const D20_FACE_DEFINITIONS = BASE_FACES.map((face) => ({
  ...face,
  value: FACE_VALUES.get(face.faceIndex),
  orientation: canonicalOrientation(face.normal, face.preferredUp),
})).sort((left, right) => left.value - right.value);

export const D20_FACE_BY_VALUE = new Map(D20_FACE_DEFINITIONS.map((face) => [face.value, face]));

export function getD20Orientation(value) {
  const face = D20_FACE_BY_VALUE.get(value);
  if (!face) throw new RangeError(`D20 result must be an integer from 1 through 20. Received ${value}.`);
  return face.orientation.clone();
}

// A regular icosahedron is unchanged by rotations that map one complete face
// frame to another. Applying this at spawn changes which numbered face follows
// an otherwise identical physical trajectory.
export function getD20FaceRemapRotation(sourceValue, destinationValue) {
  return getD20Orientation(destinationValue).invert().multiply(getD20Orientation(sourceValue)).normalize();
}

export function getUpwardD20Value(quaternion) {
  let bestFace = D20_FACE_DEFINITIONS[0];
  let bestDot = -Infinity;
  for (const face of D20_FACE_DEFINITIONS) {
    const dot = face.normal.clone().applyQuaternion(quaternion).dot(WORLD_UP);
    if (dot > bestDot) {
      bestDot = dot;
      bestFace = face;
    }
  }
  return bestFace.value;
}

export function getD20LabelQuaternion(face) {
  const zAxis = face.normal.clone();
  const yAxis = face.preferredUp.clone();
  const xAxis = yAxis.clone().cross(zAxis).normalize();
  const basis = new Matrix4().makeBasis(xAxis, yAxis, zAxis);
  return new Quaternion().setFromRotationMatrix(basis).normalize();
}

export function verifyRegularIcosahedronGeometry(tolerance = 1e-5) {
  const edgeLengths = [];
  const uniqueVertices = new Map();
  for (const face of BASE_FACES) {
    for (const vertex of face.vertices) uniqueVertices.set(vertex.toArray().map((component) => component.toFixed(6)).join("|"), vertex);
    edgeLengths.push(
      face.vertices[0].distanceTo(face.vertices[1]),
      face.vertices[1].distanceTo(face.vertices[2]),
      face.vertices[2].distanceTo(face.vertices[0]),
    );
  }
  const firstLength = edgeLengths[0];
  return {
    faceCount: BASE_FACES.length,
    vertexCount: uniqueVertices.size,
    edgeCount: new Set(BASE_FACES.flatMap((face) => {
      const keys = face.vertices.map((vertex) => vertex.toArray().map((component) => component.toFixed(6)).join("|"));
      return [[keys[0], keys[1]], [keys[1], keys[2]], [keys[2], keys[0]]].map((pair) => pair.sort().join("~"));
    })).size,
    equilateral: edgeLengths.every((length) => Math.abs(length - firstLength) <= tolerance),
  };
}
