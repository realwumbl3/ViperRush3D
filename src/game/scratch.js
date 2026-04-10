import * as THREE from 'three';
import { HEAD_COLOR } from './config/entities.js';

export const pathEdge = new THREE.Vector3();
export const pathPos = new THREE.Vector3();
export const pathTan = new THREE.Vector3();
export const explodeWorldPos = new THREE.Vector3();
export const headBaseColor = new THREE.Color(HEAD_COLOR);
export const headBlackColor = new THREE.Color(0x000000);
export const headPulseColor = new THREE.Color(HEAD_COLOR);
export const foodArrowWorldPos = new THREE.Vector3();
export const foodArrowToFood = new THREE.Vector3();
export const foodArrowForward = new THREE.Vector3(0, 0, 1);
export const bodyRodUp = new THREE.Vector3(0, 1, 0);
export const foodEatBurstPos = new THREE.Vector3();
export const foodSpawnCandidate = new THREE.Vector3();
export const floorParallaxTarget = new THREE.Vector3();
export const floorParallaxOffset = new THREE.Vector3();
