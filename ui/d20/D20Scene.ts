import {
  ACESFilmicToneMapping,
  AmbientLight,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  Points,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Quaternion,
  Scene,
  ShadowMaterial,
  SpotLight,
  Vector3,
  WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { DEFAULT_D20_ANIMATION_CONFIG } from "./D20Config";
import {
  D20_FACE_DEFINITIONS,
  getD20FaceRemapRotation,
  getD20Orientation,
  getUpwardD20Value,
} from "./D20FaceMapping.mjs";
import { createD20Model } from "./D20Model";
import type { D20AnimationState, D20Quality, D20RollInput, D20RollOutput } from "./D20Types";

type SceneCallbacks = {
  onStateChange?: (state: D20AnimationState) => void;
  onRollComplete: (output: D20RollOutput) => void;
  onRollError: (error: Error) => void;
};

type SceneOptions = SceneCallbacks & {
  input: D20RollInput;
  viewAnchor: HTMLElement;
  reducedMotion: boolean;
  quality: D20Quality;
  pauseAt?: "result";
  startAt?: "result";
};

type PhysicsFrame = {
  position: Vector3;
  quaternion: Quaternion;
};

const clampProgress = (value: number) => Math.max(0, Math.min(1, value));

function disposeScene(scene: Scene) {
  scene.traverse((object) => {
    if (!(object instanceof Mesh) && !(object instanceof Points)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      const map = "map" in material ? material.map : undefined;
      if (map && typeof map === "object" && "dispose" in map) map.dispose();
      material.dispose();
    }
  });
}

export function mountD20Scene(container: HTMLElement, options: SceneOptions) {
  const { input, viewAnchor, reducedMotion, quality, pauseAt, startAt, onStateChange, onRollComplete, onRollError } = options;
  if (!Number.isInteger(input.rawResult) || input.rawResult < 1 || input.rawResult > 20) {
    const error = new RangeError(`D20 rawResult must be an integer from 1 through 20. Received ${input.rawResult}.`);
    onStateChange?.("error");
    onRollError(error);
    return () => undefined;
  }

  let disposed = false;
  let frameId = 0;
  let resizeObserver: ResizeObserver | null = null;
  let renderer: WebGLRenderer | null = null;
  let currentState: D20AnimationState = "idle";
  const setState = (state: D20AnimationState) => {
    currentState = state;
    onStateChange?.(state);
  };

  const start = async () => {
    try {
      const RAPIER = await import("@dimforge/rapier3d-compat");
      await RAPIER.init();
      if (disposed) return;

      const config = DEFAULT_D20_ANIMATION_CONFIG;
      const motionScale = reducedMotion ? config.reducedMotionMultiplier : 1;
      const displayResult = input.finalResult >= 1 && input.finalResult <= 20 && Number.isInteger(input.finalResult)
        ? input.finalResult
        : input.rawResult;
      const scene = new Scene();
      const camera = new PerspectiveCamera(36, 1, 0.1, 100);
      const cameraTarget = new Vector3(0, config.cameraTargetY, 0);
      const cameraElevation = config.resultCameraElevationDegrees * Math.PI / 180;
      const positionCamera = (aspect: number) => {
        const distance = aspect < 0.85
          ? config.cameraDistancePortrait
          : aspect < 1.2
            ? config.cameraDistanceSquare
            : config.cameraDistanceWide;
        camera.position.set(
          0,
          cameraTarget.y + Math.sin(cameraElevation) * distance,
          Math.cos(cameraElevation) * distance,
        );
        camera.lookAt(cameraTarget);
      };
      positionCamera(16 / 9);

      renderer = new WebGLRenderer({ alpha: true, antialias: quality === "high", powerPreference: "high-performance" });
      renderer.setClearColor(0x000000, 0);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = PCFSoftShadowMap;
      renderer.toneMapping = ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.02;
      renderer.outputColorSpace = "srgb";
      renderer.domElement.className = "d20-roll-canvas";
      renderer.domElement.setAttribute("aria-hidden", "true");
      container.appendChild(renderer.domElement);

      const pmrem = new PMREMGenerator(renderer);
      const roomEnvironment = new RoomEnvironment();
      const environment = pmrem.fromScene(roomEnvironment, 0.035).texture;
      disposeScene(roomEnvironment);
      scene.environment = environment;
      scene.add(new HemisphereLight(0x8bc9e7, 0x07111b, 1.55));
      scene.add(new AmbientLight(0x7895ad, 0.52));
      const keyLight = new DirectionalLight(0xffdfb5, 3.15);
      keyLight.position.set(-4.5, 7, 4.2);
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(quality === "high" ? 1536 : 768, quality === "high" ? 1536 : 768);
      keyLight.shadow.camera.left = -6;
      keyLight.shadow.camera.right = 6;
      keyLight.shadow.camera.top = 6;
      keyLight.shadow.camera.bottom = -5;
      scene.add(keyLight);
      const rimLight = new SpotLight(0x15bfff, 16, 18, 0.58, 0.75, 1.25);
      rimLight.position.set(4, 4.5, -3.5);
      rimLight.target.position.set(0, -0.3, 0);
      scene.add(rimLight, rimLight.target);

      const groundMaterial = new ShadowMaterial({ color: 0x000000, opacity: 0.34, transparent: true });
      const ground = new Mesh(new PlaneGeometry(42, 32), groundMaterial);
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = config.groundY;
      ground.receiveShadow = true;
      scene.add(ground);

      const die = createD20Model(config.radius, config.bevelAmount, quality, displayResult);
      const d20Materials = die.userData.d20Materials as {
        marbleMaterial: { uniforms: { uTime: { value: number } } };
        applyResultHighlight: () => void;
      };
      scene.add(die);

      const uniqueVertices = new Map<string, Vector3>();
      for (const face of D20_FACE_DEFINITIONS) {
        for (const vertex of face.vertices) uniqueVertices.set(vertex.toArray().map((value) => value.toFixed(6)).join("|"), vertex);
      }
      const hullVertices = new Float32Array([...uniqueVertices.values()].flatMap((vertex) => vertex.clone().multiplyScalar(config.radius * 0.98).toArray()));
      const throwDirection = Math.random() < 0.5 ? -1 : 1;
      const randomSigned = (magnitude: number) => (Math.random() * 2 - 1) * magnitude;
      const randomSpin = (minimum: number, maximum: number) => (Math.random() < 0.5 ? -1 : 1) * (minimum + Math.random() * (maximum - minimum));
      const spawn = {
        x: -throwDirection * (reducedMotion ? 3.4 : 5.7),
        y: reducedMotion ? 1.75 : 3.05,
        z: randomSigned(0.38),
      };
      const linearVelocity = {
        x: throwDirection * ((reducedMotion ? 3.9 : 4.3) + Math.random() * 0.55),
        y: reducedMotion ? 0.3 : 1 + Math.random() * 0.35,
        z: randomSigned(reducedMotion ? 0.28 : 0.7),
      };
      const angularVelocity = {
        x: randomSpin(reducedMotion ? 3.2 : 6.4, reducedMotion ? 5.2 : 10.5),
        y: randomSpin(reducedMotion ? 2.1 : 4.2, reducedMotion ? 3.4 : 7.5),
        z: randomSpin(reducedMotion ? 3.8 : 7.1, reducedMotion ? 6.1 : 11.5),
      };
      const fixedStepSeconds = 1 / config.physicsFixedStepHz;
      const fixedStepMs = fixedStepSeconds * 1_000;
      const minimumDuration = config.physicsMinDurationMs * motionScale;
      const maximumDuration = config.physicsMaxDurationMs * motionScale;

      const createPhysicsRoll = (initialOrientation: Quaternion) => {
        const physicsWorld = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
        const groundBody = physicsWorld.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, config.groundY - 0.08, 0));
        physicsWorld.createCollider(RAPIER.ColliderDesc.cuboid(8, 0.08, 5).setFriction(0.63).setRestitution(0.28), groundBody);
        const physicsBody = physicsWorld.createRigidBody(
          RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(spawn.x, spawn.y, spawn.z)
            .setRotation({ x: initialOrientation.x, y: initialOrientation.y, z: initialOrientation.z, w: initialOrientation.w })
            .setLinearDamping(0.28)
            .setAngularDamping(0.46)
            .setCcdEnabled(true)
            .setCanSleep(true),
        );
        const hull = RAPIER.ColliderDesc.convexHull(hullVertices);
        if (!hull) {
          physicsWorld.free();
          throw new Error("Rapier could not create the regular-icosahedron d20 collider.");
        }
        physicsWorld.createCollider(hull.setDensity(1.3).setFriction(0.56).setRestitution(reducedMotion ? 0.28 : 0.48), physicsBody);
        physicsBody.setLinvel(linearVelocity, true);
        physicsBody.setAngvel(angularVelocity, true);
        return { world: physicsWorld, body: physicsBody };
      };

      type PhysicsBody = ReturnType<typeof createPhysicsRoll>["body"];
      const applyPhysicalSlowdown = (physicsBody: PhysicsBody, elapsedMs: number) => {
        if (elapsedMs < minimumDuration) return;
        const slowdown = clampProgress((elapsedMs - minimumDuration) / Math.max(1, maximumDuration - minimumDuration));
        physicsBody.setLinearDamping(0.28 + slowdown * 2.2);
        physicsBody.setAngularDamping(0.46 + slowdown * 3.2);
      };
      const hasPhysicallyStopped = (physicsBody: PhysicsBody, elapsedMs: number) => {
        const position = physicsBody.translation();
        const velocity = physicsBody.linvel();
        const spin = physicsBody.angvel();
        const speed = Math.hypot(velocity.x, velocity.y, velocity.z);
        const angularSpeed = Math.hypot(spin.x, spin.y, spin.z);
        const nearGround = position.y <= config.groundY + config.radius + 0.12;
        const atRest = physicsBody.isSleeping()
          || (nearGround && speed <= config.settleLinearVelocity && angularSpeed <= config.settleAngularVelocity);
        return (elapsedMs >= minimumDuration && atRest) || (elapsedMs >= maximumDuration && nearGround);
      };
      const simulateLanding = (initialOrientation: Quaternion, captureFrames: boolean) => {
        const physics = createPhysicsRoll(initialOrientation);
        const frames: PhysicsFrame[] = [];
        let elapsedMs = 0;
        const maximumSteps = Math.ceil(maximumDuration * 2 / fixedStepMs);
        for (let step = 0; step < maximumSteps; step += 1) {
          elapsedMs += fixedStepMs;
          applyPhysicalSlowdown(physics.body, elapsedMs);
          physics.world.timestep = fixedStepSeconds;
          physics.world.step();
          const position = physics.body.translation();
          const rotation = physics.body.rotation();
          if (captureFrames) {
            frames.push({
              position: new Vector3(position.x, position.y, position.z),
              quaternion: new Quaternion(rotation.x, rotation.y, rotation.z, rotation.w).normalize(),
            });
          }
          if (hasPhysicallyStopped(physics.body, elapsedMs)) break;
        }
        const finalRotation = physics.body.rotation();
        const finalQuaternion = new Quaternion(finalRotation.x, finalRotation.y, finalRotation.z, finalRotation.w).normalize();
        physics.world.free();
        return { frames, finalQuaternion };
      };

      const baseLanding = simulateLanding(new Quaternion(), false);
      const naturalFace = getUpwardD20Value(baseLanding.finalQuaternion);
      const preferredStart = getD20FaceRemapRotation(displayResult, naturalFace);
      const candidates = [
        preferredStart,
        ...D20_FACE_DEFINITIONS
          .filter((face) => face.value !== naturalFace)
          .map((face) => getD20FaceRemapRotation(displayResult, face.value)),
      ];
      let trajectory: PhysicsFrame[] | null = null;
      for (const candidate of candidates) {
        const simulation = simulateLanding(candidate, true);
        if (getUpwardD20Value(simulation.finalQuaternion) === displayResult) {
          trajectory = simulation.frames;
          break;
        }
      }
      if (!trajectory?.length) throw new Error(`Rapier could not produce a natural landing for d20 result ${displayResult}.`);

      const inradius = D20_FACE_DEFINITIONS[0].center.length() * config.radius;
      let phaseStartedAt = performance.now();
      const playbackStartedAt = phaseStartedAt;
      let previousFrameAt = phaseStartedAt;
      let completionCalled = false;
      const enterState = (state: D20AnimationState, now: number) => {
        phaseStartedAt = now;
        if (state === "completed") d20Materials.applyResultHighlight();
        setState(state);
      };

      if (startAt === "result") {
        die.position.set(0, config.groundY + inradius + 0.018, 0);
        die.quaternion.copy(getD20Orientation(displayResult));
        enterState("completed", performance.now());
      } else {
        setState("spawning");
      }

      const tick = (now: number) => {
        if (disposed || !renderer) return;
        const deltaSeconds = Math.min(1 / 30, Math.max(1 / 240, (now - previousFrameAt) / 1_000));
        previousFrameAt = now;
        d20Materials.marbleMaterial.uniforms.uTime.value += deltaSeconds;

        if (currentState === "spawning" || currentState === "throwing") {
          const frameProgress = Math.max(0, (now - playbackStartedAt) / fixedStepMs);
          const firstIndex = Math.min(trajectory.length - 1, Math.floor(frameProgress));
          const secondIndex = Math.min(trajectory.length - 1, firstIndex + 1);
          const blend = frameProgress - Math.floor(frameProgress);
          const firstFrame = trajectory[firstIndex];
          const secondFrame = trajectory[secondIndex];
          die.position.lerpVectors(firstFrame.position, secondFrame.position, blend);
          die.quaternion.slerpQuaternions(firstFrame.quaternion, secondFrame.quaternion, blend).normalize();
          if (currentState === "spawning" && now - playbackStartedAt >= 70 * motionScale) setState("throwing");
          if (frameProgress >= trajectory.length - 1) enterState("completed", now);
        } else if (currentState === "completed" && pauseAt !== "result" && now - phaseStartedAt >= config.finalResultHoldMs * motionScale && !completionCalled) {
          completionCalled = true;
          onRollComplete({ ...input });
        }

        renderer.render(scene, camera);
        if (!completionCalled) frameId = requestAnimationFrame(tick);
      };

      const resize = () => {
        if (!renderer) return;
        const width = Math.max(1, container.clientWidth);
        const height = Math.max(1, container.clientHeight);
        const containerRect = container.getBoundingClientRect();
        const anchorRect = viewAnchor.getBoundingClientRect();
        const anchorWidth = Math.max(1, anchorRect.width);
        const anchorHeight = Math.max(1, anchorRect.height);
        positionCamera(anchorWidth / anchorHeight);
        camera.setViewOffset(
          anchorWidth,
          anchorHeight,
          -(anchorRect.left - containerRect.left),
          -(anchorRect.top - containerRect.top),
          width,
          height,
        );
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === "high" ? config.maxPixelRatio : config.lowQualityMaxPixelRatio));
        renderer.setSize(width, height, false);
      };
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(container);
      resizeObserver.observe(viewAnchor);
      window.addEventListener("scroll", resize, true);
      resize();
      frameId = requestAnimationFrame(tick);

      const cleanup = () => {
        cancelAnimationFrame(frameId);
        resizeObserver?.disconnect();
        window.removeEventListener("scroll", resize, true);
        environment.dispose();
        pmrem.dispose();
        disposeScene(scene);
        renderer?.dispose();
        renderer?.domElement.remove();
      };
      (container as HTMLElement & { __d20Cleanup?: () => void }).__d20Cleanup = cleanup;
    } catch (cause) {
      if (disposed) return;
      const error = cause instanceof Error ? cause : new Error("The 3D d20 scene could not start.");
      setState("error");
      onRollError(error);
    }
  };

  void start();
  return () => {
    disposed = true;
    cancelAnimationFrame(frameId);
    resizeObserver?.disconnect();
    const ownedContainer = container as HTMLElement & { __d20Cleanup?: () => void };
    ownedContainer.__d20Cleanup?.();
    delete ownedContainer.__d20Cleanup;
  };
}
