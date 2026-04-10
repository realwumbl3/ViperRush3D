import * as THREE from 'three';
import {
    HEAD_COLOR,
    HEAD_EMISSIVE_INTENSITY,
    BODY_ICOSAHEDRON_RADIUS,
    BODY_ICOSAHEDRON_DETAIL,
    BODY_EDGE_LINE_THICKNESS,
    BODY_EDGE_LINE_SCALE,
    BODY_SEGMENT_SPACING,
    TRAIL_PATH_MARGIN,
    DIR_FORWARD,
    DIR_WORLD_UP,
    BOX_LOCAL_FORWARD
} from '../config/entities.js';
import { runtime } from '../runtime.js';
import { pathEdge, pathPos, pathTan, bodyRodUp } from '../scratch.js';

function getHistoryLength() {
    return runtime.trailHistory.getLength();
}

function getHistoryPoint(index) {
    return runtime.trailHistory.getPoint(index);
}

export function resetPositionHistory() {
    runtime.trailHistory.reset();
}

export function appendHeadHistoryPoint(headPos) {
    runtime.trailHistory.append(headPos);
}

export function setSnakePoseForTrail() {
    const headFwd = DIR_FORWARD.clone().applyAxisAngle(DIR_WORLD_UP, runtime.currentRotationY);
    for (let i = 0; i < runtime.snakeSegments.length; i++) {
        const offset = (i + 1) * BODY_SEGMENT_SPACING;
        runtime.snakeSegments[i].position.copy(
            runtime.snakeHead.position.clone().addScaledVector(headFwd, -offset)
        );
    }
    resetPositionHistory();
    appendHeadHistoryPoint(runtime.snakeHead.position);
    for (let i = 0; i < runtime.snakeSegments.length; i++) {
        placeBodySegmentAlongTrail(i, runtime.snakeSegments[i]);
    }
}

export function clearSnakeSegments() {
    for (let i = 0; i < runtime.snakeSegments.length; i++) {
        const seg = runtime.snakeSegments[i];
        runtime.scene.remove(seg);
        if (seg.geometry) seg.geometry.dispose();
        if (seg.material) seg.material.dispose();
    }
    runtime.snakeSegments = [];
}

export function ensureSnakeSegmentCount(targetCount) {
    while (runtime.snakeSegments.length < targetCount) addSegment();
    while (runtime.snakeSegments.length > targetCount) {
        const seg = runtime.snakeSegments.pop();
        if (!seg) break;
        runtime.scene.remove(seg);
        if (seg.geometry) seg.geometry.dispose();
        if (seg.material) seg.material.dispose();
    }
}

/**
 * Drop oldest samples only after we have more path than the tail needs, so the body
 * always rides on the real polyline — never a fake extrapolated line.
 */
export function trimHistoryTail() {
    const maxKeep = runtime.snakeSegments.length * BODY_SEGMENT_SPACING + TRAIL_PATH_MARGIN;
    runtime.trailHistory.trimToArcLength(maxKeep);
}

/**
 * Places each body cube at a fixed arc length (i+1)×spacing from the head along the
 * polyline history[0]→history[1]→… (toward older samples), extrapolating past the tail if needed.
 */
export function placeBodySegmentAlongTrail(segmentIndex, mesh) {
    const d = (segmentIndex + 1) * BODY_SEGMENT_SPACING;
    const hLen = getHistoryLength();
    if (hLen < 2) {
        const headFwd = pathTan.copy(DIR_FORWARD).applyAxisAngle(DIR_WORLD_UP, runtime.currentRotationY);
        pathPos.copy(runtime.snakeHead.position).addScaledVector(headFwd, -d);
        mesh.position.copy(pathPos);
        mesh.quaternion.setFromUnitVectors(BOX_LOCAL_FORWARD, pathEdge.copy(headFwd).negate());
        return;
    }
    let remaining = d;
    for (let i = hLen - 1; i > 0; i--) {
        const a = getHistoryPoint(i);
        const b = getHistoryPoint(i - 1);
        pathEdge.copy(b).sub(a);
        const len = pathEdge.length();
        if (len < 1e-8) continue;
        if (remaining <= len) {
            const t = remaining / len;
            pathPos.copy(a).lerp(b, t);
            pathTan.copy(pathEdge).multiplyScalar(1 / len);
            mesh.position.copy(pathPos);
            mesh.quaternion.setFromUnitVectors(BOX_LOCAL_FORWARD, pathTan);
            return;
        }
        remaining -= len;
    }
    const a = getHistoryPoint(1);
    const b = getHistoryPoint(0);
    pathEdge.copy(b).sub(a);
    if (pathEdge.lengthSq() > 1e-10) {
        pathEdge.normalize();
        pathPos.copy(b).addScaledVector(pathEdge, remaining);
        pathTan.copy(pathEdge);
    } else {
        const headFwd = pathTan.copy(DIR_FORWARD).applyAxisAngle(DIR_WORLD_UP, runtime.currentRotationY);
        pathPos.copy(b).addScaledVector(headFwd, -remaining);
        pathEdge.copy(headFwd).negate();
        mesh.position.copy(pathPos);
        mesh.quaternion.setFromUnitVectors(BOX_LOCAL_FORWARD, pathEdge);
        return;
    }
    mesh.position.copy(pathPos);
    mesh.quaternion.setFromUnitVectors(BOX_LOCAL_FORWARD, pathTan);
}

function ensureBodySegmentAssets() {
    if (runtime.bodySegmentGeometry) return;

    runtime.bodySegmentGeometry = new THREE.IcosahedronGeometry(BODY_ICOSAHEDRON_RADIUS, BODY_ICOSAHEDRON_DETAIL);
    runtime.bodySegmentCoreMaterial = new THREE.MeshStandardMaterial({
        color: 0x000000,
        emissive: 0x000000,
        transparent: true,
        opacity: 0.5,
        fog: true
    });
    runtime.bodySegmentEdgeMaterial = new THREE.MeshStandardMaterial({
        color: HEAD_COLOR,
        emissive: HEAD_COLOR,
        emissiveIntensity: HEAD_EMISSIVE_INTENSITY,
        roughness: 0.25,
        metalness: 0.2,
        fog: true
    });
    runtime.bodySegmentRodGeometry = new THREE.CylinderGeometry(
        BODY_EDGE_LINE_THICKNESS * 0.5,
        BODY_EDGE_LINE_THICKNESS * 0.5,
        1,
        6,
        1
    );

    const edges = new THREE.EdgesGeometry(runtime.bodySegmentGeometry);
    const positions = edges.getAttribute('position');
    runtime.bodySegmentEdgePairs = [];
    for (let i = 0; i < positions.count; i += 2) {
        const a = new THREE.Vector3().fromBufferAttribute(positions, i);
        const b = new THREE.Vector3().fromBufferAttribute(positions, i + 1);
        runtime.bodySegmentEdgePairs.push([a, b]);
    }
    edges.dispose();
}

export function addSegment() {
    ensureBodySegmentAssets();
    const seg = new THREE.Group();

    const core = new THREE.Mesh(runtime.bodySegmentGeometry, runtime.bodySegmentCoreMaterial);
    seg.add(core);

    const edgeInstances = new THREE.InstancedMesh(
        runtime.bodySegmentRodGeometry,
        runtime.bodySegmentEdgeMaterial,
        runtime.bodySegmentEdgePairs.length
    );
    const _instPos = new THREE.Vector3();
    const _instDir = new THREE.Vector3();
    const _instQuat = new THREE.Quaternion();
    const _instScale = new THREE.Vector3(1, 1, 1);
    const _instMat = new THREE.Matrix4();
    for (let i = 0; i < runtime.bodySegmentEdgePairs.length; i++) {
        const a = runtime.bodySegmentEdgePairs[i][0];
        const b = runtime.bodySegmentEdgePairs[i][1];
        _instDir.copy(b).sub(a);
        const len = _instDir.length();
        if (len < 1e-8) {
            _instScale.set(0, 0, 0);
            _instPos.set(0, 0, 0);
            _instQuat.identity();
        } else {
            _instPos.copy(a).addScaledVector(_instDir, 0.5);
            _instQuat.setFromUnitVectors(bodyRodUp, _instDir.multiplyScalar(1 / len));
            _instScale.set(1, len, 1);
        }
        _instMat.compose(_instPos, _instQuat, _instScale);
        edgeInstances.setMatrixAt(i, _instMat);
    }
    edgeInstances.instanceMatrix.needsUpdate = true;
    edgeInstances.scale.setScalar(BODY_EDGE_LINE_SCALE);
    seg.add(edgeInstances);

    if (runtime.snakeSegments.length > 0) {
        const tail = runtime.snakeSegments[runtime.snakeSegments.length - 1];
        seg.position.copy(tail.position);
        seg.quaternion.copy(tail.quaternion);
    } else {
        seg.position.copy(runtime.snakeHead.position);
        const headFwd = pathTan.copy(DIR_FORWARD).applyAxisAngle(DIR_WORLD_UP, runtime.currentRotationY);
        seg.quaternion.setFromUnitVectors(BOX_LOCAL_FORWARD, headFwd.negate());
    }
    runtime.scene.add(seg);
    runtime.snakeSegments.push(seg);
}
