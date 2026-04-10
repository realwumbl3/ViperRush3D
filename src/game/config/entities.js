import * as THREE from 'three';

export const SNAKE_SURFACE_Y = 0.6;

export const HEAD_COLOR = 0x27ae60;
export const HEAD_EMISSIVE_INTENSITY = 2.5;
export const HEAD_EYE_COLOR = 0xff2a2a;

export const FOOD_ICOSAHEDRON_RADIUS = 0.5;
export const FOOD_ICOSAHEDRON_DETAIL = 0;
export const FOOD_COLOR = 0xff3131;
export const FOOD_EMISSIVE_INTENSITY = 3;
export const FOOD_SPAWN_RANGE_SCALE = 1.6;
export const FOOD_FLOAT_BASE_Y = 0.78;
export const FOOD_BOB_AMPLITUDE = 0.16;
export const FOOD_BOB_SPEED = 2.8;
export const FOOD_SPIN_Y_SPEED = 2.2;
export const FOOD_SPIN_X_SPEED = 0.7;
export const FOOD_EAT_BURST_COUNT = 48;

export const FOOD_ARROW_COLOR = 0xff2a2a;
export const FOOD_ARROW_EMISSIVE_INTENSITY = 2.7;
export const FOOD_ARROW_LENGTH = 0.9;
export const FOOD_ARROW_WIDTH = 0.22;
export const FOOD_ARROW_LINE_THICKNESS = 0.08;
export const FOOD_ARROW_CAMERA_OFFSET = new THREE.Vector3(0, 3, -5.8);

export const INITIAL_BODY_SEGMENTS = 12;
export const BODY_SEGMENT_SPACING = 2.5;
export const TRAIL_PATH_MARGIN = 8;

export const BODY_ICOSAHEDRON_RADIUS = FOOD_ICOSAHEDRON_RADIUS;
export const BODY_ICOSAHEDRON_DETAIL = FOOD_ICOSAHEDRON_DETAIL;
export const BODY_EDGE_LINE_THICKNESS = 0.07;
export const BODY_EDGE_LINE_SCALE = 1.045;
export const BODY_COLOR = 0x27ae60;

export const MIN_FOOD_DISTANCE_FROM_BODY = 3.35;
export const MIN_FOOD_DISTANCE_FROM_BODY_SQ = MIN_FOOD_DISTANCE_FROM_BODY * MIN_FOOD_DISTANCE_FROM_BODY;

export const MIN_FOOD_DISTANCE_FROM_HEAD = 30;
export const MIN_FOOD_DISTANCE_FROM_HEAD_SQ = MIN_FOOD_DISTANCE_FROM_HEAD * MIN_FOOD_DISTANCE_FROM_HEAD;

export const DIR_FORWARD = new THREE.Vector3(0, 0, -1);
export const DIR_WORLD_UP = new THREE.Vector3(0, 1, 0);
export const BOX_LOCAL_FORWARD = new THREE.Vector3(0, 0, 1);
