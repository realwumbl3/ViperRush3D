import * as THREE from 'three';
import { createFoodMesh } from './entities.js';
import { buildGlyphTextGroup } from './glyph-cache.js';

const MENU_COLOR = 0xff2b2b;
const MENU_SELECTED_COLOR = 0xff8b8b;

const GLYPH_SCALE = 0.068;
const GLYPH_DEPTH = 0.09;
const GLYPH_GAP = 0.022;
const GLYPH_PAD = 0.2;
const SPACE_ADVANCE = 0.28;
const TITLE_GLYPH_SCALE = 0.14;
const TITLE_GLYPH_DEPTH = 0.14;
const TITLE_GLYPH_GAP = 0.042;
const TITLE_GLYPH_PAD = 0.34;
const TITLE_SPACE_ADVANCE = 0.54;
const THICK_WIRE_SCALE = 1.06;

const state = {
    root: null,
    selector: null,
    lines: [],
    labelsByAction: new Map(),
    actionsVisible: [],
    activeAction: null,
    showHighlight: false,
    targetSelectorY: 0,
    selectorY: 0,
    titleText: 'VIPER RUSH',
    titleGroup: null
};

function buildLine(label, y, selected) {
    const lineRoot = buildGlyphTextGroup({
        text: label,
        color: selected ? MENU_SELECTED_COLOR : MENU_COLOR,
        glyphScale: GLYPH_SCALE,
        glyphDepth: GLYPH_DEPTH,
        glyphGap: GLYPH_GAP,
        glyphPad: GLYPH_PAD,
        spaceAdvance: SPACE_ADVANCE,
        thickWireScale: THICK_WIRE_SCALE
    });
    lineRoot.position.set(0, y, 0);
    const chars = lineRoot.userData.chars || [];
    for (let i = 0; i < chars.length; i++) {
        chars[i].userData.phase = (i * 0.35) + (Math.random() * 0.7);
    }
    lineRoot.userData.width = lineRoot.userData.width || 0.8;
    return lineRoot;
}

function clearLines() {
    for (let i = 0; i < state.lines.length; i++) {
        if (state.root) state.root.remove(state.lines[i]);
    }
    state.lines.length = 0;
}

function clearTitle() {
    if (!state.titleGroup || !state.root) return;
    state.root.remove(state.titleGroup);
    state.titleGroup = null;
}

function rebuildTitle() {
    if (!state.root) return;
    clearTitle();
    const group = buildGlyphTextGroup({
        text: String(state.titleText || '').toUpperCase(),
        color: MENU_SELECTED_COLOR,
        glyphScale: TITLE_GLYPH_SCALE,
        glyphDepth: TITLE_GLYPH_DEPTH,
        glyphGap: TITLE_GLYPH_GAP,
        glyphPad: TITLE_GLYPH_PAD,
        spaceAdvance: TITLE_SPACE_ADVANCE,
        thickWireScale: THICK_WIRE_SCALE
    });
    group.position.set(0, 3.1, 0.18);
    group.renderOrder = 910;
    state.root.add(group);
    state.titleGroup = group;
}

function rebuildLines() {
    if (!state.root) return;
    clearLines();
    const spacing = 0.88;
    const count = state.actionsVisible.length;
    const yStart = ((count - 1) * spacing) * 0.5;
    for (let i = 0; i < count; i++) {
        const action = state.actionsVisible[i];
        const label = state.labelsByAction.get(action) || action.toUpperCase();
        const selected = action === state.activeAction;
        const line = buildLine(label, yStart - (i * spacing), selected);
        state.root.add(line);
        state.lines.push(line);
    }
    if (state.selector) {
        const idx = state.actionsVisible.indexOf(state.activeAction);
        const selectedLine = idx >= 0 ? state.lines[idx] : null;
        const selectedWidth = selectedLine ? Math.max(0.8, selectedLine.userData.width || 0.8) : 1;
        state.selector.position.x = -((selectedWidth * 0.5) + 1.02);
        const y = idx >= 0 ? state.lines[idx].position.y : 0;
        state.targetSelectorY = y;
        if (state.selectorY === 0) state.selectorY = y;
        state.selector.position.y = state.selectorY;
    }
    rebuildTitle();
}

export function initMenu3d({ scene, camera }) {
    if (!scene || !camera || state.root) return;
    scene.add(camera);

    state.root = new THREE.Group();
    state.root.position.set(0, -1.05, -8.2);
    state.root.visible = false;
    camera.add(state.root);

    state.selector = createFoodMesh();
    state.selector.scale.setScalar(1.16);
    state.selector.position.set(-1.45, 0, 0.2);
    state.selector.renderOrder = 901;
    state.root.add(state.selector);
}

export function updateMenu3dState({ items, activeAction, showHighlight, isVisible, titleText }) {
    state.actionsVisible = items.map(item => item.action);
    state.activeAction = activeAction;
    state.showHighlight = !!showHighlight;
    if (typeof titleText === 'string') state.titleText = titleText.toUpperCase();
    for (let i = 0; i < items.length; i++) {
        state.labelsByAction.set(items[i].action, String(items[i].label || '').toUpperCase());
    }
    if (state.root) state.root.visible = !!isVisible && state.actionsVisible.length > 0;
    rebuildLines();
}

export function updateMenu3dAnimation(elapsedTime, delta) {
    if (!state.root || !state.root.visible) return;
    const lineCount = state.lines.length;
    for (let i = 0; i < lineCount; i++) {
        const line = state.lines[i];
        const chars = line.userData.chars || [];
        const lineIsActive = state.showHighlight && state.actionsVisible[i] === state.activeAction;
        for (let j = 0; j < chars.length; j++) {
            const ch = chars[j];
            const t = elapsedTime + (ch.userData.phase || 0);
            const amp = lineIsActive ? 1 : 0.72;
            ch.position.y = (Math.sin(t * 2.1) * 0.03 + Math.cos(t * 1.6) * 0.018) * amp;
            ch.rotation.x = (Math.sin(t * 1.5) * 0.19) * amp;
            ch.rotation.y = (Math.cos(t * 1.8) * 0.22) * amp;
            ch.rotation.z = (Math.sin(t * 2.4) * 0.13) * amp;
        }
    }
    if (state.titleGroup) {
        state.titleGroup.rotation.z = Math.sin(elapsedTime * 0.5) * 0.02;
    }
    if (state.selector) {
        const target = state.showHighlight ? state.targetSelectorY : state.targetSelectorY - 0.18;
        state.selectorY += (target - state.selectorY) * Math.min(1, delta * 10);
        state.selector.position.y = state.selectorY;
        state.selector.rotation.x += delta * 1.8;
        state.selector.rotation.y += delta * 2.4;
        state.selector.rotation.z += delta * 1.3;
        state.selector.visible = state.showHighlight;
    }
}


