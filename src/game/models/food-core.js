import * as THREE from 'three';
import {
    FOOD_COLOR,
    FOOD_EMISSIVE_INTENSITY,
    FOOD_ICOSAHEDRON_DETAIL,
    FOOD_ICOSAHEDRON_RADIUS,
    BODY_EDGE_LINE_THICKNESS,
    BODY_EDGE_LINE_SCALE
} from '../config/entities.js';

export function createFoodMesh() {
    const food = new THREE.Group();

    // Make the food core bigger as requested
    const foodRadius = FOOD_ICOSAHEDRON_RADIUS * 1.5;
    const foodGeo = new THREE.IcosahedronGeometry(foodRadius, FOOD_ICOSAHEDRON_DETAIL);

    // Core material: semi-transparent dark center matching the new style
    const coreMat = new THREE.MeshStandardMaterial({
        color: 0x000000,
        emissive: 0x000000,
        transparent: true,
        opacity: 0.5,
        fog: true
    });

    // Edge material: glowing lines matching the snake style but with food color
    const edgeMat = new THREE.MeshStandardMaterial({
        color: FOOD_COLOR,
        emissive: FOOD_COLOR,
        emissiveIntensity: FOOD_EMISSIVE_INTENSITY,
        roughness: 0.25,
        metalness: 0.2,
        fog: true
    });

    const rodGeo = new THREE.CylinderGeometry(
        BODY_EDGE_LINE_THICKNESS * 0.8,
        BODY_EDGE_LINE_THICKNESS * 0.8,
        1,
        6,
        1
    );

    const core = new THREE.Mesh(foodGeo, coreMat);
    food.add(core);

    // Create wireframe edges using the same InstancedMesh technique for consistency
    const edges = new THREE.EdgesGeometry(foodGeo);
    const positions = edges.getAttribute('position');
    const edgePairs = [];
    for (let i = 0; i < positions.count; i += 2) {
        const a = new THREE.Vector3().fromBufferAttribute(positions, i);
        const b = new THREE.Vector3().fromBufferAttribute(positions, i + 1);
        edgePairs.push([a, b]);
    }
    edges.dispose();

    const edgeInstances = new THREE.InstancedMesh(rodGeo, edgeMat, edgePairs.length);
    const rodUp = new THREE.Vector3(0, 1, 0);
    const _instPos = new THREE.Vector3();
    const _instDir = new THREE.Vector3();
    const _instQuat = new THREE.Quaternion();
    const _instScale = new THREE.Vector3(1, 1, 1);
    const _instMat = new THREE.Matrix4();

    for (let i = 0; i < edgePairs.length; i++) {
        const a = edgePairs[i][0];
        const b = edgePairs[i][1];
        _instDir.copy(b).sub(a);
        const len = _instDir.length();
        if (len < 1e-8) {
            _instScale.set(0, 0, 0);
            _instPos.set(0, 0, 0);
            _instQuat.identity();
        } else {
            _instPos.copy(a).addScaledVector(_instDir, 0.5);
            _instQuat.setFromUnitVectors(rodUp, _instDir.clone().normalize());
            _instScale.set(1, len, 1);
        }
        _instMat.compose(_instPos, _instQuat, _instScale);
        edgeInstances.setMatrixAt(i, _instMat);
    }
    edgeInstances.instanceMatrix.needsUpdate = true;
    edgeInstances.scale.setScalar(BODY_EDGE_LINE_SCALE);
    food.add(edgeInstances);

    return food;
}

export function createGameFoodCoreModel() {
    return {
        name: 'FOOD CORE',
        mesh: createFoodMesh()
    };
}

export function createViewerFoodCoreModel() {
    const mesh = createFoodMesh();
    mesh.scale.setScalar(1.66);
    return {
        name: 'FOOD CORE',
        mesh
    };
}
