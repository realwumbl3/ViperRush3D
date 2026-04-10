import {
    BODY_SEGMENT_SPACING,
    TRAIL_PATH_MARGIN,
    DIR_FORWARD,
    DIR_WORLD_UP,
    BOX_LOCAL_FORWARD
} from '../config/entities.js';
import { runtime } from '../runtime.js';
import { pathEdge, pathPos, pathTan } from '../scratch.js';
import { createGameBodySegmentModel } from '../models/body-segment.js';

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
        disposeObject3d(seg);
    }
    runtime.snakeSegments = [];
}

export function ensureSnakeSegmentCount(targetCount) {
    while (runtime.snakeSegments.length < targetCount) addSegment();
    while (runtime.snakeSegments.length > targetCount) {
        const seg = runtime.snakeSegments.pop();
        if (!seg) break;
        runtime.scene.remove(seg);
        disposeObject3d(seg);
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

export function addSegment() {
    const seg = createGameBodySegmentModel().mesh;

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
