import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createInputController } from './input-controller.js';
import { SubtleBoostMotionBlurShader } from './shaders.js';
import { createSfx } from './sfx.js';

// ---------------------------------------------------------------------------
// Config — tweak gameplay and visuals here
// ---------------------------------------------------------------------------
const WORLD_SIZE = 40;
/** Vertical arena walls (collision bounds ±WORLD_SIZE) */
const ARENA_WALL_HEIGHT = 200;
const ARENA_WALL_OPACITY = 0.09;
const ARENA_WALL_COLOR = 0x00c8ff;
const ARENA_WALL_EDGE_WIDTH = 0.14;
/** Subtle FOV widen while LMB boosting */
const CAMERA_FOV_BOOST = 80;
const CAMERA_FOV_BOOST_LERP = 10;
/** Post-process motion blur while boosting (shader maps this to UV spread + mix) */
const BOOST_MOTION_BLUR_MAX = 0.55;
const BOOST_MOTION_BLUR_LERP = 14;
const FLOOR_GRID_EXTENT = WORLD_SIZE * 2;
const GRID_DIVISIONS = 50;

const SCENE_BACKGROUND = 0x050505;
const FOG_NEAR = 15;
const FOG_FAR = 70;

const CAMERA_FOV = 75;
const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 1000;

const AMBIENT_COLOR = 0xffffff;
const AMBIENT_INTENSITY = 0.6;
const POINT_LIGHT_COLOR = 0x00d4ff;
const POINT_LIGHT_INTENSITY = 25;
const POINT_LIGHT_DISTANCE = 60;
const POINT_LIGHT_Y = 15;

const GRID_COLOR_MAIN = 0x39ff14;
const GRID_COLOR_SUB = 0x222222;
const FLOOR_COLOR = 0x000000;

const SNAKE_SURFACE_Y = 0.6;

const HEAD_COLOR = 0x27ae60;
const HEAD_EMISSIVE_INTENSITY = 2.5;
const HEAD_EYE_COLOR = 0xff2a2a;

const FOOD_ICOSAHEDRON_RADIUS = 0.5;
const FOOD_ICOSAHEDRON_DETAIL = 0;
const FOOD_COLOR = 0xff3131;
const FOOD_EMISSIVE_INTENSITY = 3;
const FOOD_SPAWN_RANGE_SCALE = 1.6;
const FOOD_FLOAT_BASE_Y = 0.78;
const FOOD_BOB_AMPLITUDE = 0.16;
const FOOD_BOB_SPEED = 2.8;
const FOOD_SPIN_Y_SPEED = 2.2;
const FOOD_SPIN_X_SPEED = 0.7;
const FOOD_EAT_BURST_COUNT = 48;
const FOOD_ARROW_COLOR = 0xff2a2a;
const FOOD_ARROW_EMISSIVE_INTENSITY = 2.7;
const FOOD_ARROW_LENGTH = 0.9;
const FOOD_ARROW_WIDTH = 0.22;
const FOOD_ARROW_CAMERA_OFFSET = new THREE.Vector3(0, -2.55, -5.8);

const INITIAL_BODY_SEGMENTS = 12;
const BODY_SEGMENT_SPACING = 2.5;
/** Extra path length kept past the tail so trimming never eats the real trail */
const TRAIL_PATH_MARGIN = 8;

/** Body cubes: width (X), height (Y), depth (Z); local +Z aligns with travel direction */
const BODY_BOX_WIDTH = 0.85;
const BODY_BOX_HEIGHT = 0.85;
const BODY_BOX_DEPTH = 1.0;
/** RoundedBoxGeometry: segment count per axis (higher = smoother bevel) */
const BODY_ROUND_SEGMENTS = 3;
/** Corner radius (clamped by Three.js to half the shortest edge) */
const BODY_ROUND_RADIUS = 0.14;
const BODY_COLOR = 0x27ae60;
const BODY_EMISSIVE_INTENSITY = 1.2;
const MIN_FOOD_DISTANCE_FROM_BODY = 3.35;

const MIN_FOOD_DISTANCE_FROM_HEAD = 30;

const SPEED_BASE = 0.5;
const SPEED_BOOST_STEP = 0.05;
const SPEED_BOOST_MAX = 2.5;
/** Right mouse: drop speed quickly toward this floor */
const SPEED_BRAKE_STEP = 0.2;
const SPEED_MIN = 0.06;
/** When not boosting/braking, ease back toward base speed */
const SPEED_RECOVER_STEP = 0.06;
const TIMECHILL_MAX = 1;
const TIMECHILL_DRAIN_PER_SEC = 0.62;
const TIMECHILL_RECHARGE_PER_SEC = 0.34;
const TURN_SPEED = 0.03;
const CONTROLLER_TURN_SHARPNESS = 1;
const CONTROLLER_TURN_RADIUS_SPEED_INFLUENCE = 0.35;
const CONTROLLER_TURN_SPEED_RADIUS_FACTOR = 1 / SPEED_BASE;
const TOUCH_TURN_SENSITIVITY = 1.45;
const TOUCH_TURN_DEADZONE = 0.06;
const TOUCH_SPEED_SENSITIVITY = 1.25;
const TOUCH_SPEED_DEADZONE = 0.08;
/** Mouse look range (radians per pixel); runtime value in `mouseSensitivityX` */
const MOUSE_SENSITIVITY_MIN = 0.0004;
const MOUSE_SENSITIVITY_MAX = 0.008;
const MOUSE_SENSITIVITY_STEP = 0.0003;
const DEFAULT_MOUSE_SENSITIVITY = 0.0022;
let mouseSensitivityX = DEFAULT_MOUSE_SENSITIVITY;
const MENU_MOUSE_MOVE_STEP = 28;
const FORWARD_STEP = 0.25;
const STORAGE_KEY_MOUSE_SENS = 'neonDrift_mouseSensitivity';

const EAT_DISTANCE = 1.2;
const SCORE_PER_FOOD = 10;
const HEAD_END_BONUS = 100;
const GAME_DURATION_SECONDS = 120;
const GAME_END_RESTART_COOLDOWN_MS = 3000;
const STORAGE_KEY_HIGH_SCORE = 'neonDrift_highScore';

const SELF_COLLISION_START_INDEX = 3;
const SELF_COLLISION_DISTANCE = 0.7;
const SELF_HIT_SEGMENT_LOSS = 10;
const SELF_HIT_IMMUNITY_DURATION = 1.0;
const SELF_HIT_PULSE_HZ = 9;
const SELF_HIT_PULSE_MIN = 0.45;
const SELF_HIT_PULSE_MAX = 1.9;
const SELF_HIT_TAIL_EXPLODE_STAGGER = 0.055;

const CAMERA_OFFSET_X = 0;
const CAMERA_OFFSET_Y = 6;
const CAMERA_OFFSET_Z = 14;
const CAMERA_FOLLOW_LERP = 0.12;
const MENU_IDLE_ORBIT_RADIUS = 18;
const MENU_IDLE_ORBIT_HEIGHT = 7.5;
const MENU_IDLE_ORBIT_SPEED = 0.26;
const MENU_DEMO_SPEED = 8.6;
const MENU_DEMO_BOOST_SPEED = 12.8;
const MENU_DEMO_BOOST_DOT = 0.96;
const MENU_DEMO_TURN_SPEED = 2.3;
const MENU_DEMO_INITIAL_SEGMENTS = 8;
const MENU_DEMO_MAX_SEGMENTS = 22;
const MENU_DEMO_WALL_MARGIN = 9.5;
const MENU_DEMO_BODY_AVOID_RADIUS = 6.5;

const CRASH_ANIM_DURATION = 2.85;
const CRASH_PARTICLE_COUNT = 1400;
const CRACK_GROW_DURATION = 1.28;
/** Tron-style fat lines (world units; must read thick at arena scale / camera distance) */
const CRACK_LINE_GLOW_WORLD = 1.05;
const CRACK_LINE_CORE_WORLD = 0.34;
/** Bright particles at the advancing crack tip */
const CRACK_TIP_PARTICLE_COUNT = 10;
const SNAKE_EXPLODE_STAGGER = 0.09;
const SNAKE_EXPLODE_HEAD_DELAY = 0.06;
const SNAKE_BURST_COUNT = 100;
const SNAKE_BURST_LIFE_DECAY = 0.42;
/** Floor plane Y (matches `floor` mesh); particles bounce here instead of falling through */
const PARTICLE_FLOOR_Y = 0;
const PARTICLE_BOUNCE_RESTITUTION = 0.48;
const PARTICLE_BOUNCE_FRICTION = 0.82;
const PARTICLE_BOUNCE_SLEEP_VY = 0.55;

const FLOOR_ROTATION_X = -Math.PI / 2;

/** World-space forward (−Z) and trailing direction (+Z) used for movement and body layout */
const DIR_FORWARD = new THREE.Vector3(0, 0, -1);
const DIR_WORLD_UP = new THREE.Vector3(0, 1, 0);
/** Box depth axis in local space → world tangent along the trail (head → tail) */
const BOX_LOCAL_FORWARD = new THREE.Vector3(0, 0, 1);
const _pathEdge = new THREE.Vector3();
const _pathPos = new THREE.Vector3();
const _pathTan = new THREE.Vector3();

// ---------------------------------------------------------------------------
let scene, camera, renderer, clock;
let composer;
let motionBlurPass;
let boostMotionBlurAmt = 0;
let wallEdgeMaterial;
let snakeHead, food, floor, foodArrow;
let snakeHeadCore = null;
let score = 0;
let gameActive = false;
let snakeSegments = [];
let positionHistory = [];
let inputController = null;
let input = null;
let currentRotationY = 0;
let speedMultiplier = SPEED_BASE;
let timeChillEnergy = TIMECHILL_MAX;
let gameTimeRemaining = GAME_DURATION_SECONDS;
let selfHitImmunityRemaining = 0;
let selfHitPulseTime = 0;

let crashAnimating = false;
let crashAnimTime = 0;
let crashParticleMesh = null;
let crashParticleVel = null;
let crashGroundCrackGroup = null;
let crashVerticalCrackGroup = null;
let crashVfxRoot = null;
/** Grows with main crack tip (arc-length reveal, not Y-scale) */
let crashCrackTipMesh = null;
const crashCamStart = new THREE.Vector3();
const crashCamEnd = new THREE.Vector3();
let crashTimelineDuration = CRASH_ANIM_DURATION;
let crashExplodePieceIndex = 0;
const crashSnakeBursts = [];
const _explodeWorldPos = new THREE.Vector3();
const _inTanA = new THREE.Vector3();
const _inTanB = new THREE.Vector3();
const _headBaseColor = new THREE.Color(HEAD_COLOR);
const _headPulseColor = new THREE.Color(HEAD_COLOR);
const _foodArrowWorldPos = new THREE.Vector3();
const _foodArrowToFood = new THREE.Vector3();
const _foodArrowForward = new THREE.Vector3(0, 0, 1);
const _foodEatBurstPos = new THREE.Vector3();
const _foodSpawnCandidate = new THREE.Vector3();
const MENU_SCREEN_MAIN = 'main';
const MENU_SCREEN_SETTINGS = 'settings';
const menuActions = ['pause', 'restart', 'settings', 'sfx', 'sensitivity', 'back'];
let menuIndex = 1;
let menuScreen = MENU_SCREEN_MAIN;
let menuMouseMoveCarry = 0;
let sfx = null;
let fullscreenRequestedOnce = false;
let fullscreenAttemptInFlight = false;
let gamePaused = false;
let restartCooldownUntilMs = 0;
let restartCooldownLastShownSec = -1;
let hasStartedRunOnce = false;
const tailExplosionQueue = [];

function isGameplayActive() {
    return gameActive && !gamePaused;
}

function isMenuOpen() {
    return gamePaused || (!gameActive && !crashAnimating);
}

function shouldOrbitMenuCamera() {
    return !hasStartedRunOnce && !gameActive && !gamePaused && !crashAnimating;
}

function normalizeAngleRad(a) {
    let x = a;
    while (x > Math.PI) x -= Math.PI * 2;
    while (x < -Math.PI) x += Math.PI * 2;
    return x;
}

function setSnakePoseForTrail() {
    const headFwd = DIR_FORWARD.clone().applyAxisAngle(DIR_WORLD_UP, currentRotationY);
    for (let i = 0; i < snakeSegments.length; i++) {
        const offset = (i + 1) * BODY_SEGMENT_SPACING;
        snakeSegments[i].position.copy(
            snakeHead.position.clone().addScaledVector(headFwd, -offset)
        );
    }
    positionHistory = [snakeHead.position.clone()];
    for (let i = 0; i < snakeSegments.length; i++) {
        placeBodySegmentAlongTrail(i, snakeSegments[i]);
    }
}

function clearSnakeSegments() {
    for (let i = 0; i < snakeSegments.length; i++) {
        const seg = snakeSegments[i];
        scene.remove(seg);
        if (seg.geometry) seg.geometry.dispose();
        if (seg.material) seg.material.dispose();
    }
    snakeSegments = [];
}

function resetMenuDemoSnake() {
    if (!snakeHead) return;
    snakeHead.visible = true;
    snakeHead.position.set(0, SNAKE_SURFACE_Y, 0);
    currentRotationY = Math.random() * Math.PI * 2;
    clearSnakeSegments();
    positionHistory = [];
    for (let i = 0; i < MENU_DEMO_INITIAL_SEGMENTS; i++) addSegment();
    setSnakePoseForTrail();
    spawnFood();
}

function updateMenuDemoAutoplay(delta) {
    if (!snakeHead || !food) return;

    const headPos = snakeHead.position;
    const heading = DIR_FORWARD.clone().applyAxisAngle(DIR_WORLD_UP, currentRotationY);

    const toFood = food.position.clone().sub(headPos);
    toFood.y = 0;
    if (toFood.lengthSq() < 1e-8) toFood.copy(heading);
    else toFood.normalize();

    const avoid = new THREE.Vector3();
    const wallBand = MENU_DEMO_WALL_MARGIN;
    const wallScale = 1 / wallBand;
    if (headPos.x > WORLD_SIZE - wallBand) avoid.x -= (headPos.x - (WORLD_SIZE - wallBand)) * wallScale;
    if (headPos.x < -WORLD_SIZE + wallBand) avoid.x += ((-WORLD_SIZE + wallBand) - headPos.x) * wallScale;
    if (headPos.z > WORLD_SIZE - wallBand) avoid.z -= (headPos.z - (WORLD_SIZE - wallBand)) * wallScale;
    if (headPos.z < -WORLD_SIZE + wallBand) avoid.z += ((-WORLD_SIZE + wallBand) - headPos.z) * wallScale;

    const bodyAvoidR = MENU_DEMO_BODY_AVOID_RADIUS;
    const bodyAvoidR2 = bodyAvoidR * bodyAvoidR;
    for (let i = 2; i < snakeSegments.length; i++) {
        const away = headPos.clone().sub(snakeSegments[i].position);
        away.y = 0;
        const d2 = away.lengthSq();
        if (d2 < 1e-6 || d2 > bodyAvoidR2) continue;
        const d = Math.sqrt(d2);
        const w = (bodyAvoidR - d) / bodyAvoidR;
        avoid.addScaledVector(away.multiplyScalar(1 / d), w * 1.6);
    }

    const steer = heading.clone().multiplyScalar(0.35)
        .addScaledVector(toFood, 1.15)
        .addScaledVector(avoid, 1.9);
    steer.y = 0;
    if (steer.lengthSq() < 1e-8) steer.copy(heading);
    else steer.normalize();

    const desiredYaw = Math.atan2(-steer.x, -steer.z);
    const dyaw = normalizeAngleRad(desiredYaw - currentRotationY);
    const maxTurn = MENU_DEMO_TURN_SPEED * delta;
    currentRotationY += THREE.MathUtils.clamp(dyaw, -maxTurn, maxTurn);

    const moveDir = DIR_FORWARD.clone().applyAxisAngle(DIR_WORLD_UP, currentRotationY);
    const alignDot = moveDir.dot(toFood);
    const avoidancePressure = avoid.lengthSq();
    const demoSpeed = (alignDot >= MENU_DEMO_BOOST_DOT && avoidancePressure < 0.18)
        ? MENU_DEMO_BOOST_SPEED
        : MENU_DEMO_SPEED;
    snakeHead.position.addScaledVector(moveDir, demoSpeed * delta);
    snakeHead.rotation.y = currentRotationY;

    const hp = snakeHead.position.clone();
    if (positionHistory.length > 0 && positionHistory[0].distanceToSquared(hp) < 1e-14) positionHistory[0].copy(hp);
    else positionHistory.unshift(hp);
    trimHistoryTail();
    for (let i = 0; i < snakeSegments.length; i++) placeBodySegmentAlongTrail(i, snakeSegments[i]);

    if (headPos.distanceTo(food.position) < EAT_DISTANCE) {
        food.getWorldPosition(_foodEatBurstPos);
        spawnFoodBurst(_foodEatBurstPos);
        addSegment();
        if (snakeSegments.length > MENU_DEMO_MAX_SEGMENTS) {
            const tail = snakeSegments.pop();
            if (tail) {
                scene.remove(tail);
                if (tail.geometry) tail.geometry.dispose();
                if (tail.material) tail.material.dispose();
            }
        }
        spawnFood();
    }

    if (Math.abs(headPos.x) > WORLD_SIZE || Math.abs(headPos.z) > WORLD_SIZE) {
        resetMenuDemoSnake();
        return;
    }
    for (let i = SELF_COLLISION_START_INDEX; i < snakeSegments.length; i++) {
        if (headPos.distanceTo(snakeSegments[i].position) < SELF_COLLISION_DISTANCE) {
            resetMenuDemoSnake();
            return;
        }
    }
}

function getRestartCooldownRemainingMs() {
    if (gameActive || crashAnimating) return 0;
    return Math.max(0, restartCooldownUntilMs - performance.now());
}

function isRestartOnCooldown() {
    return getRestartCooldownRemainingMs() > 0;
}

function getDefaultMainMenuAction() {
    return gameActive ? 'pause' : 'restart';
}

function setMenuScreen(screen) {
    menuScreen = screen;
    menuMouseMoveCarry = 0;
}

function getVisibleMenuActions() {
    if (menuScreen === MENU_SCREEN_SETTINGS) return ['sfx', 'sensitivity', 'back'];
    return gameActive ? ['pause', 'restart', 'settings'] : ['restart', 'settings'];
}

function normalizeMenuIndex() {
    const visible = getVisibleMenuActions();
    const currentAction = menuActions[menuIndex];
    if (visible.indexOf(currentAction) >= 0) return;
    const fallbackAction = menuScreen === MENU_SCREEN_SETTINGS ? 'sfx' : getDefaultMainMenuAction();
    menuIndex = menuActions.indexOf(fallbackAction);
}

function isMobilePhoneLike() {
    const ua = navigator.userAgent || '';
    const touchPoints = navigator.maxTouchPoints || 0;
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const hasTouchApi = ('ontouchstart' in window) || touchPoints > 0;
    return (
        /Android|iPhone|iPad|iPod|Mobile/i.test(ua) ||
        (hasTouchApi && coarse) ||
        touchPoints > 1
    );
}

function isTouchActivationEvent(e) {
    if (!e) return false;
    if (e.type === 'touchstart') return true;
    return typeof e.pointerType === 'string' && e.pointerType.toLowerCase() === 'touch';
}

function requestFullscreenOnFirstTouch(e) {
    if (fullscreenRequestedOnce) return;
    if (fullscreenAttemptInFlight) return;
    if (!isMobilePhoneLike()) return;
    if (!isTouchActivationEvent(e)) return;
    if (document.fullscreenElement || document.webkitFullscreenElement) {
        fullscreenRequestedOnce = true;
        return;
    }
    const targets = [
        document.documentElement,
        document.body,
        renderer?.domElement ?? null
    ].filter(Boolean);

    const onRequested = result => {
        if (result && typeof result.then === 'function') {
            fullscreenAttemptInFlight = true;
            result.then(() => {
                fullscreenAttemptInFlight = false;
                if (document.fullscreenElement || document.webkitFullscreenElement) {
                    fullscreenRequestedOnce = true;
                }
            }).catch(() => {
                fullscreenAttemptInFlight = false;
            });
        } else if (document.fullscreenElement || document.webkitFullscreenElement) {
            fullscreenRequestedOnce = true;
        }
    };

    for (let i = 0; i < targets.length; i++) {
        const t = targets[i];
        try {
            if (t.requestFullscreen) {
                onRequested(t.requestFullscreen());
                break;
            }
            if (t.webkitRequestFullscreen) {
                onRequested(t.webkitRequestFullscreen());
                break;
            }
        } catch (_) {
            // Keep trying fallback targets.
        }
    }
}

function smoothstep01(t) {
    const x = Math.max(0, Math.min(1, t));
    return x * x * (3 - 2 * x);
}

function getWallImpactPoint() {
    const p = snakeHead.position.clone();
    if (Math.abs(p.x) > WORLD_SIZE) p.x = Math.sign(p.x) * WORLD_SIZE;
    if (Math.abs(p.z) > WORLD_SIZE) p.z = Math.sign(p.z) * WORLD_SIZE;
    p.y = SNAKE_SURFACE_Y;
    return p;
}

/** Which arena wall was hit — crack is built in this wall’s plane (Tron-style). */
function getWallType(impact) {
    const e = 0.04;
    const px = Math.abs(impact.x - WORLD_SIZE) < e;
    const nx = Math.abs(impact.x + WORLD_SIZE) < e;
    const pz = Math.abs(impact.z - WORLD_SIZE) < e;
    const nz = Math.abs(impact.z + WORLD_SIZE) < e;
    if (px) return 'px';
    if (nx) return 'nx';
    if (pz) return 'pz';
    if (nz) return 'nz';
    return Math.abs(impact.x) > Math.abs(impact.z)
        ? (impact.x > 0 ? 'px' : 'nx')
        : (impact.z > 0 ? 'pz' : 'nz');
}

function wallInwardNormal(wallType) {
    switch (wallType) {
        case 'px': return new THREE.Vector3(-1, 0, 0);
        case 'nx': return new THREE.Vector3(1, 0, 0);
        case 'pz': return new THREE.Vector3(0, 0, -1);
        case 'nz': return new THREE.Vector3(0, 0, 1);
        default: return new THREE.Vector3(-1, 0, 0);
    }
}

/** Horizontal along wall (along) + vertical (up) from the impact anchor on the wall face */
function wallFaceOffset(wallType, along, up) {
    switch (wallType) {
        case 'px':
        case 'nx':
            return new THREE.Vector3(0, up, along);
        case 'pz':
        case 'nz':
            return new THREE.Vector3(along, up, 0);
        default:
            return new THREE.Vector3(0, up, along);
    }
}

function computeCrashCameraEnd() {
    const head = snakeHead.position;
    let maxD = 0;
    for (let i = 0; i < snakeSegments.length; i++) {
        maxD = Math.max(maxD, head.distanceTo(snakeSegments[i].position));
    }
    const dist = Math.max(22, maxD * 2.4 + 14);
    return head.clone().add(new THREE.Vector3(dist * 0.22, dist * 0.42, dist * 0.52));
}

function disposeCrashVfx() {
    while (crashSnakeBursts.length) {
        const b = crashSnakeBursts.pop();
        scene.remove(b.mesh);
        b.mesh.geometry.dispose();
        b.mesh.material.dispose();
    }
    if (!crashVfxRoot) {
        crashParticleMesh = null;
        crashParticleVel = null;
        crashGroundCrackGroup = null;
        crashVerticalCrackGroup = null;
        crashCrackTipMesh = null;
        return;
    }
    scene.remove(crashVfxRoot);
    crashVfxRoot.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
    });
    const ud = crashVfxRoot.userData;
    if (ud.fatLineMaterials) ud.fatLineMaterials.forEach(m => m.dispose());
    if (ud.pointMaterial) ud.pointMaterial.dispose();
    crashVfxRoot = null;
    crashParticleMesh = null;
    crashParticleVel = null;
    crashGroundCrackGroup = null;
    crashVerticalCrackGroup = null;
    crashCrackTipMesh = null;
}

function computeCumulativeArcLengths(points) {
    const n = points.length;
    const cum = new Array(n);
    cum[0] = 0;
    for (let i = 1; i < n; i++) {
        cum[i] = cum[i - 1] + points[i].distanceTo(points[i - 1]);
    }
    return cum;
}

/** Visible prefix of a polyline by arc length from the first vertex (crack “growing” along the path). */
function slicePolylineByArcLength(points, cum, maxArc) {
    const n = points.length;
    if (n === 0) return [];
    if (n === 1) {
        const p0 = points[0].clone();
        const p1 = p0.clone();
        p1.y += 0.008;
        return [p0, p1];
    }
    if (maxArc <= 1e-7) {
        const p0 = points[0].clone();
        const p1 = points[1].clone().lerp(points[0], 0.12);
        return [p0, p1];
    }
    const total = cum[n - 1];
    if (maxArc >= total - 1e-7) {
        const out = [];
        for (let i = 0; i < n; i++) out.push(points[i].clone());
        return out;
    }
    const out = [points[0].clone()];
    for (let i = 1; i < n; i++) {
        if (cum[i] <= maxArc) {
            out.push(points[i].clone());
        } else {
            const prev = cum[i - 1];
            const seg = cum[i] - prev;
            const t = seg > 1e-8 ? (maxArc - prev) / seg : 1;
            out.push(new THREE.Vector3().lerpVectors(points[i - 1], points[i], Math.max(0, Math.min(1, t))));
            break;
        }
    }
    if (out.length < 2) {
        const b = points[1].clone().lerp(points[0], 0.18);
        return [points[0].clone(), b];
    }
    return out;
}

function applyFatLinePositions(line, geo, points) {
    if (points.length < 2) return;
    const flat = [];
    for (let i = 0; i < points.length; i++) {
        flat.push(points[i].x, points[i].y, points[i].z);
    }
    geo.setPositions(flat);
    line.computeLineDistances();
    if (geo.computeBoundingSphere) geo.computeBoundingSphere();
}

function makeCrackLineMaterial(colorHex, opacity, linewidthWorld) {
    const mat = new LineMaterial({
        color: colorHex,
        linewidth: linewidthWorld,
        worldUnits: true,
        transparent: true,
        opacity,
        depthWrite: false,
        depthTest: false
    });
    mat.resolution.set(window.innerWidth, window.innerHeight);
    return mat;
}

function addFatLine(parent, pts, mat, fatLineMaterials) {
    const flat = [];
    for (let i = 0; i < pts.length; i++) {
        flat.push(pts[i].x, pts[i].y, pts[i].z);
    }
    const geo = new LineGeometry();
    geo.setPositions(flat);
    const line = new Line2(geo, mat);
    line.computeLineDistances();
    parent.add(line);
}

function inwardTangentBasis(inward, outTanA, outTanB) {
    const inN = inward.clone().normalize();
    outTanA.copy(new THREE.Vector3(0, 1, 0)).cross(inN);
    if (outTanA.lengthSq() < 1e-8) outTanA.set(1, 0, 0).cross(inN);
    outTanA.normalize();
    outTanB.crossVectors(inN, outTanA).normalize();
}

/** `pos` is local if `rootY` is parent world Y; world Y = pos.y + rootY */
function applyParticleGroundBounce(pos, vel, count, rootY = 0) {
    const floorY = PARTICLE_FLOOR_Y;
    const rest = PARTICLE_BOUNCE_RESTITUTION;
    const fric = PARTICLE_BOUNCE_FRICTION;
    const sleep = PARTICLE_BOUNCE_SLEEP_VY;
    for (let i = 0; i < count; i++) {
        const ix = i * 3;
        const worldY = pos[ix + 1] + rootY;
        if (worldY < floorY) {
            pos[ix + 1] = floorY - rootY;
            if (vel[ix + 1] < 0) {
                vel[ix + 1] = -vel[ix + 1] * rest;
                if (vel[ix + 1] < sleep) vel[ix + 1] = 0;
            }
            vel[ix] *= fric;
            vel[ix + 2] *= fric;
        }
    }
}

function spawnSnakeBurst(worldPos, colorHex) {
    const count = SNAKE_BURST_COUNT;
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        pos[i * 3] = worldPos.x + (Math.random() - 0.5) * 0.45;
        pos[i * 3 + 1] = worldPos.y + (Math.random() - 0.5) * 0.45;
        pos[i * 3 + 2] = worldPos.z + (Math.random() - 0.5) * 0.45;
        const s = 7 + Math.random() * 18;
        vel[i * 3] = (Math.random() - 0.5) * s;
        vel[i * 3 + 1] = 4 + Math.random() * 14;
        vel[i * 3 + 2] = (Math.random() - 0.5) * s;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
        color: colorHex,
        size: 0.12,
        transparent: true,
        opacity: 0.98,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true
    });
    const mesh = new THREE.Points(geo, mat);
    scene.add(mesh);
    crashSnakeBursts.push({ mesh, vel, count, life: 1 });
}

function spawnFoodBurst(worldPos) {
    const count = FOOD_EAT_BURST_COUNT;
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        pos[i * 3] = worldPos.x + (Math.random() - 0.5) * 0.3;
        pos[i * 3 + 1] = worldPos.y + (Math.random() - 0.5) * 0.3;
        pos[i * 3 + 2] = worldPos.z + (Math.random() - 0.5) * 0.3;
        const s = 6 + Math.random() * 10;
        vel[i * 3] = (Math.random() - 0.5) * s;
        vel[i * 3 + 1] = 3 + Math.random() * 8;
        vel[i * 3 + 2] = (Math.random() - 0.5) * s;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
        color: FOOD_COLOR,
        size: 0.1,
        transparent: true,
        opacity: 0.98,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true
    });
    const mesh = new THREE.Points(geo, mat);
    scene.add(mesh);
    crashSnakeBursts.push({ mesh, vel, count, life: 0.85 });
}

function queueTailExplosionTrail(worldPositions, colorHex = BODY_COLOR) {
    if (!worldPositions || worldPositions.length === 0) return;
    for (let i = 0; i < worldPositions.length; i++) {
        const pos = worldPositions[i];
        if (!pos) continue;
        tailExplosionQueue.push({
            worldPos: pos.clone(),
            colorHex,
            wait: tailExplosionQueue.length === 0 ? 0 : SELF_HIT_TAIL_EXPLODE_STAGGER
        });
    }
}

function updateTailExplosionTrail(delta) {
    let remaining = delta;
    while (remaining > 0 && tailExplosionQueue.length > 0) {
        const next = tailExplosionQueue[0];
        if (next.wait > remaining) {
            next.wait -= remaining;
            break;
        }
        remaining -= next.wait;
        tailExplosionQueue.shift();
        spawnSnakeBurst(next.worldPos, next.colorHex);
    }
}

function updateSnakeBursts(delta) {
    for (let j = crashSnakeBursts.length - 1; j >= 0; j--) {
        const b = crashSnakeBursts[j];
        const arr = b.mesh.geometry.attributes.position.array;
        for (let i = 0; i < b.count; i++) {
            const ix = i * 3;
            arr[ix] += b.vel[ix] * delta;
            arr[ix + 1] += b.vel[ix + 1] * delta;
            arr[ix + 2] += b.vel[ix + 2] * delta;
            b.vel[ix + 1] -= 22 * delta;
            b.vel[ix] *= 0.992;
            b.vel[ix + 2] *= 0.992;
        }
        applyParticleGroundBounce(arr, b.vel, b.count, 0);
        b.mesh.geometry.attributes.position.needsUpdate = true;
        b.life -= delta * SNAKE_BURST_LIFE_DECAY;
        b.mesh.material.opacity = Math.max(0, b.life);
        if (b.life <= 0) {
            scene.remove(b.mesh);
            b.mesh.geometry.dispose();
            b.mesh.material.dispose();
            crashSnakeBursts.splice(j, 1);
        }
    }
}

function snapCrackAlong(along) {
    return Math.round(along / 0.12) * 0.12;
}

function buildPolygonalCrackSpine(y0, height, rng) {
    const segmentCount = 8 + Math.floor(rng() * 2);
    const points = [[0, y0]];
    let along = 0;
    let drift = rng() > 0.5 ? 1 : -1;

    for (let i = 1; i <= segmentCount; i++) {
        const t = i / segmentCount;
        const up = y0 + height * t;
        const kick = (i === 1 ? 0.16 : 0.22 + rng() * 0.24) * drift;
        along = THREE.MathUtils.clamp(along + kick, -1.32, 1.32);
        if (rng() > 0.56) drift *= -1;
        if (i === segmentCount) along *= 0.86;
        points.push([snapCrackAlong(along), up]);
    }

    return points;
}

function buildPolygonalCrackBranch(startAlong, startUp, dir, rng, scale = 1) {
    const points = [[startAlong, startUp]];
    let along = startAlong;
    let up = startUp;
    let lateral = dir * (0.34 + rng() * 0.22) * scale;
    const segmentCount = 2 + Math.floor(rng() * 2);

    for (let i = 0; i < segmentCount; i++) {
        along += lateral;
        up += (0.34 + rng() * 0.34) * scale;
        points.push([snapCrackAlong(along), up]);

        if (i === 0 && rng() > 0.48) lateral *= -0.42;
        else lateral *= 0.7 + rng() * 0.12;
    }

    return points;
}

/**
 * Shared Tron crack + inward crack particles. `w(along, up)` is offset in the crack plane
 * (horizontal seam / vertical jag), `inward` is world-space direction particles shoot (into arena).
 * The wall crack is a simple angular spine with short polygonal branches that reveal as the
 * main crack front climbs upward from the impact point.
 */
function spawnCrashCrackVfx(anchor, inward, w) {
    disposeCrashVfx();

    crashVfxRoot = new THREE.Group();
    crashVfxRoot.position.copy(anchor);
    scene.add(crashVfxRoot);

    const fatLineMaterials = [];
    const crackGlow = makeCrackLineMaterial(0x00ff66, 0.68, CRACK_LINE_GLOW_WORLD);
    const crackCore = makeCrackLineMaterial(0xf2fff6, 1, CRACK_LINE_CORE_WORLD);
    const crackGlowSoft = makeCrackLineMaterial(0x00ff99, 0.52, CRACK_LINE_GLOW_WORLD * 0.9);
    const crackCoreSoft = makeCrackLineMaterial(0xc8ffee, 0.95, CRACK_LINE_CORE_WORLD * 0.88);
    fatLineMaterials.push(crackGlow, crackCore, crackGlowSoft, crackCoreSoft);
    crashVfxRoot.userData.fatLineMaterials = fatLineMaterials;

    const crackGrowables = [];
    const rng = () => Math.random();

    const addFatLineGrowable = (parent, pts, bright, meta) => {
        const flat = [];
        for (let i = 0; i < pts.length; i++) {
            flat.push(pts[i].x, pts[i].y, pts[i].z);
        }
        const glowMat = bright ? crackGlow : crackGlowSoft;
        const coreMat = bright ? crackCore : crackCoreSoft;
        const layers = [];
        for (const mat of [glowMat, coreMat]) {
            const geo = new LineGeometry();
            geo.setPositions(flat.slice());
            const line = new Line2(geo, mat);
            line.computeLineDistances();
            line.frustumCulled = false;
            line.renderOrder = 2000;
            parent.add(line);
            layers.push({ line, geo });
        }
        const cum = computeCumulativeArcLengths(pts);
        crackGrowables.push({
            layers,
            points: pts.map(p => p.clone()),
            cum,
            totalArc: cum[cum.length - 1],
            mode: meta.mode,
            isTrunk: meta.isTrunk === true,
            revealStartArc: meta.revealStartArc || 0,
            growSpeed: meta.growSpeed || 1
        });
    };

    crashGroundCrackGroup = new THREE.Group();
    crashVfxRoot.add(crashGroundCrackGroup);

    const seamHalf = 0.92;
    const seamCenter = w(0, 0.02);
    addFatLineGrowable(crashGroundCrackGroup, [seamCenter.clone(), w(-seamHalf, 0.02)], true, {
        mode: 'seam'
    });
    addFatLineGrowable(crashGroundCrackGroup, [seamCenter.clone(), w(seamHalf, 0.02)], true, {
        mode: 'seam'
    });

    crashVerticalCrackGroup = new THREE.Group();
    crashVfxRoot.add(crashVerticalCrackGroup);
    crashVerticalCrackGroup.scale.set(1, 1, 1);

    const crackHeight = 11;
    const y0 = 0.04;
    const spine2 = buildPolygonalCrackSpine(y0, crackHeight, rng);
    const trunkPts = spine2.map(([x, yy]) => w(x, yy));
    addFatLineGrowable(crashVerticalCrackGroup, trunkPts, true, { mode: 'trunk', isTrunk: true });
    const trunkCum = computeCumulativeArcLengths(trunkPts);
    const trunkTotalArc = trunkCum[trunkCum.length - 1];

    const branchSpecs = [
        { t: 0.24, dir: rng() > 0.5 ? -1 : 1, scale: 0.92, bright: false, speed: 1.12 },
        { t: 0.42, dir: rng() > 0.5 ? 1 : -1, scale: 0.8, bright: true, speed: 1.08 },
        { t: 0.6, dir: rng() > 0.5 ? -1 : 1, scale: 0.68, bright: false, speed: 1.04 },
        { t: 0.78, dir: rng() > 0.5 ? 1 : -1, scale: 0.54, bright: false, speed: 1.0 }
    ];

    for (const spec of branchSpecs) {
        const maxIdx = spine2.length - 2;
        const i0 = Math.max(1, Math.min(maxIdx, Math.round(spec.t * maxIdx)));
        const [sx, sy] = spine2[i0];
        const br2 = buildPolygonalCrackBranch(sx, sy, spec.dir, rng, spec.scale);
        const brPts = br2.map(([x, yy]) => w(x, yy));
        addFatLineGrowable(crashVerticalCrackGroup, brPts, spec.bright, {
            mode: 'branch',
            revealStartArc: trunkCum[i0],
            growSpeed: spec.speed
        });
    }

    crashVfxRoot.userData.crackGrowables = crackGrowables;
    crashVfxRoot.userData.crackTrunkTotalArc = trunkTotalArc;

    const tipPos = new Float32Array(CRACK_TIP_PARTICLE_COUNT * 3);
    for (let i = 0; i < CRACK_TIP_PARTICLE_COUNT; i++) {
        tipPos[i * 3] = trunkPts[0].x;
        tipPos[i * 3 + 1] = trunkPts[0].y;
        tipPos[i * 3 + 2] = trunkPts[0].z;
    }
    const tipGeo = new THREE.BufferGeometry();
    tipGeo.setAttribute('position', new THREE.BufferAttribute(tipPos, 3));
    const tipMat = new THREE.PointsMaterial({
        color: 0xccffee,
        size: 0.15,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true
    });
    crashCrackTipMesh = new THREE.Points(tipGeo, tipMat);
    crashVerticalCrackGroup.add(crashCrackTipMesh);

    inwardTangentBasis(inward, _inTanA, _inTanB);
    const pCount = CRASH_PARTICLE_COUNT;
    const pos = new Float32Array(pCount * 3);
    const vel = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
        const o = w((Math.random() - 0.5) * 1.4, Math.random() * 0.5);
        pos[i * 3] = o.x;
        pos[i * 3 + 1] = o.y;
        pos[i * 3 + 2] = o.z;
        const inwardSpeed = 16 + Math.random() * 28;
        const ta = (Math.random() - 0.5) * 4;
        const tb = (Math.random() - 0.5) * 4;
        const vy = (Math.random() - 0.5) * 3;
        vel[i * 3] = inward.x * inwardSpeed + _inTanA.x * ta + _inTanB.x * tb;
        vel[i * 3 + 1] = vy + 1.2 + Math.random() * 2.5;
        vel[i * 3 + 2] = inward.z * inwardSpeed + _inTanA.z * ta + _inTanB.z * tb;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pMat = new THREE.PointsMaterial({
        color: 0x00ff66,
        size: 0.09,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true
    });
    crashParticleMesh = new THREE.Points(pGeo, pMat);
    crashParticleVel = vel;
    crashVfxRoot.userData.pointMaterial = pMat;
    crashVfxRoot.add(crashParticleMesh);

    updateCrashCrackArcGrowth(0);
}

function spawnWallCrashVfx(impact) {
    const wallType = getWallType(impact);
    const inward = wallInwardNormal(wallType);
    const anchor = impact.clone().addScaledVector(inward, 0.08);
    spawnCrashCrackVfx(anchor, inward, (along, up) => wallFaceOffset(wallType, along, up));
}

/** Self-collision: no wall crack / crack particles — only staggered snake bursts + camera (via beginCrashSequence). */
function spawnSelfCollisionCrashVfx() {
    disposeCrashVfx();
}

function updateCrashCrackArcGrowth(sy) {
    const ud = crashVfxRoot?.userData;
    if (!ud?.crackGrowables?.length || ud.crackTrunkTotalArc == null) return;

    const frontArc = sy * ud.crackTrunkTotalArc;
    let mainTip = null;

    for (const st of ud.crackGrowables) {
        let visibleArc = 0;
        if (st.mode === 'seam') {
            visibleArc = sy * st.totalArc;
        } else if (st.isTrunk) {
            visibleArc = frontArc;
        } else {
            visibleArc = (frontArc - st.revealStartArc) * st.growSpeed;
            if (visibleArc <= 0) {
                for (let li = 0; li < st.layers.length; li++) {
                    st.layers[li].line.visible = false;
                }
                continue;
            }
        }

        const pts = slicePolylineByArcLength(st.points, st.cum, Math.min(st.totalArc, visibleArc));
        const vis = pts.length >= 2;
        if (vis && st.isTrunk) {
            mainTip = pts[pts.length - 1];
        }
        for (let li = 0; li < st.layers.length; li++) {
            const { line, geo } = st.layers[li];
            if (!vis) {
                line.visible = false;
            } else {
                line.visible = true;
                applyFatLinePositions(line, geo, pts);
            }
        }
    }

    if (crashCrackTipMesh) {
        if (mainTip) {
            crashCrackTipMesh.visible = true;
            const arr = crashCrackTipMesh.geometry.attributes.position.array;
            const n = CRACK_TIP_PARTICLE_COUNT;
            const flick = 0.5 + 0.5 * Math.sin(crashAnimTime * 44);
            for (let i = 0; i < n; i++) {
                const ph = (i / n) * Math.PI * 2 + crashAnimTime * 13;
                const r = 0.055 + (i % 3) * 0.018;
                arr[i * 3] = mainTip.x + Math.cos(ph) * r * 0.45;
                arr[i * 3 + 1] = mainTip.y + Math.sin(ph * 1.27) * r * 0.38;
                arr[i * 3 + 2] = mainTip.z + Math.sin(ph * 0.91) * r * 0.42;
            }
            crashCrackTipMesh.material.opacity = (0.28 + 0.62 * flick) * Math.min(1, sy * 1.15);
            crashCrackTipMesh.geometry.attributes.position.needsUpdate = true;
        } else {
            crashCrackTipMesh.visible = false;
        }
    }
}

function updateWallCrashVfx(delta) {
    crashAnimTime += delta;
    const growT = Math.min(1, crashAnimTime / CRACK_GROW_DURATION);
    const sy = smoothstep01(growT);
    if (crashVfxRoot && crashVerticalCrackGroup) {
        updateCrashCrackArcGrowth(sy);
    }

    const totalPieces = 1 + snakeSegments.length;
    while (crashExplodePieceIndex < totalPieces) {
        const tNeed = SNAKE_EXPLODE_HEAD_DELAY + crashExplodePieceIndex * SNAKE_EXPLODE_STAGGER;
        if (crashAnimTime < tNeed) break;
        if (crashExplodePieceIndex === 0) {
            snakeHead.getWorldPosition(_explodeWorldPos);
            snakeHead.visible = false;
            spawnSnakeBurst(_explodeWorldPos, HEAD_COLOR);
        } else {
            const seg = snakeSegments[crashExplodePieceIndex - 1];
            seg.getWorldPosition(_explodeWorldPos);
            seg.visible = false;
            spawnSnakeBurst(_explodeWorldPos, BODY_COLOR);
        }
        crashExplodePieceIndex++;
    }

    if (crashParticleMesh && crashParticleVel) {
        const pos = crashParticleMesh.geometry.attributes.position.array;
        const n = CRASH_PARTICLE_COUNT;
        for (let i = 0; i < n; i++) {
            const ix = i * 3;
            pos[ix] += crashParticleVel[ix] * delta;
            pos[ix + 1] += crashParticleVel[ix + 1] * delta;
            pos[ix + 2] += crashParticleVel[ix + 2] * delta;
            crashParticleVel[ix + 1] -= 22 * delta;
            crashParticleVel[ix] *= 0.992;
            crashParticleVel[ix + 2] *= 0.992;
        }
        if (crashVfxRoot) {
            applyParticleGroundBounce(pos, crashParticleVel, n, crashVfxRoot.position.y);
        }
        crashParticleMesh.geometry.attributes.position.needsUpdate = true;
    }

    const u = smoothstep01(crashAnimTime / crashTimelineDuration);
    camera.position.lerpVectors(crashCamStart, crashCamEnd, u);
    camera.lookAt(snakeHead.position);

    if (crashAnimTime >= crashTimelineDuration) {
        finishWallCrash();
    }
}

function beginCrashSequence(spawnVfx) {
    gameActive = false;
    inputController.reset();
    updatePointerHint();

    crashAnimTime = 0;
    crashExplodePieceIndex = 0;
    const n = snakeSegments.length;
    crashTimelineDuration = Math.max(
        CRASH_ANIM_DURATION,
        SNAKE_EXPLODE_HEAD_DELAY + (1 + n) * SNAKE_EXPLODE_STAGGER + 1.85
    );
    crashAnimating = true;
    crashCamStart.copy(camera.position);
    crashCamEnd.copy(computeCrashCameraEnd());
    spawnVfx();

    scene.fog.near = 6;
    scene.fog.far = 240;
}

function beginWallCrash() {
    if (sfx) sfx.crash();
    beginCrashSequence(() => spawnWallCrashVfx(getWallImpactPoint()));
}

function beginSelfCollisionCrash() {
    beginCrashSequence(() => spawnSelfCollisionCrashVfx());
}

function finishWallCrash() {
    crashAnimating = false;
    disposeCrashVfx();
    scene.fog.near = FOG_NEAR;
    scene.fog.far = FOG_FAR;
    endGame("CRASHED!");
}

function removeTailSegments(count) {
    const n = Math.max(0, Math.min(count, snakeSegments.length));
    const removedWorldPositions = [];
    for (let i = 0; i < n; i++) {
        const seg = snakeSegments.pop();
        if (!seg) continue;
        seg.getWorldPosition(_explodeWorldPos);
        removedWorldPositions.push(_explodeWorldPos.clone());
        scene.remove(seg);
        if (seg.geometry) seg.geometry.dispose();
        if (seg.material) seg.material.dispose();
    }
    queueTailExplosionTrail(removedWorldPositions, BODY_COLOR);
    updateScoreUi();
}

function beginSelfCollisionHit() {
    if (!gameActive || selfHitImmunityRemaining > 0) return;
    if (sfx) {
        if (typeof sfx.selfHit === 'function') sfx.selfHit();
        else sfx.hit();
    }
    snakeHead.getWorldPosition(_explodeWorldPos);
    spawnSnakeBurst(_explodeWorldPos, 0x111111);
    spawnSnakeBurst(_explodeWorldPos, 0x39ff14);
    removeTailSegments(SELF_HIT_SEGMENT_LOSS);
    if (snakeSegments.length <= 0) {
        beginSelfCollisionCrash();
        return;
    }
    selfHitImmunityRemaining = SELF_HIT_IMMUNITY_DURATION;
    selfHitPulseTime = 0;
}

function updateSelfHitPulse(delta) {
    const headMat = snakeHeadCore?.material;
    if (!headMat) return;
    if (selfHitImmunityRemaining > 0) {
        selfHitImmunityRemaining = Math.max(0, selfHitImmunityRemaining - delta);
        selfHitPulseTime += delta;
        const s = 0.5 + 0.5 * Math.sin(selfHitPulseTime * SELF_HIT_PULSE_HZ * Math.PI * 2);
        const mul = SELF_HIT_PULSE_MIN + (SELF_HIT_PULSE_MAX - SELF_HIT_PULSE_MIN) * s;
        const shade = 0.08 + 0.92 * s;
        _headPulseColor.copy(_headBaseColor).multiplyScalar(shade);
        headMat.color.copy(_headPulseColor);
        headMat.emissive.copy(_headPulseColor);
        headMat.emissiveIntensity = HEAD_EMISSIVE_INTENSITY * mul;
    } else {
        headMat.color.copy(_headBaseColor);
        headMat.emissive.copy(_headBaseColor);
        headMat.emissiveIntensity = HEAD_EMISSIVE_INTENSITY;
    }
}

function isPointerLocked() {
    return document.pointerLockElement === renderer.domElement;
}

function requestPointerLock() {
    if (!renderer?.domElement?.requestPointerLock) return;
    try {
        renderer.domElement.requestPointerLock();
    } catch (_) {
        // Browser may reject lock without a fresh user gesture.
    }
}

function updatePointerHint() {
    const el = document.getElementById('pointer-hint');
    if (!el) return;
    const show = gameActive && !isPointerLocked();
    el.classList.toggle('hidden', !show);
}

function updateTimeChillUi(showBar) {
    const bar = document.getElementById('timechill-bar');
    const fill = document.getElementById('timechill-fill');
    if (!bar || !fill) return;
    const t = Math.max(0, Math.min(TIMECHILL_MAX, timeChillEnergy)) / TIMECHILL_MAX;
    fill.style.transform = `scaleX(${t})`;
    bar.classList.toggle('hidden', !showBar);
}

function getHeadMultiplier() {
    return Math.max(1, snakeSegments.length);
}

function updateScoreUi() {
    const scoreEl = document.getElementById('score');
    if (scoreEl) scoreEl.innerText = score;
    const heads = getHeadMultiplier();
    const multEl = document.getElementById('score-multiplier');
    if (multEl) multEl.innerText = `x${heads}`;
}

function formatGameTime(seconds) {
    const whole = Math.max(0, Math.ceil(seconds));
    const mm = Math.floor(whole / 60);
    const ss = whole % 60;
    return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function updateTimerUi() {
    const timerEl = document.getElementById('game-timer');
    if (timerEl) timerEl.innerText = formatGameTime(gameTimeRemaining);
}

function updateTouchControlsUi() {
    const el = document.getElementById('touch-controls');
    if (!el) return;
    const show = isMobilePhoneLike();
    el.classList.toggle('inactive', !show);
}

function updateMenuUi() {
    normalizeMenuIndex();
    const pauseEl = document.getElementById('menu-item-pause');
    const restartEl = document.getElementById('menu-item-restart');
    const settingsEl = document.getElementById('menu-item-settings');
    const sfxEl = document.getElementById('menu-item-sfx');
    const sensitivityEl = document.getElementById('menu-item-sensitivity');
    const backEl = document.getElementById('menu-item-back');
    const menuEl = document.getElementById('menu');
    const visible = getVisibleMenuActions();
    if (menuEl) menuEl.classList.toggle('cooldown', isRestartOnCooldown());
    if (pauseEl) {
        pauseEl.textContent = gamePaused ? 'Resume' : 'Pause';
        pauseEl.classList.toggle('hidden', visible.indexOf('pause') < 0);
    }
    if (restartEl) {
        restartEl.classList.toggle('hidden', visible.indexOf('restart') < 0);
        if (gameActive) {
            restartEl.textContent = 'Restart Run';
        } else {
            const cooldownMs = getRestartCooldownRemainingMs();
            if (cooldownMs > 0) {
                const secondsLeft = Math.ceil(cooldownMs / 1000);
                restartEl.textContent = `Start Run (${secondsLeft})`;
            } else {
                restartEl.textContent = 'Start Run';
            }
        }
    }
    if (settingsEl) settingsEl.classList.toggle('hidden', visible.indexOf('settings') < 0);
    if (sfxEl) sfxEl.classList.toggle('hidden', visible.indexOf('sfx') < 0);
    if (sfxEl) sfxEl.textContent = `SFX: ${sfx && sfx.isEnabled() ? 'ON' : 'OFF'}`;
    if (sensitivityEl) sensitivityEl.classList.toggle('hidden', visible.indexOf('sensitivity') < 0);
    if (sensitivityEl) sensitivityEl.textContent = `Mouse Sensitivity: ${mouseSensitivityX.toFixed(4)}`;
    if (backEl) backEl.classList.toggle('hidden', visible.indexOf('back') < 0);

    const items = menuActions.map(action => document.getElementById(`menu-item-${action}`));
    const showHighlight = isPointerLocked();
    for (let i = 0; i < items.length; i++) {
        if (!items[i]) continue;
        const action = menuActions[i];
        items[i].classList.toggle('active', showHighlight && i === menuIndex && visible.indexOf(action) >= 0);
    }
}

function moveMenuSelection(dir) {
    if (!isMenuOpen()) return;
    if (isRestartOnCooldown()) return;
    const visible = getVisibleMenuActions();
    const currentAction = menuActions[menuIndex];
    let visibleIndex = visible.indexOf(currentAction);
    if (visibleIndex < 0) visibleIndex = 0;
    visibleIndex = (visibleIndex + dir + visible.length) % visible.length;
    menuIndex = menuActions.indexOf(visible[visibleIndex]);
    updateMenuUi();
    if (sfx) sfx.menuMove();
}

function adjustMouseSensitivity(dir) {
    const clamped = Math.max(
        MOUSE_SENSITIVITY_MIN,
        Math.min(MOUSE_SENSITIVITY_MAX, mouseSensitivityX + dir * MOUSE_SENSITIVITY_STEP)
    );
    if (Math.abs(clamped - mouseSensitivityX) < 1e-7) return;
    mouseSensitivityX = clamped;
    localStorage.setItem(STORAGE_KEY_MOUSE_SENS, String(mouseSensitivityX));
    updateMenuUi();
}

function activateMenuSelection(button = 0) {
    if (!isMenuOpen()) return;
    if (isRestartOnCooldown()) return;
    normalizeMenuIndex();
    const action = menuActions[menuIndex];
    if (action === 'pause') {
        if (!gameActive) return;
        if (sfx) sfx.menuSelect();
        togglePause();
    } else if (action === 'restart') {
        if (isRestartOnCooldown()) return;
        if (sfx) sfx.menuSelect();
        if (typeof window.startGame === 'function') window.startGame();
    } else if (action === 'settings') {
        if (sfx) sfx.menuSelect();
        setMenuScreen(MENU_SCREEN_SETTINGS);
        menuIndex = menuActions.indexOf('sfx');
        updateMenuUi();
    } else if (action === 'sfx') {
        if (sfx) sfx.menuSelect();
        sfx.setEnabled(!sfx.isEnabled());
        updateMenuUi();
    } else if (action === 'sensitivity') {
        if (sfx) sfx.menuSelect();
        adjustMouseSensitivity(button === 2 ? 1 : -1);
    } else if (action === 'back') {
        if (sfx) sfx.menuSelect();
        setMenuScreen(MENU_SCREEN_MAIN);
        menuIndex = menuActions.indexOf(getDefaultMainMenuAction());
        updateMenuUi();
    }
}

function handleMenuKeyDown(e) {
    if (sfx) sfx.unlock();
    const k = e.key;
    if ((k === ' ' || k === 'Spacebar') && crashAnimating) {
        e.preventDefault();
        finishWallCrash();
        return;
    }
    if ((k === ' ' || k === 'Spacebar') && isGameplayActive()) {
        e.preventDefault();
        togglePause();
        return;
    }
    if (!isMenuOpen()) return;
    if (k === 'ArrowUp' || k === 'w' || k === 'W') {
        e.preventDefault();
        moveMenuSelection(-1);
    } else if (k === 'ArrowDown' || k === 's' || k === 'S') {
        e.preventDefault();
        moveMenuSelection(1);
    } else if (k === 'ArrowLeft' || k === 'a' || k === 'A') {
        if (menuActions[menuIndex] !== 'sensitivity' || menuScreen !== MENU_SCREEN_SETTINGS) return;
        e.preventDefault();
        if (sfx) sfx.menuSelect();
        adjustMouseSensitivity(-1);
    } else if (k === 'ArrowRight' || k === 'd' || k === 'D') {
        if (menuActions[menuIndex] !== 'sensitivity' || menuScreen !== MENU_SCREEN_SETTINGS) return;
        e.preventDefault();
        if (sfx) sfx.menuSelect();
        adjustMouseSensitivity(1);
    } else if (k === 'Enter' || k === ' ') {
        e.preventDefault();
        activateMenuSelection();
    }
}

function onGlobalPointerMove(e) {
    if (isRestartOnCooldown()) {
        menuMouseMoveCarry = 0;
        return;
    }
    if (!isMenuOpen() || isMobilePhoneLike() || !isPointerLocked()) {
        menuMouseMoveCarry = 0;
        return;
    }
    if (typeof e.movementY !== 'number' || e.movementY === 0) return;
    menuMouseMoveCarry += e.movementY;
    while (menuMouseMoveCarry >= MENU_MOUSE_MOVE_STEP) {
        moveMenuSelection(1);
        menuMouseMoveCarry -= MENU_MOUSE_MOVE_STEP;
    }
    while (menuMouseMoveCarry <= -MENU_MOUSE_MOVE_STEP) {
        moveMenuSelection(-1);
        menuMouseMoveCarry += MENU_MOUSE_MOVE_STEP;
    }
}

function onGlobalPointerDown(e) {
    if (sfx) sfx.unlock();
    requestFullscreenOnFirstTouch(e);
    if (crashAnimating && (e.button === 0 || e.button === 2)) {
        if (e.button === 2 && e.cancelable) e.preventDefault();
        finishWallCrash();
        return;
    }
    if (!isMobilePhoneLike()) requestPointerLock();
    if (!isMenuOpen()) return;
    if (!isMobilePhoneLike() && !isPointerLocked()) return;
    if (e.button !== 0 && e.button !== 2) return;
    if (e.button === 2 && e.cancelable) e.preventDefault();
    if (e.target && typeof e.target.closest === 'function') {
        const itemEl = e.target.closest('.menu-item');
        if (itemEl) {
            const action = itemEl.getAttribute('data-menu-action');
            const idx = menuActions.indexOf(action);
            if (idx >= 0) menuIndex = idx;
            updateMenuUi();
        }
    }
    activateMenuSelection(e.button);
}

function onGlobalTouchStart(e) {
    requestFullscreenOnFirstTouch(e);
}

function onGlobalPointerLockChange() {
    updateMenuUi();
    if (!isMobilePhoneLike() && !isPointerLocked() && !gamePaused) requestPointerLock();
}

function onGlobalFullscreenChange() {
    onResize();
    updateTouchControlsUi();
}

function getSavedHighScore() {
    const raw = localStorage.getItem(STORAGE_KEY_HIGH_SCORE);
    if (raw == null) return 0;
    const val = parseInt(raw, 10);
    return Number.isFinite(val) && val > 0 ? val : 0;
}

function saveHighScoreIfNeeded(value) {
    const current = getSavedHighScore();
    const next = Math.max(current, Math.max(0, Math.floor(value)));
    if (next !== current) localStorage.setItem(STORAGE_KEY_HIGH_SCORE, String(next));
    return next;
}

function hideEndScoreUi() {
    const scoreEl = document.getElementById('final-score');
    const breakdownEl = document.getElementById('final-breakdown');
    const highEl = document.getElementById('high-score');
    if (scoreEl) scoreEl.classList.add('hidden');
    if (breakdownEl) breakdownEl.classList.add('hidden');
    if (highEl) highEl.classList.add('hidden');
    updateMenuUi();
    updateTouchControlsUi();
}

function showEndScoreUi(finalScore, heads, headBonus, baseScore) {
    const scoreEl = document.getElementById('final-score');
    const breakdownEl = document.getElementById('final-breakdown');
    const highEl = document.getElementById('high-score');
    const highScore = saveHighScoreIfNeeded(finalScore);
    if (scoreEl) {
        scoreEl.textContent = `${finalScore}`;
        scoreEl.classList.remove('hidden');
    }
    if (breakdownEl) {
        breakdownEl.textContent = `Base ${baseScore} + Heads ${heads} x ${HEAD_END_BONUS} = +${headBonus}`;
        breakdownEl.classList.remove('hidden');
    }
    if (highEl) {
        highEl.textContent = `High Score: ${highScore}`;
        highEl.classList.remove('hidden');
    }
    updateMenuUi();
    updateTouchControlsUi();
}

function initMouseSensitivitySettings() {
    const saved = localStorage.getItem(STORAGE_KEY_MOUSE_SENS);
    if (saved != null) {
        const v = parseFloat(saved);
        if (!Number.isNaN(v)) {
            mouseSensitivityX = Math.max(MOUSE_SENSITIVITY_MIN, Math.min(MOUSE_SENSITIVITY_MAX, v));
        }
    }
}

function pauseGame() {
    if (!isGameplayActive()) return;
    gamePaused = true;
    inputController.reset();
    setMenuScreen(MENU_SCREEN_MAIN);
    menuIndex = menuActions.indexOf('pause');
    const statusEl = document.getElementById('status');
    if (statusEl) statusEl.innerText = 'PAUSED';
    hideEndScoreUi();
    document.getElementById('overlay').classList.remove('hidden');
    updatePointerHint();
    updateMenuUi();
}

function resumeGame() {
    if (!gamePaused || !gameActive) return;
    gamePaused = false;
    document.getElementById('overlay').classList.add('hidden');
    if (!isMobilePhoneLike()) requestPointerLock();
    updatePointerHint();
    updateMenuUi();
}

function togglePause() {
    if (gamePaused) {
        resumeGame();
    } else if (isGameplayActive()) {
        pauseGame();
    }
}

function polylineLength(h) {
    let t = 0;
    for (let i = 0; i < h.length - 1; i++) {
        t += h[i].distanceTo(h[i + 1]);
    }
    return t;
}

/**
 * Drop oldest samples only after we have more path than the tail needs, so the body
 * always rides on the real polyline — never a fake extrapolated line.
 */
function trimHistoryTail() {
    const maxKeep = snakeSegments.length * BODY_SEGMENT_SPACING + TRAIL_PATH_MARGIN;
    while (positionHistory.length > 2) {
        if (polylineLength(positionHistory) <= maxKeep) break;
        positionHistory.pop();
    }
}


function createArenaWalls() {
    const W = WORLD_SIZE;
    const wh = ARENA_WALL_HEIGHT;
    const wallGeom = new THREE.PlaneGeometry(2 * W, wh);
    const wallMat = new THREE.MeshBasicMaterial({
        color: ARENA_WALL_COLOR,
        transparent: true,
        opacity: ARENA_WALL_OPACITY,
        depthWrite: false,
        side: THREE.FrontSide,
        fog: true
    });

    const placements = [
        [W, wh / 2, 0, -Math.PI / 2],
        [-W, wh / 2, 0, Math.PI / 2],
        [0, wh / 2, W, Math.PI],
        [0, wh / 2, -W, 0]
    ];
    for (let p = 0; p < placements.length; p++) {
        const [x, y, z, ry] = placements[p];
        const m = new THREE.Mesh(wallGeom, wallMat);
        m.position.set(x, y, z);
        m.rotation.y = ry;
        scene.add(m);
    }

    wallEdgeMaterial = new LineMaterial({
        color: 0x39ff14,
        linewidth: ARENA_WALL_EDGE_WIDTH,
        worldUnits: true,
        transparent: true,
        opacity: 1,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    wallEdgeMaterial.resolution.set(window.innerWidth, window.innerHeight);

    function addWallEdgeLoop(pts) {
        const flat = [];
        for (let i = 0; i < pts.length; i++) {
            flat.push(pts[i].x, pts[i].y, pts[i].z);
        }
        const geo = new LineGeometry();
        geo.setPositions(flat);
        const line = new Line2(geo, wallEdgeMaterial);
        line.computeLineDistances();
        scene.add(line);
    }

    addWallEdgeLoop([
        new THREE.Vector3(W, 0, -W),
        new THREE.Vector3(W, 0, W),
        new THREE.Vector3(W, wh, W),
        new THREE.Vector3(W, wh, -W),
        new THREE.Vector3(W, 0, -W)
    ]);
    addWallEdgeLoop([
        new THREE.Vector3(-W, 0, -W),
        new THREE.Vector3(-W, 0, W),
        new THREE.Vector3(-W, wh, W),
        new THREE.Vector3(-W, wh, -W),
        new THREE.Vector3(-W, 0, -W)
    ]);
    addWallEdgeLoop([
        new THREE.Vector3(-W, 0, W),
        new THREE.Vector3(W, 0, W),
        new THREE.Vector3(W, wh, W),
        new THREE.Vector3(-W, wh, W),
        new THREE.Vector3(-W, 0, W)
    ]);
    addWallEdgeLoop([
        new THREE.Vector3(-W, 0, -W),
        new THREE.Vector3(W, 0, -W),
        new THREE.Vector3(W, wh, -W),
        new THREE.Vector3(-W, wh, -W),
        new THREE.Vector3(-W, 0, -W)
    ]);
}

function setupComposer() {
    composer = new EffectComposer(renderer);
    composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    composer.addPass(new RenderPass(scene, camera));
    motionBlurPass = new ShaderPass(SubtleBoostMotionBlurShader);
    motionBlurPass.uniforms.strength.value = 0;
    composer.addPass(motionBlurPass);
    composer.addPass(new OutputPass());
}

function createFoodArrow() {
    const arrow = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
        color: FOOD_ARROW_COLOR,
        emissive: FOOD_ARROW_COLOR,
        emissiveIntensity: FOOD_ARROW_EMISSIVE_INTENSITY,
        roughness: 0.26,
        metalness: 0.2,
        wireframe: true,
        fog: false,
        depthWrite: false,
        depthTest: false
    });

    // Simple angular 5-point concept: a square pyramid arrowhead.
    const headGeo = new THREE.ConeGeometry(FOOD_ARROW_WIDTH, FOOD_ARROW_LENGTH, 4, 1);
    const head = new THREE.Mesh(headGeo, mat);
    head.rotation.x = Math.PI / 2;
    head.position.z = -FOOD_ARROW_LENGTH * 0.5;
    head.renderOrder = 1000;
    arrow.add(head);

    arrow.visible = false;
    return arrow;
}

function createSnakeHead() {
    const head = new THREE.Group();

    const coreMat = new THREE.MeshStandardMaterial({
        color: HEAD_COLOR,
        emissive: HEAD_COLOR,
        emissiveIntensity: HEAD_EMISSIVE_INTENSITY,
        flatShading: true
    });

    const skull = new THREE.Mesh(new THREE.OctahedronGeometry(0.78, 0), coreMat);
    skull.scale.set(1.0, 0.66, 1.18);
    head.add(skull);

    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.0, 6, 1), coreMat);
    snout.rotation.x = -Math.PI / 2;
    snout.position.set(0, -0.03, -0.92);
    head.add(snout);

    const eyeMat = new THREE.MeshBasicMaterial({ color: HEAD_EYE_COLOR });
    const eyeGeo = new THREE.OctahedronGeometry(0.15, 0);
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.23, 0.15, -0.78);
    head.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.23, 0.15, -0.78);
    head.add(rightEye);

    snakeHeadCore = skull;
    return head;
}

function updateFoodArrow() {
    if (!foodArrow || !food || !camera) return;
    if (!isGameplayActive()) {
        foodArrow.visible = false;
        return;
    }

    _foodArrowWorldPos.copy(FOOD_ARROW_CAMERA_OFFSET).applyQuaternion(camera.quaternion).add(camera.position);
    foodArrow.position.copy(_foodArrowWorldPos);

    _foodArrowToFood.copy(food.position).sub(_foodArrowWorldPos);
    if (_foodArrowToFood.lengthSq() < 1e-8) {
        foodArrow.visible = false;
        return;
    }

    foodArrow.quaternion.setFromUnitVectors(_foodArrowForward, _foodArrowToFood.normalize());
    foodArrow.visible = true;
}

function updateFoodVisuals(elapsedSeconds, delta) {
    if (!food) return;
    food.position.y = FOOD_FLOAT_BASE_Y + Math.sin(elapsedSeconds * FOOD_BOB_SPEED) * FOOD_BOB_AMPLITUDE;
    food.rotation.y += FOOD_SPIN_Y_SPEED * delta;
    food.rotation.x += FOOD_SPIN_X_SPEED * delta;
}

function init() {
    sfx = createSfx();
    scene = new THREE.Scene();
    scene.background = new THREE.Color(SCENE_BACKGROUND);
    scene.fog = new THREE.Fog(SCENE_BACKGROUND, FOG_NEAR, FOG_FAR);

    camera = new THREE.PerspectiveCamera(CAMERA_FOV, window.innerWidth / window.innerHeight, CAMERA_NEAR, CAMERA_FAR);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    clock = new THREE.Clock();

    // Lights
    scene.add(new THREE.AmbientLight(AMBIENT_COLOR, AMBIENT_INTENSITY));
    const pointLight = new THREE.PointLight(POINT_LIGHT_COLOR, POINT_LIGHT_INTENSITY, POINT_LIGHT_DISTANCE);
    pointLight.position.set(0, POINT_LIGHT_Y, 0);
    scene.add(pointLight);

    // Floor
    const grid = new THREE.GridHelper(FLOOR_GRID_EXTENT, GRID_DIVISIONS, GRID_COLOR_MAIN, GRID_COLOR_SUB);
    scene.add(grid);

    const floorGeo = new THREE.PlaneGeometry(FLOOR_GRID_EXTENT, FLOOR_GRID_EXTENT);
    const floorMat = new THREE.MeshStandardMaterial({ color: FLOOR_COLOR });
    floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = FLOOR_ROTATION_X;
    scene.add(floor);

    createArenaWalls();
    setupComposer();

    // Snake Head
    snakeHead = createSnakeHead();
    snakeHead.position.y = SNAKE_SURFACE_Y;
    scene.add(snakeHead);

    // Food
    const foodGeo = new THREE.IcosahedronGeometry(FOOD_ICOSAHEDRON_RADIUS, FOOD_ICOSAHEDRON_DETAIL);
    const foodMat = new THREE.MeshStandardMaterial({
        color: FOOD_COLOR,
        emissive: FOOD_COLOR,
        emissiveIntensity: FOOD_EMISSIVE_INTENSITY,
        wireframe: true,
        fog: false
    });
    const foodGlowMat = new THREE.MeshBasicMaterial({
        color: FOOD_COLOR,
        wireframe: true,
        transparent: true,
        opacity: 0.55,
        depthWrite: false
    });
    const foodCore = new THREE.Mesh(foodGeo, foodMat);
    const foodOuter = new THREE.Mesh(foodGeo, foodGlowMat);
    foodOuter.scale.setScalar(1.045);
    food = new THREE.Group();
    food.add(foodCore);
    food.add(foodOuter);
    food.position.y = FOOD_FLOAT_BASE_Y;
    scene.add(food);

    foodArrow = createFoodArrow();
    scene.add(foodArrow);

    resetMenuDemoSnake();

    inputController = createInputController({
        isGameActive: () => isGameplayActive(),
        isMobileDevice: () => isMobilePhoneLike(),
        isPointerLocked: () => isPointerLocked(),
        requestPointerLock: () => requestPointerLock(),
        touchTurnSensitivity: TOUCH_TURN_SENSITIVITY,
        touchTurnDeadzone: TOUCH_TURN_DEADZONE,
        touchSpeedSensitivity: TOUCH_SPEED_SENSITIVITY,
        touchSpeedDeadzone: TOUCH_SPEED_DEADZONE,
        onMouseTurn: movementX => {
            currentRotationY -= movementX * mouseSensitivityX;
        },
        onPointerHintChange: () => updatePointerHint(),
        isUiTargetBlocked: () => false,
        onRestartRequest: () => {
            if (!isMenuOpen()) return;
            activateMenuSelection();
        }
    });
    input = inputController.state;
    inputController.attach();

    window.addEventListener('resize', onResize);
    window.addEventListener('pointermove', onGlobalPointerMove, true);
    window.addEventListener('pointerdown', onGlobalPointerDown, true);
    window.addEventListener('touchstart', onGlobalTouchStart, { capture: true, passive: true });
    window.addEventListener('keydown', handleMenuKeyDown, true);
    document.addEventListener('pointerlockchange', onGlobalPointerLockChange);
    document.addEventListener('fullscreenchange', onGlobalFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onGlobalFullscreenChange);

    initMouseSensitivitySettings();
    updateTimeChillUi(false);
    updateTimerUi();
    hideEndScoreUi();
    updateMenuUi();
    updateTouchControlsUi();
    if (!isMobilePhoneLike()) requestPointerLock();

    animate();
}

function spawnFood() {
    function isSpawnValid(x, z) {
        _foodSpawnCandidate.set(x, FOOD_FLOAT_BASE_Y, z);
        if (snakeHead && _foodSpawnCandidate.distanceTo(snakeHead.position) < MIN_FOOD_DISTANCE_FROM_HEAD) {
            return false;
        }
        for (let i = 0; i < snakeSegments.length; i++) {
            if (_foodSpawnCandidate.distanceTo(snakeSegments[i].position) < MIN_FOOD_DISTANCE_FROM_BODY) {
                return false;
            }
        }
        return true;
    }

    const range = WORLD_SIZE * FOOD_SPAWN_RANGE_SCALE;
    for (let i = 0; i < 96; i++) {
        const x = (Math.random() - 0.5) * range;
        const z = (Math.random() - 0.5) * range;
        if (!isSpawnValid(x, z)) continue;
        food.position.set(x, FOOD_FLOAT_BASE_Y, z);
        return;
    }

    // Fallback: probe outward around the head directionally until we find a clear spot.
    const hx = snakeHead ? snakeHead.position.x : 0;
    const hz = snakeHead ? snakeHead.position.z : 0;
    const maxR = range * 0.5;
    for (let r = 10; r <= maxR; r += 6) {
        for (let a = 0; a < 16; a++) {
            const t = (a / 16) * Math.PI * 2;
            const x = THREE.MathUtils.clamp(hx + Math.cos(t) * r, -range * 0.5, range * 0.5);
            const z = THREE.MathUtils.clamp(hz + Math.sin(t) * r, -range * 0.5, range * 0.5);
            if (!isSpawnValid(x, z)) continue;
            food.position.set(x, FOOD_FLOAT_BASE_Y, z);
            return;
        }
    }

    food.position.set(0, FOOD_FLOAT_BASE_Y, 0);
}

window.startGame = function () {
    restartCooldownUntilMs = 0;
    restartCooldownLastShownSec = -1;
    tailExplosionQueue.length = 0;
    hasStartedRunOnce = true;
    setMenuScreen(MENU_SCREEN_MAIN);
    menuIndex = menuActions.indexOf('restart');
    score = 0;
    updateScoreUi();
    hideEndScoreUi();
    document.getElementById('overlay').classList.add('hidden');
    updateMenuUi();
    updateTouchControlsUi();

    camera.fov = CAMERA_FOV;
    camera.updateProjectionMatrix();
    boostMotionBlurAmt = 0;
    if (motionBlurPass) motionBlurPass.uniforms.strength.value = 0;

    // Reset snake
    snakeHead.position.set(0, SNAKE_SURFACE_Y, 0);
    snakeHead.visible = true;
    currentRotationY = 0;
    speedMultiplier = SPEED_BASE;
    timeChillEnergy = TIMECHILL_MAX;
    gameTimeRemaining = GAME_DURATION_SECONDS;
    selfHitImmunityRemaining = 0;
    selfHitPulseTime = 0;
    gameActive = true;
    gamePaused = false;
    crashAnimating = false;
    disposeCrashVfx();
    scene.fog.near = FOG_NEAR;
    scene.fog.far = FOG_FAR;

    // Clear old segments
    snakeSegments.forEach(s => scene.remove(s));
    snakeSegments = [];
    positionHistory = [];
    inputController.reset();

    // Add initial body segments
    for (let i = 0; i < INITIAL_BODY_SEGMENTS; i++) {
        addSegment();
    }

    const headFwd = DIR_FORWARD.clone().applyAxisAngle(DIR_WORLD_UP, currentRotationY);
    for (let i = 0; i < snakeSegments.length; i++) {
        const offset = (i + 1) * BODY_SEGMENT_SPACING;
        snakeSegments[i].position.copy(
            snakeHead.position.clone().addScaledVector(headFwd, -offset)
        );
    }

    positionHistory.push(snakeHead.position.clone());

    for (let i = 0; i < snakeSegments.length; i++) {
        placeBodySegmentAlongTrail(i, snakeSegments[i]);
    }
    updateScoreUi();

    spawnFood();

    if (!isMobilePhoneLike()) requestPointerLock();
    updatePointerHint();
    updateTimeChillUi(false);
    updateTimerUi();
};

/**
 * Places each body cube at a fixed arc length (i+1)×spacing from the head along the
 * polyline history[0]→history[1]→… (toward older samples), extrapolating past the tail if needed.
 */
function placeBodySegmentAlongTrail(segmentIndex, mesh) {
    const d = (segmentIndex + 1) * BODY_SEGMENT_SPACING;
    const h = positionHistory;
    if (h.length < 2) {
        const headFwd = _pathTan.copy(DIR_FORWARD).applyAxisAngle(DIR_WORLD_UP, currentRotationY);
        _pathPos.copy(snakeHead.position).addScaledVector(headFwd, -d);
        mesh.position.copy(_pathPos);
        mesh.quaternion.setFromUnitVectors(BOX_LOCAL_FORWARD, _pathEdge.copy(headFwd).negate());
        return;
    }
    let remaining = d;
    for (let i = 0; i < h.length - 1; i++) {
        const a = h[i];
        const b = h[i + 1];
        _pathEdge.copy(b).sub(a);
        const len = _pathEdge.length();
        if (len < 1e-8) continue;
        if (remaining <= len) {
            const t = remaining / len;
            _pathPos.copy(a).lerp(b, t);
            _pathTan.copy(_pathEdge).multiplyScalar(1 / len);
            mesh.position.copy(_pathPos);
            mesh.quaternion.setFromUnitVectors(BOX_LOCAL_FORWARD, _pathTan);
            return;
        }
        remaining -= len;
    }
    // Path not long enough yet: continue in a straight line from the oldest sample
    // along the last non-degenerate edge (same tangent as the trail end).
    const a = h[h.length - 2];
    const b = h[h.length - 1];
    _pathEdge.copy(b).sub(a);
    if (_pathEdge.lengthSq() > 1e-10) {
        _pathEdge.normalize();
        _pathPos.copy(b).addScaledVector(_pathEdge, remaining);
        _pathTan.copy(_pathEdge);
    } else {
        const headFwd = _pathTan.copy(DIR_FORWARD).applyAxisAngle(DIR_WORLD_UP, currentRotationY);
        _pathPos.copy(b).addScaledVector(headFwd, -remaining);
        _pathEdge.copy(headFwd).negate();
        mesh.position.copy(_pathPos);
        mesh.quaternion.setFromUnitVectors(BOX_LOCAL_FORWARD, _pathEdge);
        return;
    }
    mesh.position.copy(_pathPos);
    mesh.quaternion.setFromUnitVectors(BOX_LOCAL_FORWARD, _pathTan);
}

function addSegment() {
    const seg = new THREE.Mesh(
        new RoundedBoxGeometry(
            BODY_BOX_WIDTH,
            BODY_BOX_HEIGHT,
            BODY_BOX_DEPTH,
            BODY_ROUND_SEGMENTS,
            BODY_ROUND_RADIUS
        ),
        new THREE.MeshStandardMaterial({
            color: BODY_COLOR,
            emissive: BODY_COLOR,
            emissiveIntensity: BODY_EMISSIVE_INTENSITY
        })
    );
    if (snakeSegments.length > 0) {
        const tail = snakeSegments[snakeSegments.length - 1];
        seg.position.copy(tail.position);
        seg.quaternion.copy(tail.quaternion);
    } else {
        seg.position.copy(snakeHead.position);
        const headFwd = _pathTan.copy(DIR_FORWARD).applyAxisAngle(DIR_WORLD_UP, currentRotationY);
        seg.quaternion.setFromUnitVectors(BOX_LOCAL_FORWARD, headFwd.negate());
    }
    scene.add(seg);
    snakeSegments.push(seg);
}

function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (composer) {
        composer.setSize(window.innerWidth, window.innerHeight);
        composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }
    if (wallEdgeMaterial) {
        wallEdgeMaterial.resolution.set(window.innerWidth, window.innerHeight);
    }
    if (crashVfxRoot && crashVfxRoot.userData.fatLineMaterials) {
        const rw = window.innerWidth;
        const rh = window.innerHeight;
        crashVfxRoot.userData.fatLineMaterials.forEach(m => m.resolution.set(rw, rh));
    }
}

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    let boostingNow = false;
    inputController.updateGamepadInput();

    if (isGameplayActive()) {
        gameTimeRemaining = Math.max(0, gameTimeRemaining - delta);
        updateTimerUi();
        if (gameTimeRemaining <= 0) {
            if (sfx) sfx.crash();
            endGame("TIME UP!", { restartCooldownMs: GAME_END_RESTART_COOLDOWN_MS });
        }
    }

    if (isGameplayActive()) {
        updateSelfHitPulse(delta);
        const wantsAccel = input.mouseAccel || input.gamepadAccel;
        const wantsBrake = input.mouseBrake || input.gamepadBrake;
        const usingTimeChill = !wantsAccel && wantsBrake && timeChillEnergy > 0;
        boostingNow = wantsAccel;

        if (wantsAccel) {
            speedMultiplier = Math.min(speedMultiplier + SPEED_BOOST_STEP, SPEED_BOOST_MAX);
        } else if (usingTimeChill) {
            speedMultiplier = Math.max(speedMultiplier - SPEED_BRAKE_STEP, SPEED_MIN);
        } else {
            if (speedMultiplier > SPEED_BASE) {
                speedMultiplier = Math.max(speedMultiplier - SPEED_BOOST_STEP, SPEED_BASE);
            } else if (speedMultiplier < SPEED_BASE) {
                speedMultiplier = Math.min(speedMultiplier + SPEED_RECOVER_STEP, SPEED_BASE);
            }
        }

        if (usingTimeChill) {
            timeChillEnergy = Math.max(0, timeChillEnergy - TIMECHILL_DRAIN_PER_SEC * delta);
        } else if (!wantsBrake && timeChillEnergy < TIMECHILL_MAX) {
            timeChillEnergy = Math.min(TIMECHILL_MAX, timeChillEnergy + TIMECHILL_RECHARGE_PER_SEC * delta);
        }
        updateTimeChillUi(usingTimeChill || timeChillEnergy < TIMECHILL_MAX);

        // Rotation
        const controllerTurnInput = input.gamepadTurnAxis * CONTROLLER_TURN_SHARPNESS;
        const touchTurnInput = input.touchTurnAxis || 0;
        const digitalTurnInput = (input.left ? 1 : 0) - (input.right ? 1 : 0);
        if (controllerTurnInput !== 0) {
            const controllerFullSpeedScale = speedMultiplier * CONTROLLER_TURN_SPEED_RADIUS_FACTOR;
            const controllerSpeedTurnScale =
                1 + (controllerFullSpeedScale - 1) * CONTROLLER_TURN_RADIUS_SPEED_INFLUENCE;
            currentRotationY += TURN_SPEED * controllerSpeedTurnScale * controllerTurnInput;
        }
        const touchAndDigitalTurnInput = touchTurnInput + digitalTurnInput;
        if (touchAndDigitalTurnInput !== 0) {
            currentRotationY += TURN_SPEED * touchAndDigitalTurnInput;
        }

        // Move forward
        const direction = DIR_FORWARD.clone().applyAxisAngle(DIR_WORLD_UP, currentRotationY);

        snakeHead.position.addScaledVector(direction, FORWARD_STEP * speedMultiplier);
        snakeHead.rotation.y = currentRotationY;


        const hp = snakeHead.position.clone();
        if (positionHistory.length > 0 && positionHistory[0].distanceToSquared(hp) < 1e-14) {
            positionHistory[0].copy(hp);
        } else {
            positionHistory.unshift(hp);
        }
        trimHistoryTail();

        // Body: exact arc-length spacing along the recorded head path
        for (let i = 0; i < snakeSegments.length; i++) {
            placeBodySegmentAlongTrail(i, snakeSegments[i]);
        }

        // Eat food
        if (snakeHead.position.distanceTo(food.position) < EAT_DISTANCE) {
            score += SCORE_PER_FOOD * getHeadMultiplier();
            gameTimeRemaining += 1;
            food.getWorldPosition(_foodEatBurstPos);
            spawnFoodBurst(_foodEatBurstPos);
            spawnFood();
            addSegment();
            if (sfx) sfx.eat();
            updateScoreUi();
            updateTimerUi();
        }

        // Wall collision — neon crack + camera zoom-out before game over
        if (Math.abs(snakeHead.position.x) > WORLD_SIZE || Math.abs(snakeHead.position.z) > WORLD_SIZE) {
            beginWallCrash();
        } else {
            if (selfHitImmunityRemaining <= 0) {
                for (let i = SELF_COLLISION_START_INDEX; i < snakeSegments.length; i++) {
                    if (snakeHead.position.distanceTo(snakeSegments[i].position) < SELF_COLLISION_DISTANCE) {
                        beginSelfCollisionHit();
                        break;
                    }
                }
            }
            if (isGameplayActive()) {
                const camOffset = new THREE.Vector3(CAMERA_OFFSET_X, CAMERA_OFFSET_Y, CAMERA_OFFSET_Z)
                    .applyAxisAngle(DIR_WORLD_UP, currentRotationY);
                camOffset.add(snakeHead.position);
                camera.position.lerp(camOffset, CAMERA_FOLLOW_LERP);
                camera.lookAt(snakeHead.position);
            }
        }
    } else {
        updateSelfHitPulse(delta);
        updateTimeChillUi(false);
        if (shouldOrbitMenuCamera()) {
            updateMenuDemoAutoplay(delta);
            const t = clock.elapsedTime * MENU_IDLE_ORBIT_SPEED;
            const target = snakeHead?.position ?? new THREE.Vector3(0, SNAKE_SURFACE_Y, 0);
            camera.position.set(
                target.x + Math.cos(t) * MENU_IDLE_ORBIT_RADIUS,
                target.y + MENU_IDLE_ORBIT_HEIGHT,
                target.z + Math.sin(t) * MENU_IDLE_ORBIT_RADIUS
            );
            camera.lookAt(target);
        }
        if (!crashAnimating) {
            const cooldownMs = getRestartCooldownRemainingMs();
            const secondsLeft = cooldownMs > 0 ? Math.ceil(cooldownMs / 1000) : 0;
            if (secondsLeft !== restartCooldownLastShownSec) {
                restartCooldownLastShownSec = secondsLeft;
                updateMenuUi();
            }
        }
    }

    if (crashAnimating) {
        updateWallCrashVfx(delta);
    }
    updateTailExplosionTrail(delta);
    updateSnakeBursts(delta);

    const targetFov = gameActive && boostingNow ? CAMERA_FOV_BOOST : CAMERA_FOV;
    camera.fov += (targetFov - camera.fov) * Math.min(1, delta * CAMERA_FOV_BOOST_LERP);
    camera.updateProjectionMatrix();

    let targetMb = 0;
    if (gameActive && boostingNow) {
        const sp = Math.max(0, speedMultiplier - SPEED_BASE);
        const spNorm = Math.min(1, sp / (SPEED_BOOST_MAX - SPEED_BASE + 1e-6));
        targetMb = BOOST_MOTION_BLUR_MAX * (0.72 + 0.28 * spNorm);
    }
    boostMotionBlurAmt += (targetMb - boostMotionBlurAmt) * Math.min(1, delta * BOOST_MOTION_BLUR_LERP);
    if (motionBlurPass) motionBlurPass.uniforms.strength.value = boostMotionBlurAmt;

    updateFoodArrow();
    updateFoodVisuals(clock.elapsedTime, delta);
    composer.render();
}

function endGame(message, options = {}) {
    const restartCooldownMs = Math.max(0, options.restartCooldownMs || 0);
    gameActive = false;
    gamePaused = false;
    setMenuScreen(MENU_SCREEN_MAIN);
    restartCooldownUntilMs = restartCooldownMs > 0 ? (performance.now() + restartCooldownMs) : 0;
    restartCooldownLastShownSec = -1;
    menuIndex = menuActions.indexOf('restart');
    inputController.reset();
    updateTimeChillUi(false);
    updatePointerHint();
    const heads = getHeadMultiplier();
    const headBonus = heads * HEAD_END_BONUS;
    const finalScore = score + headBonus;
    showEndScoreUi(finalScore, heads, headBonus, score);
    document.getElementById('status').innerText = message;
    document.getElementById('overlay').classList.remove('hidden');
    updateMenuUi();
}

// Start the game
init();
