import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

export function buildArenaWalls({
    scene,
    isMobilePhoneLike,
    wallEdgeMaterials,
    worldSize,
    arenaWallHeight,
    floorGridExtent,
    gridDivisions,
    fogFar,
    arenaWallMaxLayersMobile,
    arenaWallMaxLayersDesktop,
    arenaWallOpacity,
    arenaWallColor,
    arenaWallEdgeWidth
}) {
    const W = worldSize;
    const wh = arenaWallHeight;
    const gridUnit = floorGridExtent / gridDivisions;
    const wallDepth = Math.max(gridUnit, fogFar);
    const rawWallLayers = Math.max(1, Math.floor(wallDepth / gridUnit));
    const maxLayers = isMobilePhoneLike() ? arenaWallMaxLayersMobile : arenaWallMaxLayersDesktop;
    const wallLayers = Math.min(rawWallLayers, maxLayers);
    const wallGeom = new THREE.PlaneGeometry(2 * W, wh);
    const wallPlacements = [
        { axis: 'x', sign: 1, ry: -Math.PI / 2 },
        { axis: 'x', sign: -1, ry: Math.PI / 2 },
        { axis: 'z', sign: 1, ry: Math.PI },
        { axis: 'z', sign: -1, ry: 0 }
    ];

    for (let i = wallEdgeMaterials.length - 1; i >= 0; i--) {
        wallEdgeMaterials[i].dispose();
    }
    wallEdgeMaterials.length = 0;

    function addWallEdgeLoop(pts, mat) {
        const flat = [];
        for (let i = 0; i < pts.length; i++) {
            flat.push(pts[i].x, pts[i].y, pts[i].z);
        }
        const geo = new LineGeometry();
        geo.setPositions(flat);
        const line = new Line2(geo, mat);
        line.computeLineDistances();
        scene.add(line);
    }

    let wallEdgeMaterial = null;
    for (let layer = 0; layer <= wallLayers; layer++) {
        const ext = W + layer * gridUnit;
        const layerT = wallLayers > 0 ? layer / wallLayers : 0;
        const fade = 1 - THREE.MathUtils.smoothstep(layerT, 0, 1);
        const strongFade = Math.pow(fade, 2.6);
        const wallOpacity = THREE.MathUtils.lerp(arenaWallOpacity, 0.006, 1 - strongFade);
        const edgeOpacity = THREE.MathUtils.lerp(0.85, 0.008, 1 - strongFade);
        const edgeColor = new THREE.Color(0x39ff14).lerp(new THREE.Color(0x041404), 1 - strongFade);

        const wallMat = new THREE.MeshBasicMaterial({
            color: arenaWallColor,
            transparent: true,
            opacity: wallOpacity,
            depthWrite: false,
            side: THREE.FrontSide,
            fog: true
        });
        for (let p = 0; p < wallPlacements.length; p++) {
            const placement = wallPlacements[p];
            const m = new THREE.Mesh(wallGeom, wallMat);
            if (placement.axis === 'x') {
                m.position.set(placement.sign * ext, wh / 2, 0);
            } else {
                m.position.set(0, wh / 2, placement.sign * ext);
            }
            m.rotation.y = placement.ry;
            scene.add(m);
        }

        const edgeMat = new LineMaterial({
            color: edgeColor.getHex(),
            linewidth: arenaWallEdgeWidth,
            worldUnits: true,
            transparent: true,
            opacity: edgeOpacity,
            depthWrite: false,
            blending: THREE.NormalBlending,
            fog: true
        });
        edgeMat.resolution.set(window.innerWidth, window.innerHeight);
        wallEdgeMaterials.push(edgeMat);
        if (layer === 0) wallEdgeMaterial = edgeMat;

        addWallEdgeLoop([
            new THREE.Vector3(ext, 0, -ext),
            new THREE.Vector3(ext, 0, ext),
            new THREE.Vector3(ext, wh, ext),
            new THREE.Vector3(ext, wh, -ext),
            new THREE.Vector3(ext, 0, -ext)
        ], edgeMat);
        addWallEdgeLoop([
            new THREE.Vector3(-ext, 0, -ext),
            new THREE.Vector3(-ext, 0, ext),
            new THREE.Vector3(-ext, wh, ext),
            new THREE.Vector3(-ext, wh, -ext),
            new THREE.Vector3(-ext, 0, -ext)
        ], edgeMat);
        addWallEdgeLoop([
            new THREE.Vector3(-ext, 0, ext),
            new THREE.Vector3(ext, 0, ext),
            new THREE.Vector3(ext, wh, ext),
            new THREE.Vector3(-ext, wh, ext),
            new THREE.Vector3(-ext, 0, ext)
        ], edgeMat);
        addWallEdgeLoop([
            new THREE.Vector3(-ext, 0, -ext),
            new THREE.Vector3(ext, 0, -ext),
            new THREE.Vector3(ext, wh, -ext),
            new THREE.Vector3(-ext, wh, -ext),
            new THREE.Vector3(-ext, 0, -ext)
        ], edgeMat);
    }

    return wallEdgeMaterial;
}

export function buildFloorGrid({
    scene,
    floor,
    floorGridRoot,
    floorGridMaterials,
    floorGridExtent,
    gridDivisions,
    gridAxisEdgeThicknessPx,
    gridLineThicknessPx,
    gridColorMain,
    gridColorSub,
    gridOpacity
}) {
    let root = floorGridRoot;
    if (!root) {
        root = new THREE.Group();
        scene.add(root);
    }

    for (let i = floorGridMaterials.length - 1; i >= 0; i--) {
        floorGridMaterials[i].dispose();
    }
    floorGridMaterials.length = 0;

    for (let i = root.children.length - 1; i >= 0; i--) {
        const child = root.children[i];
        if (child !== floor) root.remove(child);
    }

    const floorGridStaticGroup = new THREE.Group();
    const floorGridParallaxGroup = new THREE.Group();
    root.add(floorGridStaticGroup);
    root.add(floorGridParallaxGroup);

    const half = floorGridExtent * 0.5;
    const step = floorGridExtent / gridDivisions;
    const eps = step * 0.25;
    const gridMaterialCache = new Map();

    function getGridLineMaterial(linewidthPx, colorHex) {
        const key = `${linewidthPx}|${colorHex}`;
        if (gridMaterialCache.has(key)) return gridMaterialCache.get(key);

        const mat = new LineMaterial({
            color: colorHex,
            linewidth: linewidthPx,
            worldUnits: false,
            transparent: true,
            opacity: gridOpacity,
            fog: true,
            depthWrite: false,
            depthTest: true
        });
        mat.resolution.set(window.innerWidth, window.innerHeight);
        floorGridMaterials.push(mat);
        gridMaterialCache.set(key, mat);
        return mat;
    }

    const addLine = (x1, z1, x2, z2, linewidthPx, colorHex, toStaticLayer) => {
        const mat = getGridLineMaterial(linewidthPx, colorHex);

        const geo = new LineGeometry();
        geo.setPositions([x1, 0.02, z1, x2, 0.02, z2]);
        const line = new Line2(geo, mat);
        line.computeLineDistances();
        (toStaticLayer ? floorGridStaticGroup : floorGridParallaxGroup).add(line);
    };

    for (let i = 0; i <= gridDivisions; i++) {
        const p = -half + i * step;
        const isCenter = Math.abs(p) < eps;
        const isEdge = Math.abs(Math.abs(p) - half) < eps;
        const width = (isCenter || isEdge) ? gridAxisEdgeThicknessPx : gridLineThicknessPx;
        const color = (isCenter || isEdge) ? gridColorMain : gridColorSub;
        const staticLine = isEdge;

        addLine(-half, p, half, p, width, color, staticLine);
        addLine(p, -half, p, half, width, color, staticLine);
    }

    return {
        floorGridRoot: root,
        floorGridStaticGroup,
        floorGridParallaxGroup
    };
}
