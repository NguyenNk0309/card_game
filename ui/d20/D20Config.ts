export const DEFAULT_D20_ANIMATION_CONFIG = {
  physicsMinDurationMs: 1_100,
  physicsMaxDurationMs: 3_600,
  settleLinearVelocity: 0.18,
  settleAngularVelocity: 0.28,
  finalResultHoldMs: 1_000,
  physicsFixedStepHz: 120,
  physicsMaxCatchupSteps: 8,
  reducedMotionMultiplier: 0.56,
  radius: 1.3,
  bevelAmount: 0.055,
  groundY: -1.42,
  resultCameraElevationDegrees: 72,
  cameraTargetY: -0.35,
  screenDiameterPx: 300,
  maxPixelRatio: 1.75,
  lowQualityMaxPixelRatio: 1.15,
  glitterCount: 92,
  lowQualityGlitterCount: 38,
  faceAlignmentTolerance: 0.9995,
} as const;

export type D20AnimationConfig = typeof DEFAULT_D20_ANIMATION_CONFIG;
