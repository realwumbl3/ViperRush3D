import * as THREE from 'three';
import { buildGlyphTextGroup } from './glyph-cache.js';

const MENU_COLOR = 0xff2b2b;
const MODEL_COLOR = 0xff8b8b;
const GLYPH_SCALE = 0.068;
const GLYPH_DEPTH = 0.09;
const GLYPH_GAP = 0.022;
const GLYPH_PAD = 0.2;
const SPACE_ADVANCE = 0.28;
const THICK_WIRE_SCALE = 1.06;
const SPIN_SPEED_Y = 1.05;

/** Dynamic import targets — path is relative to this file; exportName is the viewer factory. */
const MODEL_VIEWER_SPECS = [
    { path: '../models/snake-head.js', exportName: 'createViewerSnakeHeadModel' },
    { path: '../models/body-segment.js', exportName: 'createViewerBodySegmentModel' },
    { path: '../models/food-core.js', exportName: 'createViewerFoodCoreModel' },
    { path: '../models/food-arrow.js', exportName: 'createViewerFoodArrowModel' }
];

const AUTO_RELOAD_MS = 1000;

const state = {
    root: null,
    modelRoot: null,
    nameRoot: null,
    activeModel: null,
    index: 0,
    isVisible: false,
    autoReloadTimer: null
};

let reloadSeq = 0;

function buildLabelMesh(text, color = MENU_COLOR) {
    return buildGlyphTextGroup({
        text: String(text || '').toUpperCase(),
        color,
        glyphScale: GLYPH_SCALE,
        glyphDepth: GLYPH_DEPTH,
        glyphGap: GLYPH_GAP,
        glyphPad: GLYPH_PAD,
        spaceAdvance: SPACE_ADVANCE,
        thickWireScale: THICK_WIRE_SCALE
    });
}

function rebuildNameText() {
    if (!state.root) return;
    if (state.nameRoot) state.root.remove(state.nameRoot);
    const labelText = state.activeModel?.name || 'LOADING...';
    const label = buildLabelMesh(labelText, MODEL_COLOR);
    label.position.set(0, -2.75, 0.3);
    label.renderOrder = 925;
    state.root.add(label);
    state.nameRoot = label;
}

function disposeObject3d(object3d) {
    if (!object3d) return;
    object3d.traverse(node => {
        if (node.geometry) node.geometry.dispose();
        if (Array.isArray(node.material)) {
            for (let i = 0; i < node.material.length; i++) {
                if (node.material[i]) node.material[i].dispose();
            }
        } else if (node.material) {
            node.material.dispose();
        }
    });
}

function syncAutoReloadTimer() {
    if (state.autoReloadTimer != null) {
        clearInterval(state.autoReloadTimer);
        state.autoReloadTimer = null;
    }
    if (state.root && state.isVisible) {
        state.autoReloadTimer = setInterval(() => {
            void reloadActiveModel();
        }, AUTO_RELOAD_MS);
    }
}

async function reloadActiveModel() {
    if (!state.modelRoot || !MODEL_VIEWER_SPECS.length) return;
    const mySeq = ++reloadSeq;

    if (state.activeModel?.mesh) {
        state.modelRoot.remove(state.activeModel.mesh);
        disposeObject3d(state.activeModel.mesh);
    }
    state.activeModel = null;
    rebuildNameText();

    const spec = MODEL_VIEWER_SPECS[state.index];
    if (!spec) return;

    const url = new URL(spec.path, import.meta.url);
    url.searchParams.set('t', String(Date.now()));

    let mod;
    try {
        mod = await import(url.href);
    } catch (e) {
        if (mySeq !== reloadSeq) return;
        console.error('[asset-viewer-3d] model load failed', e);
        return;
    }
    if (mySeq !== reloadSeq) return;

    const loader = mod[spec.exportName];
    if (typeof loader !== 'function') {
        console.error('[asset-viewer-3d] missing export', spec.exportName);
        return;
    }

    const loaded = loader();
    state.activeModel = loaded || null;
    if (state.activeModel?.mesh) state.modelRoot.add(state.activeModel.mesh);
    rebuildNameText();
}

export function initAssetViewer3d({ scene, camera }) {
    if (!scene || !camera || state.root) return;
    scene.add(camera);
    state.root = new THREE.Group();
    state.root.position.set(0, -0.05, -7.4);
    state.root.visible = false;
    camera.add(state.root);

    const title = buildLabelMesh('3D ASSET VIEWER');
    title.position.set(0, 2.45, 0.3);
    title.renderOrder = 925;
    state.root.add(title);

    state.modelRoot = new THREE.Group();
    state.modelRoot.position.set(0, 0, 0.18);
    state.root.add(state.modelRoot);

    void reloadActiveModel();
}

export function setAssetViewer3dState({ isVisible }) {
    const wasVisible = state.isVisible;
    state.isVisible = !!isVisible;
    if (state.root) state.root.visible = state.isVisible;
    syncAutoReloadTimer();
    if (!wasVisible && state.isVisible) {
        void reloadActiveModel();
    }
}

export function cycleAssetViewerModel(dir) {
    if (!MODEL_VIEWER_SPECS.length || !state.isVisible) return;
    const delta = dir > 0 ? 1 : -1;
    state.index = (state.index + delta + MODEL_VIEWER_SPECS.length) % MODEL_VIEWER_SPECS.length;
    void reloadActiveModel();
}

export function updateAssetViewer3dAnimation(delta) {
    if (!state.root || !state.root.visible) return;
    const current = state.activeModel?.mesh;
    if (!current) return;
    current.rotation.y += delta * SPIN_SPEED_Y;
}
