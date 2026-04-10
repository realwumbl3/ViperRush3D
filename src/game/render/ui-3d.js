import * as THREE from 'three';
import { buildGlyphTextGroup } from './glyph-cache.js';
import { WORLD_SIZE } from '../config/world.js';

const COLOR_MAIN = 0xff2b2b;
const COLOR_SUB = 0xff7a7a;
const COLOR_ALERT = 0xff3e3e;

const BASE_GLYPH_SCALE = 0.055;
const BASE_GLYPH_DEPTH = 0.075;
const BASE_GLYPH_GAP = 0.02;
const BASE_GLYPH_PAD = 0.16;
const BASE_SPACE_ADVANCE = 0.24;
const BASE_TEXT_SIZE = 0.22;
const THICK_WIRE_SCALE = 1.06;
const WALL_HUD_INSET = 0.8;
const WALL_HUD_Y = 7.5;
const WALL_ROW_SCORE_Y = 3.6;
const WALL_ROW_TIMER_Y = 0.2;
const WALL_LABEL_RIGHT_X = -3;
const WALL_SEP_X = -1.4;
const WALL_VALUE_LEFT_X = 0.2;
const WALL_MULT_GAP_X = 2.8;

const state = {
    root: null,
    hudRoot: null,
    menuRoot: null,
    data: {
        hudVisible: false,
        scoreText: '0',
        multiplierText: 'x1',
        timerText: '02:00',
        timeChillVisible: false,
        timeChillFraction: 1,
        pointerHintVisible: false,
        pointerHintText: 'CLICK TO LOCK POINTER',
        menuVisible: true,
        endVisible: false,
        endScoreText: '',
        endBreakdownText: '',
        endHighText: ''
    },
    meshes: {},
    wallPanels: [],
    frameBar: null,
    frameBarOuter: null,
    fillBar: null,
    fadePlane: null,
    fadeOpacity: 0,
    fadeTargetOpacity: 0
};

function buildTextGroup(text, size, color) {
    const sizeMult = Math.max(0.18, size / BASE_TEXT_SIZE);
    return buildGlyphTextGroup({
        text: String(text || '').toUpperCase(),
        color,
        glyphScale: BASE_GLYPH_SCALE * sizeMult,
        glyphDepth: BASE_GLYPH_DEPTH * sizeMult,
        glyphGap: BASE_GLYPH_GAP * sizeMult,
        glyphPad: BASE_GLYPH_PAD * sizeMult,
        spaceAdvance: BASE_SPACE_ADVANCE * sizeMult,
        thickWireScale: THICK_WIRE_SCALE
    });
}

function setMeshPosition(mesh, x, y, z, align = 'center') {
    const width = mesh.userData.width || 0;
    let xPos = x;
    if (align === 'left') xPos = x + width * 0.5;
    if (align === 'right') xPos = x - width * 0.5;
    mesh.position.set(xPos, y, z);
}

function replaceTextMesh(key, parent, text, size, color, x, y, z, align = 'center') {
    const txt = String(text || '').toUpperCase();
    const prev = state.meshes[key];
    if (prev && prev.userData.text === txt) {
        setMeshPosition(prev, x, y, z, align);
        return;
    }
    if (prev) parent.remove(prev);
    const mesh = buildTextGroup(txt, size, color);
    setMeshPosition(mesh, x, y, z, align);
    parent.add(mesh);
    state.meshes[key] = mesh;
}

function ensureWallPanels(scene) {
    if (!scene || state.wallPanels.length > 0) return;
    const wallOffset = WORLD_SIZE - WALL_HUD_INSET;
    const layouts = [
        { id: 'wallPosX', x: wallOffset, z: 0, ry: -Math.PI / 2 },
        { id: 'wallNegX', x: -wallOffset, z: 0, ry: Math.PI / 2 },
        { id: 'wallPosZ', x: 0, z: wallOffset, ry: Math.PI },
        { id: 'wallNegZ', x: 0, z: -wallOffset, ry: 0 }
    ];
    for (let i = 0; i < layouts.length; i++) {
        const item = layouts[i];
        const root = new THREE.Group();
        root.position.set(item.x, WALL_HUD_Y, item.z);
        root.rotation.y = item.ry;
        scene.add(root);
        state.wallPanels.push({ id: item.id, root });
    }
}

function rebuild() {
    if (!state.root) return;
    const d = state.data;
    replaceTextMesh('hint', state.hudRoot, d.pointerHintText, 0.12, COLOR_SUB, 0, -2.2, -5.8);
    for (let i = 0; i < state.wallPanels.length; i++) {
        const panel = state.wallPanels[i];
        replaceTextMesh(`${panel.id}:scoreLabel`, panel.root, 'SCORE', 1.12, COLOR_MAIN, WALL_LABEL_RIGHT_X, WALL_ROW_SCORE_Y, 0, 'right');
        replaceTextMesh(`${panel.id}:scoreSep`, panel.root, '-', 1.12, COLOR_MAIN, WALL_SEP_X, WALL_ROW_SCORE_Y, 0);
        replaceTextMesh(`${panel.id}:scoreValue`, panel.root, d.scoreText, 1.12, COLOR_MAIN, WALL_VALUE_LEFT_X, WALL_ROW_SCORE_Y, 0, 'left');
        const scoreValueMesh = state.meshes[`${panel.id}:scoreValue`];
        const scoreWidth = scoreValueMesh?.userData?.width || 0;
        const multX = WALL_VALUE_LEFT_X + scoreWidth + WALL_MULT_GAP_X;
        replaceTextMesh(`${panel.id}:multValue`, panel.root, d.multiplierText, 0.88, COLOR_SUB, multX, WALL_ROW_SCORE_Y, 0, 'left');
        replaceTextMesh(`${panel.id}:timerLabel`, panel.root, 'TIME', 1.12, COLOR_MAIN, WALL_LABEL_RIGHT_X, WALL_ROW_TIMER_Y, 0, 'right');
        replaceTextMesh(`${panel.id}:timerSep`, panel.root, '-', 1.12, COLOR_MAIN, WALL_SEP_X, WALL_ROW_TIMER_Y, 0);
        replaceTextMesh(`${panel.id}:timerValue`, panel.root, d.timerText, 1.12, COLOR_MAIN, WALL_VALUE_LEFT_X, WALL_ROW_TIMER_Y, 0, 'left');
    }

    replaceTextMesh('endScore', state.menuRoot, d.endScoreText, 0.19, COLOR_MAIN, 0, 0.82, -7.2);
    replaceTextMesh('endBreakdown', state.menuRoot, d.endBreakdownText, 0.072, COLOR_SUB, 0, 0.42, -7.2);
    replaceTextMesh('endHigh', state.menuRoot, d.endHighText, 0.09, COLOR_SUB, 0, 0.08, -7.2);

    if (state.meshes.hint) state.meshes.hint.visible = d.pointerHintVisible && d.hudVisible;
    for (let i = 0; i < state.wallPanels.length; i++) {
        const panel = state.wallPanels[i];
        const scoreLabel = state.meshes[`${panel.id}:scoreLabel`];
        const scoreSep = state.meshes[`${panel.id}:scoreSep`];
        const scoreValue = state.meshes[`${panel.id}:scoreValue`];
        const multValue = state.meshes[`${panel.id}:multValue`];
        const timerLabel = state.meshes[`${panel.id}:timerLabel`];
        const timerSep = state.meshes[`${panel.id}:timerSep`];
        const timerValue = state.meshes[`${panel.id}:timerValue`];
        if (scoreLabel) scoreLabel.visible = d.hudVisible;
        if (scoreSep) scoreSep.visible = d.hudVisible;
        if (scoreValue) scoreValue.visible = d.hudVisible;
        if (multValue) multValue.visible = d.hudVisible;
        if (timerLabel) timerLabel.visible = d.hudVisible;
        if (timerSep) timerSep.visible = d.hudVisible;
        if (timerValue) timerValue.visible = d.hudVisible;
    }
    if (state.meshes.endScore) state.meshes.endScore.visible = d.endVisible && d.menuVisible;
    if (state.meshes.endBreakdown) state.meshes.endBreakdown.visible = d.endVisible && d.menuVisible;
    if (state.meshes.endHigh) state.meshes.endHigh.visible = d.endVisible && d.menuVisible;
    if (state.hudRoot) state.hudRoot.visible = d.hudVisible;
    if (state.menuRoot) state.menuRoot.visible = d.menuVisible;
}

function setupTimeChillBar() {
    const frameGeo = new THREE.PlaneGeometry(3.9, 0.14);
    const frameMat = new THREE.MeshBasicMaterial({
        color: COLOR_MAIN,
        wireframe: true,
        fog: false,
        depthTest: false,
        depthWrite: false
    });
    const frameMatOuter = new THREE.MeshBasicMaterial({
        color: COLOR_MAIN,
        wireframe: true,
        fog: false,
        depthTest: false,
        depthWrite: false
    });
    state.frameBar = new THREE.Mesh(frameGeo, frameMat);
    state.frameBarOuter = new THREE.Mesh(frameGeo, frameMatOuter);
    state.frameBar.position.set(0, -3.18, -5.8);
    state.frameBarOuter.position.set(0, -3.18, -5.8);
    state.frameBarOuter.scale.setScalar(THICK_WIRE_SCALE);
    state.frameBar.renderOrder = 919;
    state.frameBarOuter.renderOrder = 920;
    state.hudRoot.add(state.frameBar);
    state.hudRoot.add(state.frameBarOuter);

    const fillGeo = new THREE.PlaneGeometry(3.78, 0.09);
    const fillMat = new THREE.MeshBasicMaterial({
        color: COLOR_ALERT,
        fog: false,
        depthTest: false,
        depthWrite: false
    });
    state.fillBar = new THREE.Mesh(fillGeo, fillMat);
    state.fillBar.position.set(0, -3.18, -5.79);
    state.fillBar.renderOrder = 918;
    state.fillBar.scale.x = 1;
    state.hudRoot.add(state.fillBar);
}

function setupMenuFade() {
    const geo = new THREE.PlaneGeometry(36, 22);
    const mat = new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0,
        fog: false,
        depthTest: false,
        depthWrite: false
    });
    state.fadePlane = new THREE.Mesh(geo, mat);
    state.fadePlane.position.set(0, 0, -9.8);
    state.fadePlane.visible = false;
    state.fadePlane.renderOrder = 880;
    state.root.add(state.fadePlane);
}

export function initUi3d({ scene, camera }) {
    if (!scene || !camera || state.root) return;
    state.root = new THREE.Group();
    scene.add(camera);
    camera.add(state.root);

    state.hudRoot = new THREE.Group();
    state.menuRoot = new THREE.Group();
    state.root.add(state.hudRoot);
    state.root.add(state.menuRoot);
    ensureWallPanels(scene);
    setupMenuFade();
    setupTimeChillBar();
    rebuild();
}

export function setUi3dState(patch) {
    let needsRebuild = false;
    const keys = Object.keys(patch);
    for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        const v = patch[k];
        if (state.data[k] === v) continue;
        state.data[k] = v;
        if (k !== 'timeChillFraction' && k !== 'timeChillVisible') {
            needsRebuild = true;
        }
    }
    state.fadeTargetOpacity = state.data.menuVisible ? 0.45 : 0;
    if (state.frameBar) state.frameBar.visible = state.data.timeChillVisible && state.data.hudVisible;
    if (state.frameBarOuter) state.frameBarOuter.visible = state.data.timeChillVisible && state.data.hudVisible;
    if (state.fillBar) {
        const clamped = Math.max(0, Math.min(1, state.data.timeChillFraction));
        state.fillBar.visible = state.data.timeChillVisible && state.data.hudVisible;
        state.fillBar.scale.x = clamped;
        state.fillBar.position.x = (clamped - 1) * 1.89;
    }
    if (needsRebuild) rebuild();
}

export function updateUi3dAnimation(_elapsedTime, delta) {
    if (!state.root) return;
    if (state.fadePlane) {
        state.fadeOpacity += (state.fadeTargetOpacity - state.fadeOpacity) * Math.min(1, delta * 6);
        state.fadePlane.material.opacity = Math.max(0, Math.min(0.85, state.fadeOpacity));
        state.fadePlane.visible = state.fadePlane.material.opacity > 0.001;
    }
}

