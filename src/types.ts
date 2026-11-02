/**
 * Types and interfaces for Beat Piano 3D
 */

export interface NoteCubeData {
  id: string;
  lane: number; // 0, 1, 2, 3
  z: number; // position on track (spawn at -120, target at 0)
  targetZ: number; // hit line position (e.g. 0)
  colorHex: number;
  noteName: string;
  freq: number;
  hit: boolean;
  missed: boolean;
  meshIndex?: number;
}

export type HitRating = 'PERFECT' | 'GREAT' | 'GOOD' | 'MISS';

export interface HitPopup {
  id: number;
  text: string;
  rating: HitRating;
  lane: number;
  score: number;
  x: number;
  y: number;
}

export interface GameStats {
  score: number;
  combo: number;
  maxCombo: number;
  perfectCount: number;
  greatCount: number;
  goodCount: number;
  missCount: number;
  accuracy: number;
}

export interface GyroscopeState {
  supported: boolean;
  permissionGranted: boolean;
  active: boolean;
  alpha: number; // Z-axis compass [0, 360]
  beta: number;  // X-axis front/back tilt [-180, 180]
  gamma: number; // Y-axis left/right tilt [-90, 90]
  yaw: number;   // Calculated clamped yaw [-Math.PI/2, Math.PI/2]
  pitch: number; // Calculated clamped pitch
  calibratedOffset: { yaw: number; pitch: number };
}

export interface DifficultyConfig {
  name: string;
  speed: number;       // Cube units/sec (e.g. 35)
  spawnInterval: number; // ms between notes
  hitWindow: number;   // distance threshold for hit rating
}

export const LANES = [
  { id: 0, note: 'DO (C4)', key: 'D', color: '#00f0ff', hex: 0x00f0ff, freq: 261.63, x: -3.0 },
  { id: 1, note: 'MI (E4)', key: 'F', color: '#ff007f', hex: 0xff007f, freq: 329.63, x: -1.0 },
  { id: 2, note: 'SOL (G4)', key: 'J', color: '#ffe600', hex: 0xffe600, freq: 392.00, x: 1.0 },
  { id: 3, note: 'SI (B4)', key: 'K', color: '#a855f7', hex: 0xa855f7, freq: 493.88, x: 3.0 },
];
