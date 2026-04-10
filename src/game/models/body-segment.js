import * as THREE from 'three';
import {
    BODY_ICOSAHEDRON_RADIUS,
    BODY_ICOSAHEDRON_DETAIL,
    BODY_EDGE_LINE_THICKNESS,
    BODY_EDGE_LINE_SCALE,
    HEAD_COLOR,
    HEAD_EMISSIVE_INTENSITY
} from '../config/entities.js';

export function createSnakeBodySegmentMesh() {
    const seg = new THREE.Group();
    const bodyGeo = new THREE.IcosahedronGeometry(BODY_ICOSAHEDRON_RADIUS, BODY_ICOSAHEDRON_DETAIL);
    const coreMat = new THREE.MeshStandardMaterial({
        color: 0x000000,
        emissive: 0x000000,
        transparent: true,
        opacity: 0.5,
        fog: true
    });
    const edgeMat = new THREE.MeshStandardMaterial({
        color: HEAD_COLOR,
        emissive: HEAD_COLOR,
        emissiveIntensity: HEAD_EMISSIVE_INTENSITY,
        roughness: 0.25,
        metalness: 0.2,
        fog: true
    });
    const rodGeo = new THREE.CylinderGeometry(
        BODY_EDGE_LINE_THICKNESS * 0.5,
        BODY_EDGE_LINE_THICKNESS * 0.5,
        1,
        6,
        1
    );
    const core = new THREE.Mesh(bodyGeo, coreMat);
    seg.add(core);

    const edges = new THREE.EdgesGeometry(bodyGeo);
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
            _instQuat.setFromUnitVectors(rodUp, _instDir.multiplyScalar(1 / len));
            _instScale.set(1, len, 1);
        }
        _instMat.compose(_instPos, _instQuat, _instScale);
        edgeInstances.setMatrixAt(i, _instMat);
    }
    edgeInstances.instanceMatrix.needsUpdate = true;
    edgeInstances.scale.setScalar(BODY_EDGE_LINE_SCALE);
    seg.add(edgeInstances);

    return seg;
}

export function createGameBodySegmentModel() {
    return {
        name: 'BODY SEGMENT',
        mesh: createSnakeBodySegmentMesh()
    };
}

export function createViewerBodySegmentModel() {
    const mesh = createSnakeBodySegmentMesh();
    mesh.scale.setScalar(1.66);
    return {
        name: 'BODY SEGMENT',
        mesh
    };
}
