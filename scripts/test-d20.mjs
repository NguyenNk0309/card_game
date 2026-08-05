import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import RAPIER from "@dimforge/rapier3d-compat";
import { PerspectiveCamera, Quaternion, Vector3 } from "three";
import {
  D20_FACE_DEFINITIONS,
  getD20FaceRemapRotation,
  getD20Orientation,
  getUpwardD20Value,
  verifyRegularIcosahedronGeometry,
} from "../ui/d20/D20FaceMapping.mjs";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const worldUp = new Vector3(0, 1, 0);
const readableUp = new Vector3(0, 0, -1);

const battleView = { left: 210, top: 120, width: 940, height: 260 };
const appViewport = { width: 1_366, height: 768 };
const battleCamera = new PerspectiveCamera(36, battleView.width / battleView.height, 0.1, 100);
battleCamera.position.set(0, 5, 7);
battleCamera.lookAt(0, -0.35, 0);
battleCamera.updateProjectionMatrix();
battleCamera.updateMatrixWorld();
const topLayerCamera = battleCamera.clone();
topLayerCamera.setViewOffset(
  battleView.width,
  battleView.height,
  -battleView.left,
  -battleView.top,
  appViewport.width,
  appViewport.height,
);
topLayerCamera.updateMatrixWorld();
for (const point of [new Vector3(), new Vector3(-4, 2, 0), new Vector3(3, -1, 1)]) {
  const battleProjection = point.clone().project(battleCamera);
  const topLayerProjection = point.clone().project(topLayerCamera);
  const battlePixel = new Vector3(
    battleView.left + (battleProjection.x + 1) * battleView.width / 2,
    battleView.top + (1 - battleProjection.y) * battleView.height / 2,
  );
  const topLayerPixel = new Vector3(
    (topLayerProjection.x + 1) * appViewport.width / 2,
    (1 - topLayerProjection.y) * appViewport.height / 2,
  );
  assert.ok(battlePixel.distanceTo(topLayerPixel) < 0.000_001, "the unclipped top-layer camera preserves the die's in-game screen position");
}

const topology = verifyRegularIcosahedronGeometry();
assert.deepEqual(topology, { faceCount: 20, vertexCount: 12, edgeCount: 30, equilateral: true }, "the base die is a mathematically regular icosahedron");

const values = D20_FACE_DEFINITIONS.map((face) => face.value);
assert.deepEqual(values, Array.from({ length: 20 }, (_, index) => index + 1), "every d20 value maps to exactly one face");
for (const face of D20_FACE_DEFINITIONS) {
  const orientation = getD20Orientation(face.value);
  assert.equal(getUpwardD20Value(orientation), face.value, `canonical orientation exposes face ${face.value}`);
  assert.ok(face.normal.clone().applyQuaternion(orientation).dot(worldUp) > 0.9995, `face ${face.value} normal aligns to world up`);
  assert.ok(face.preferredUp.clone().applyQuaternion(orientation).dot(readableUp) > 0.9995, `face ${face.value} numeral remains upright`);
  const opposite = D20_FACE_DEFINITIONS.reduce((best, candidate) => candidate.normal.dot(face.normal) < best.normal.dot(face.normal) ? candidate : best, D20_FACE_DEFINITIONS[0]);
  assert.equal(face.value + opposite.value, 21, `opposite face for ${face.value} sums to 21`);
}
for (const sourceFace of D20_FACE_DEFINITIONS) {
  for (const destinationFace of D20_FACE_DEFINITIONS) {
    const remap = getD20FaceRemapRotation(sourceFace.value, destinationFace.value);
    assert.ok(sourceFace.normal.clone().applyQuaternion(remap).dot(destinationFace.normal) > 0.9995, `face ${sourceFace.value} remaps to face ${destinationFace.value}`);
    assert.ok(sourceFace.preferredUp.clone().applyQuaternion(remap).dot(destinationFace.preferredUp) > 0.9995, `face ${sourceFace.value} keeps its complete frame when remapped to face ${destinationFace.value}`);
  }
}
assert.throws(() => getD20Orientation(0), /1 through 20/, "zero cannot select a physical face");
assert.throws(() => getD20Orientation(21), /1 through 20/, "values above 20 cannot select a physical face");

await RAPIER.init();
const physicalVertices = new Map();
for (const face of D20_FACE_DEFINITIONS) {
  for (const vertex of face.vertices) physicalVertices.set(vertex.toArray().map((component) => component.toFixed(6)).join("|"), vertex);
}
const physicalHullVertices = new Float32Array([...physicalVertices.values()].flatMap((vertex) => vertex.clone().multiplyScalar(1.3 * 0.98).toArray()));
const simulatePhysicalLanding = (initialOrientation) => {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const ground = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -1.5, 0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(8, 0.08, 5).setFriction(0.63).setRestitution(0.28), ground);
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(-5.7, 3.05, 0.15)
      .setRotation(initialOrientation)
      .setLinearDamping(0.28)
      .setAngularDamping(0.46)
      .setCcdEnabled(true)
      .setCanSleep(true),
  );
  const hull = RAPIER.ColliderDesc.convexHull(physicalHullVertices);
  assert.ok(hull, "Rapier creates the regular-icosahedron test collider");
  world.createCollider(hull.setDensity(1.3).setFriction(0.56).setRestitution(0.48), body);
  body.setLinvel({ x: 4.55, y: 1.15, z: -0.16 }, true);
  body.setAngvel({ x: 8.8, y: 6.4, z: 10.3 }, true);
  for (let step = 1; step <= 864; step += 1) {
    const elapsed = step / 120 * 1_000;
    if (elapsed >= 1_100) {
      const slowdown = Math.max(0, Math.min(1, (elapsed - 1_100) / (3_600 - 1_100)));
      body.setLinearDamping(0.28 + slowdown * 2.2);
      body.setAngularDamping(0.46 + slowdown * 3.2);
    }
    world.timestep = 1 / 120;
    world.step();
    const position = body.translation();
    const velocity = body.linvel();
    const spin = body.angvel();
    const nearGround = position.y <= -1.5 + 1.3 + 0.12;
    const atRest = body.isSleeping()
      || (nearGround && Math.hypot(velocity.x, velocity.y, velocity.z) <= 0.18 && Math.hypot(spin.x, spin.y, spin.z) <= 0.28);
    if ((elapsed >= 1_100 && atRest) || (elapsed >= 3_600 && nearGround)) break;
  }
  const rotation = body.rotation();
  const landing = new Quaternion(rotation.x, rotation.y, rotation.z, rotation.w).normalize();
  world.free();
  return landing;
};
const basePhysicalLanding = simulatePhysicalLanding(new Quaternion());
const naturalPhysicalFace = getUpwardD20Value(basePhysicalLanding);
for (const value of values) {
  const landing = simulatePhysicalLanding(getD20FaceRemapRotation(value, naturalPhysicalFace));
  assert.equal(getUpwardD20Value(landing), value, `Rapier naturally lands with final result ${value} upward`);
}

const sceneSource = read("ui/d20/D20Scene.ts");
const modelSource = read("ui/d20/D20Model.ts");
const diceSource = read("ui/d20/D20Dice.tsx");
const configSource = read("ui/d20/D20Config.ts");
const gameAppSource = read("ui/GameApp.tsx");
const diceRollerSource = read("ui/components/DiceRoller.tsx");
const globalStyles = read("app/globals.css");
const elevationMatch = configSource.match(/resultCameraElevationDegrees:\s*(\d+(?:\.\d+)?)/);
assert.ok(elevationMatch, "the result camera elevation is centralized in d20 configuration");
const cameraElevation = Number(elevationMatch[1]) * Math.PI / 180;
const resultCameraDirection = new Vector3(0, Math.sin(cameraElevation), Math.cos(cameraElevation));
for (const resultFace of D20_FACE_DEFINITIONS) {
  const orientation = getD20Orientation(resultFace.value);
  const resultAlignment = resultFace.normal.clone().applyQuaternion(orientation).dot(resultCameraDirection);
  const strongestOtherAlignment = Math.max(...D20_FACE_DEFINITIONS
    .filter((face) => face.value !== resultFace.value)
    .map((face) => face.normal.clone().applyQuaternion(orientation).dot(resultCameraDirection)));
  assert.ok(resultAlignment > strongestOtherAlignment, `result face ${resultFace.value} is the most camera-facing face`);
}
assert.match(sceneSource, /completionCalled[\s\S]*onRollComplete\(\{ \.\.\.input \}\)/, "roll completion is guarded and reports the externally supplied input");
assert.match(sceneSource, /displayResult = input\.finalResult >= 1[\s\S]*\? input\.finalResult[\s\S]*: input\.rawResult/, "the physical throw targets the already-modified final result and falls back to raw only outside d20 range");
assert.match(sceneSource, /simulateLanding\(candidate, true\)[\s\S]*getUpwardD20Value\(simulation\.finalQuaternion\) === displayResult/, "the visible trajectory is accepted only when physics lands on the final result");
assert.match(sceneSource, /trajectory\[firstIndex\][\s\S]*trajectory\[secondIndex\][\s\S]*lerpVectors[\s\S]*slerpQuaternions/, "the visible die replays interpolated Rapier trajectory frames");
assert.match(sceneSource, /physicsWorld\.free\(\)/, "every pre-simulated physics world is released");
assert.match(sceneSource, /physicsBody\.isSleeping\(\)[\s\S]*settleLinearVelocity[\s\S]*settleAngularVelocity/, "the roll waits for a physical rest condition instead of using only a fixed timer");
assert.doesNotMatch(sceneSource, /applyingBuff|applyingDebuff|settlingRaw|settlingFinal|createD20Effects/, "modifier correction phases and effects are completely removed");
assert.doesNotMatch(sceneSource, /config\.settledX|config\.settledZ/, "the scene has no scripted center destination");
assert.match(modelSource, /face\.value === highlightedValue \? 1 : 0/, "only the final-result physical face receives the result material");
assert.match(modelSource, /createNumberTexture\(highlightedValue, "result"\)/, "the final-result numeral receives its own high-contrast texture");
assert.match(modelSource, /color:\s*0xa66d18[\s\S]*bevelMaterial\.color\.set\(0x2b1306\)/, "normal faces use aged gold with dark bronze gothic bevels");
assert.match(modelSource, /isResult \? "#fff0a1" : "#d45a60"[\s\S]*isResult \? "#9a570d" : "#43040e"/, "normal numerals use dark red while the result numeral uses gold");
assert.match(modelSource, /resultFaceMaterial\.color\.set\(0x560713\)[\s\S]*resultLabelMaterial\.emissive\.set\(0x5b2a00\)/, "the completed result inverts to a dark-red face with a golden numeral");
assert.match(modelSource, /uTone:\s*\{ value: new Color\(0x650a18\)/, "the die uses blood-red shadow veins instead of the former blue resin");
assert.match(modelSource, /group\.name = "gothic-antique-gold-d20"/, "the model declares its gothic antique-gold visual identity");
assert.match(modelSource, /if \(value === 6 \|\| value === 16\)[\s\S]*context\.lineTo\([\s\S]*context\.stroke\(\)/, "6 and 16 receive a clear underline to distinguish them from 9 and 19");
assert.match(sceneSource, /if \(state === "completed"\) d20Materials\.applyResultHighlight\(\)/, "the result colors appear only after the physical roll completes");
assert.match(diceRollerSource, /<span aria-hidden="true">\?<\/span>/, "the compact dice icon always displays a question mark");
assert.doesNotMatch(diceRollerSource, /roll \?\? "\?"|D20 rolled/, "the compact dice icon never substitutes a roll value");
assert.match(gameAppSource, /displayedDiceTarget = diceSequencePending && outcome \? outcome\.target : adventure\.target/, "the old target remains visible until the current dice animation completes");
assert.match(gameAppSource, /<DiceRoller rolling=\{rolling\} target=\{displayedDiceTarget\}/, "the action check renders the animation-gated target");
assert.match(gameAppSource, /activeAutoPanel = manualPanelOpen \|\| diceSequencePending \? null/, "automatic panels are blocked until the 3D roll completes");
assert.match(gameAppSource, /showPendingWorldEventChoice = Boolean\(!diceSequencePending/, "blocking World Event panels also wait for the 3D roll");
assert.match(gameAppSource, /rollRequestPendingRef\.current[\s\S]*diceSequencePending/, "overlapping local rolls are rejected while the request or presentation is active");
assert.match(diceSource, /setPortalHost\(document\.body\)[\s\S]*createPortal\(/, "the d20 canvas is portaled above every app stacking context");
assert.match(diceSource, /viewAnchor: anchorRef\.current|const viewAnchor = anchorRef\.current[\s\S]*viewAnchor,/, "the top-layer canvas receives the existing battle-space anchor");
assert.match(sceneSource, /viewAnchor\.getBoundingClientRect\(\)[\s\S]*camera\.setViewOffset\(/, "the full-viewport render surface preserves the battle-space camera framing");
assert.match(gameAppSource, /className=\{`battle-interaction-space[\s\S]*<D20Dice/, "the d20 anchor remains mounted directly in the battle interaction space");
assert.match(gameAppSource, /!diceSequencePending && activePlayer/, "the target panel waits for the d20 roll to finish");
assert.match(globalStyles, /\.d20-roll-anchor\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?inset:\s*0;/, "the d20 portal uses the existing battle space as its geometry anchor");
assert.match(globalStyles, /\.d20-roll-overlay\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?inset:\s*0;[\s\S]*?z-index:\s*2147483647;[\s\S]*?background:\s*transparent;/, "the unclipped transparent canvas stays above every app UI layer");
assert.match(globalStyles, /\.dice-panel \.d20\s*\{[\s\S]*?color:\s*#5a0717;[\s\S]*?#f1cc70[\s\S]*?#180b03/, "the compact question-mark die matches the gothic gold-and-dark-red palette");
assert.doesNotMatch(globalStyles, /d20-roll-vignette/, "the separate-screen vignette is removed");

console.log("D20 geometry, mapping, in-game placement, sequencing, and panel-gating tests passed.");
