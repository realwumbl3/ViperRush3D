import * as THREE from 'three';
import {
    BODY_ICOSAHEDRON_RADIUS,
    BODY_ICOSAHEDRON_DETAIL,
    BODY_EDGE_LINE_THICKNESS,
    BODY_EDGE_LINE_SCALE,
    HEAD_COLOR,
    HEAD_EYE_COLOR,
    HEAD_EMISSIVE_INTENSITY
} from '../config/entities.js';

export function createSnakeHeadMesh() {
    const head = new THREE.Group();

    // Use a slightly larger icosahedron for the head base to match body segment style
    const headRadius = BODY_ICOSAHEDRON_RADIUS * 1.2;
    const headGeo = new THREE.IcosahedronGeometry(headRadius, BODY_ICOSAHEDRON_DETAIL);

    // Core material: semi-transparent dark center like body segments
    const coreMat = new THREE.MeshStandardMaterial({
        color: 0x000000,
        emissive: 0x000000,
        transparent: true,
        opacity: 0.5,
        fog: true
    });

    // Edge material: glowing lines like body segments
    const edgeMat = new THREE.MeshStandardMaterial({
        color: HEAD_COLOR,
        emissive: HEAD_COLOR,
        emissiveIntensity: HEAD_EMISSIVE_INTENSITY,
        roughness: 0.25,
        metalness: 0.2,
        fog: true
    });

    const rodGeo = new THREE.CylinderGeometry(
        BODY_EDGE_LINE_THICKNESS * 0.6,
        BODY_EDGE_LINE_THICKNESS * 0.6,
        1,
        6,
        1
    );

    const core = new THREE.Mesh(headGeo, coreMat);
    // Flatten the head slightly
    core.scale.set(1.1, 0.8, 1.2);
    head.add(core);

    // Create wireframe edges using the same InstancedMesh technique as body-segment.js
    const edges = new THREE.EdgesGeometry(headGeo);
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
    edgeInstances.scale.copy(core.scale).multiplyScalar(BODY_EDGE_LINE_SCALE);
    head.add(edgeInstances);

    // Add minimalistic eyes - two glowing boxes, angled to look "mean"
    const eyeGeo = new THREE.BoxGeometry(0.3, 0.1, 0.1);
    const eyeMat = new THREE.MeshStandardMaterial({
        color: HEAD_EYE_COLOR,
        emissive: HEAD_EYE_COLOR,
        emissiveIntensity: HEAD_EMISSIVE_INTENSITY * 2.0,
        fog: true
    });

    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.32, 0.18, -0.58);
    leftEye.rotation.set(0, 0.6, -0.4); // Rotated inwards (y) and slanted (z)
    head.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.32, 0.18, -0.58);
    rightEye.rotation.set(0, -0.6, 0.4); // Rotated inwards (y) and slanted (z)
    head.add(rightEye);

    return { head, core };
}

export function createGameSnakeHeadModel() {
    const built = createSnakeHeadMesh();
    return {
        name: 'SNAKE HEAD',
        mesh: built.head,
        core: built.core
    };
}

export function createViewerSnakeHeadModel() {
    const built = createSnakeHeadMesh();
    built.head.scale.setScalar(1.3);
    built.head.rotation.y = Math.PI * 0.22;
    return {
        name: 'SNAKE HEAD',
        mesh: built.head
    };
}
