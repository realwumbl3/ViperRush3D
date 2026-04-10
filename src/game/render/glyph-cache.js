import * as THREE from 'three';
import { GLYPHS } from './glyph-map.js';

const geometryCache = new Map();
const templateCache = new Map();

function keyOf(cfg, ch, color) {
    return [
        ch,
        color,
        cfg.glyphScale,
        cfg.glyphDepth,
        cfg.glyphGap,
        cfg.glyphPad,
        cfg.thickWireScale
    ].join('|');
}

function getPixelGeometry(size, depth) {
    const key = `${size}|${depth}`;
    if (geometryCache.has(key)) return geometryCache.get(key);
    const geo = new THREE.BoxGeometry(size, size, depth);
    geometryCache.set(key, geo);
    return geo;
}

function buildGlyphTemplate(ch, cfg, color) {
    const pattern = GLYPHS[ch] || GLYPHS['?'];
    const rows = pattern.length;
    const cols = pattern[0].length;
    const glyph = new THREE.Group();
    const geo = getPixelGeometry(cfg.glyphScale, cfg.glyphDepth);
    const innerMat = new THREE.MeshBasicMaterial({
        color,
        wireframe: true,
        fog: false,
        depthTest: false,
        depthWrite: false
    });
    const outerMat = new THREE.MeshBasicMaterial({
        color,
        wireframe: true,
        fog: false,
        depthTest: false,
        depthWrite: false
    });
    const xHalf = (cols - 1) * 0.5;
    const yHalf = (rows - 1) * 0.5;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (pattern[r][c] !== '1') continue;
            const pxGroup = new THREE.Group();
            const pxInner = new THREE.Mesh(geo, innerMat);
            const pxOuter = new THREE.Mesh(geo, outerMat);
            pxOuter.scale.setScalar(cfg.thickWireScale);
            pxGroup.add(pxInner);
            pxGroup.add(pxOuter);
            pxGroup.position.set(
                (c - xHalf) * (cfg.glyphScale + cfg.glyphGap),
                (yHalf - r) * (cfg.glyphScale + cfg.glyphGap),
                0
            );
            glyph.add(pxGroup);
        }
    }
    glyph.userData.phase = 0;
    const width = (cols * (cfg.glyphScale + cfg.glyphGap)) + cfg.glyphPad;
    return { glyph, width };
}

function getGlyphTemplate(ch, cfg, color) {
    const key = keyOf(cfg, ch, color);
    if (templateCache.has(key)) return templateCache.get(key);
    const built = buildGlyphTemplate(ch, cfg, color);
    templateCache.set(key, built);
    return built;
}

export function buildGlyphTextGroup({
    text,
    color,
    glyphScale,
    glyphDepth,
    glyphGap,
    glyphPad,
    spaceAdvance,
    thickWireScale = 1.06
}) {
    const cfg = {
        glyphScale,
        glyphDepth,
        glyphGap,
        glyphPad,
        thickWireScale
    };
    const group = new THREE.Group();
    const chars = [];
    const txt = String(text || '').toUpperCase();
    let x = 0;
    for (let i = 0; i < txt.length; i++) {
        const ch = txt[i];
        if (ch === ' ') {
            x += spaceAdvance;
            continue;
        }
        const tpl = getGlyphTemplate(ch, cfg, color);
        const glyph = tpl.glyph.clone(true);
        glyph.position.x = x;
        chars.push(glyph);
        group.add(glyph);
        x += tpl.width;
    }
    const width = Math.max(0.8, x);
    for (let i = 0; i < chars.length; i++) chars[i].position.x -= width * 0.5;
    group.userData.chars = chars;
    group.userData.text = txt;
    group.userData.width = width;
    return group;
}

