import type { Quaternion, Vector3 } from "three";

export type D20FaceDefinition = {
  faceIndex: number;
  value: number;
  vertices: Vector3[];
  center: Vector3;
  normal: Vector3;
  preferredUp: Vector3;
  orientation: Quaternion;
};

export const D20_FACE_DEFINITIONS: D20FaceDefinition[];
export const D20_FACE_BY_VALUE: Map<number, D20FaceDefinition>;
export function getD20Orientation(value: number): Quaternion;
export function getD20FaceRemapRotation(sourceValue: number, destinationValue: number): Quaternion;
export function getUpwardD20Value(quaternion: Quaternion): number;
export function getD20LabelQuaternion(face: D20FaceDefinition): Quaternion;
export function verifyRegularIcosahedronGeometry(tolerance?: number): { faceCount: number; vertexCount: number; edgeCount: number; equilateral: boolean };
