import * as THREE from 'three';
import { createInputController } from '../input/controller.js';
import { createSfx } from '../audio/sfx.js';
import { createBurstSystem } from './vfx/bursts.js';
import {
    WORLD_SIZE,
    ARENA_WALL_HEIGHT,
    ARENA_WALL_OPACITY,
    ARENA_WALL_COLOR,
    ARENA_WALL_EDGE_WIDTH,
    ARENA_WALL_MAX_LAYERS_DESKTOP,
    ARENA_WALL_MAX_LAYERS_MOBILE,
    FLOOR_GRID_EXTENT,
    GRID_DIVISIONS,
    GRID_LINE_THICKNESS_PX,
    GRID_AXIS_EDGE_THICKNESS_PX,
    GRID_OPACITY,
    SCENE_BACKGROUND,
    FOG_NEAR,
    FOG_FAR,
    CAMERA_FOV,
    CAMERA_NEAR,
    CAMERA_FAR,
    AMBIENT_COLOR,
    AMBIENT_INTENSITY,
    POINT_LIGHT_COLOR,
    POINT_LIGHT_INTENSITY,
    POINT_LIGHT_DISTANCE,
    POINT_LIGHT_Y,
    GRID_COLOR_MAIN,
    GRID_COLOR_SUB,
    FLOOR_COLOR,
    FLOOR_ROTATION_X
} from './config/world.js';
import {
    SNAKE_SURFACE_Y,
    FOOD_FLOAT_BASE_Y
} from './config/entities.js';
import {
    TOUCH_TURN_SENSITIVITY,
    TOUCH_TURN_DEADZONE,
    TOUCH_SPEED_SENSITIVITY,
    TOUCH_SPEED_DEADZONE
} from './config/gameplay.js';
import { buildArenaWalls, buildFloorGrid } from './render/arena.js';
import { runtime } from './runtime.js';
import { isGameplayActive, isMenuOpen } from './game-state.js';
import { isMobilePhoneLike } from './platform/device.js';
import { isRotationPlayBlocked } from './platform/device.js';
import {
    updatePointerHint,
    initMouseSensitivitySettings,
    initFpsCounterSettings,
    updateTimeChillUi,
    updateTimerUi,
    hideEndScoreUi,
    updateMenuUi,
    updateTouchControlsUi,
    requestPointerLock
} from './ui/overlay.js';
import { enforceRotationPlayGate } from './platform/rotation-gate.js';
import { setupComposer } from './render/composer-setup.js';
import { initMenu3d } from './render/menu-3d.js';
import { initUi3d } from './render/ui-3d.js';
import { initAssetViewer3d } from './render/asset-viewer-3d.js';
import { resetMenuDemoSnake } from './gameplay/menu-demo.js';
import {
    handleMenuKeyDown,
    activateMenuSelection,
    onGlobalWheel
} from './menu-controls.js';
import {
    onGlobalPointerDown,
    onGlobalTouchStart,
    onGlobalPointerLockChange,
    onGlobalFullscreenChange
} from './events/global-events.js';
import { onResize } from './events/resize.js';
import { startGame } from './start-game.js';
import { animate } from './loop/animate.js';
import { setBeginCrashSequencePointerHint } from './crash/crash-sequence.js';
import { createGameSnakeHeadModel } from './models/snake-head.js';
import { createGameFoodCoreModel } from './models/food-core.js';
import { createGameFoodArrowModel } from './models/food-arrow.js';

function createArenaWallsLocal() {
    runtime.wallEdgeMaterial = buildArenaWalls({
        scene: runtime.scene,
        isMobilePhoneLike,
        wallEdgeMaterials: runtime.wallEdgeMaterials,
        worldSize: WORLD_SIZE,
        arenaWallHeight: ARENA_WALL_HEIGHT,
        floorGridExtent: FLOOR_GRID_EXTENT,
        gridDivisions: GRID_DIVISIONS,
        fogFar: FOG_FAR,
        arenaWallMaxLayersMobile: ARENA_WALL_MAX_LAYERS_MOBILE,
        arenaWallMaxLayersDesktop: ARENA_WALL_MAX_LAYERS_DESKTOP,
        arenaWallOpacity: ARENA_WALL_OPACITY,
        arenaWallColor: ARENA_WALL_COLOR,
        arenaWallEdgeWidth: ARENA_WALL_EDGE_WIDTH
    });
}

function createFloorGridLocal() {
    const grid = buildFloorGrid({
        scene: runtime.scene,
        floor: runtime.floor,
        floorGridRoot: runtime.floorGridRoot,
        floorGridMaterials: runtime.floorGridMaterials,
        floorGridExtent: FLOOR_GRID_EXTENT,
        gridDivisions: GRID_DIVISIONS,
        gridAxisEdgeThicknessPx: GRID_AXIS_EDGE_THICKNESS_PX,
        gridLineThicknessPx: GRID_LINE_THICKNESS_PX,
        gridColorMain: GRID_COLOR_MAIN,
        gridColorSub: GRID_COLOR_SUB,
        gridOpacity: GRID_OPACITY
    });
    runtime.floorGridRoot = grid.floorGridRoot;
    runtime.floorGridStaticGroup = grid.floorGridStaticGroup;
    runtime.floorGridParallaxGroup = grid.floorGridParallaxGroup;
}

export function init() {
    window.startGame = startGame;

    runtime.sfx = createSfx();
    runtime.scene = new THREE.Scene();
    runtime.scene.background = new THREE.Color(SCENE_BACKGROUND);
    runtime.scene.fog = new THREE.Fog(SCENE_BACKGROUND, FOG_NEAR, FOG_FAR);
    runtime.burstSystem = createBurstSystem({
        scene: runtime.scene,
        crashSnakeBursts: runtime.crashSnakeBursts,
        tailExplosionQueue: runtime.tailExplosionQueue
    });

    runtime.camera = new THREE.PerspectiveCamera(CAMERA_FOV, window.innerWidth / window.innerHeight, CAMERA_NEAR, CAMERA_FAR);
    runtime.scene.add(runtime.camera);
    runtime.renderer = new THREE.WebGLRenderer({ antialias: true });
    runtime.renderer.setSize(window.innerWidth, window.innerHeight);
    runtime.renderer.shadowMap.enabled = true;
    document.body.appendChild(runtime.renderer.domElement);

    runtime.clock = new THREE.Clock();

    runtime.scene.add(new THREE.AmbientLight(AMBIENT_COLOR, AMBIENT_INTENSITY));
    const pointLight = new THREE.PointLight(POINT_LIGHT_COLOR, POINT_LIGHT_INTENSITY, POINT_LIGHT_DISTANCE);
    pointLight.position.set(0, POINT_LIGHT_Y, 0);
    runtime.scene.add(pointLight);

    runtime.floorGridRoot = new THREE.Group();
    runtime.scene.add(runtime.floorGridRoot);

    const floorGeo = new THREE.PlaneGeometry(FLOOR_GRID_EXTENT, FLOOR_GRID_EXTENT);
    const floorMat = new THREE.MeshStandardMaterial({ color: FLOOR_COLOR });
    runtime.floor = new THREE.Mesh(floorGeo, floorMat);
    runtime.floor.rotation.x = FLOOR_ROTATION_X;
    runtime.floorGridRoot.add(runtime.floor);
    createFloorGridLocal();

    createArenaWallsLocal();
    setupComposer();

    const headModel = createGameSnakeHeadModel();
    runtime.snakeHead = headModel.mesh;
    runtime.snakeHeadCore = headModel.core || null;
    runtime.snakeHead.position.y = SNAKE_SURFACE_Y;
    runtime.scene.add(runtime.snakeHead);

    const foodModel = createGameFoodCoreModel();
    runtime.food = foodModel.mesh;
    runtime.food.position.y = FOOD_FLOAT_BASE_Y;
    runtime.scene.add(runtime.food);

    const foodArrowModel = createGameFoodArrowModel();
    runtime.foodArrow = foodArrowModel.mesh;
    runtime.scene.add(runtime.foodArrow);
    initMenu3d({ scene: runtime.scene, camera: runtime.camera });
    initUi3d({ scene: runtime.scene, camera: runtime.camera });
    initAssetViewer3d({ scene: runtime.scene, camera: runtime.camera });

    resetMenuDemoSnake();

    runtime.inputController = createInputController({
        isGameActive: () => isGameplayActive(),
        isMobileDevice: () => isMobilePhoneLike(),
        isPointerLocked: () => document.pointerLockElement === runtime.renderer.domElement,
        requestPointerLock: () => requestPointerLock(),
        touchTurnSensitivity: TOUCH_TURN_SENSITIVITY,
        touchTurnDeadzone: TOUCH_TURN_DEADZONE,
        touchSpeedSensitivity: TOUCH_SPEED_SENSITIVITY,
        touchSpeedDeadzone: TOUCH_SPEED_DEADZONE,
        onMouseTurn: movementX => {
            runtime.currentRotationY -= movementX * runtime.mouseSensitivityX;
        },
        onPointerHintChange: () => updatePointerHint(),
        isUiTargetBlocked: () => isRotationPlayBlocked(),
        onRestartRequest: () => {
            if (!isMenuOpen()) return;
            activateMenuSelection();
        }
    });
    runtime.input = runtime.inputController.state;
    runtime.inputController.attach();

    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    window.addEventListener('wheel', onGlobalWheel, { capture: true, passive: false });
    window.addEventListener('pointerdown', onGlobalPointerDown, true);
    window.addEventListener('touchstart', onGlobalTouchStart, { capture: true, passive: true });
    window.addEventListener('keydown', handleMenuKeyDown, true);
    document.addEventListener('pointerlockchange', onGlobalPointerLockChange);
    document.addEventListener('fullscreenchange', onGlobalFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onGlobalFullscreenChange);

    initMouseSensitivitySettings();
    initFpsCounterSettings();
    updateTimeChillUi(false);
    updateTimerUi();
    hideEndScoreUi();
    updateMenuUi();
    updateTouchControlsUi();
    enforceRotationPlayGate();
    if (!isMobilePhoneLike()) requestPointerLock();

    setBeginCrashSequencePointerHint(updatePointerHint);

    animate();
}
