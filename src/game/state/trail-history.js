import { distanceBetween, distanceSqBetween } from '../utils/math.js';

export function createTrailHistory({
    samePointEpsSq = 1e-14,
    compactThreshold = 512
} = {}) {
    let points = [];
    let start = 0;
    let arcLength = 0;

    function getLength() {
        return points.length - start;
    }

    function getPoint(index) {
        return points[start + index];
    }

    function reset() {
        points.length = 0;
        start = 0;
        arcLength = 0;
    }

    function compactIfNeeded() {
        if (start < compactThreshold) return;
        if (start * 2 <= points.length) return;
        points = points.slice(start);
        start = 0;
    }

    function append(headPos) {
        const len = getLength();
        if (len <= 0) {
            points.push(headPos.clone());
            return;
        }

        const newestIndex = start + len - 1;
        const newest = points[newestIndex];
        const newestDistSq = distanceSqBetween(newest, headPos);
        if (newestDistSq < samePointEpsSq) {
            if (len > 1) {
                const prev = points[newestIndex - 1];
                const oldLen = distanceBetween(newest, prev);
                newest.copy(headPos);
                const newLen = distanceBetween(newest, prev);
                arcLength += (newLen - oldLen);
            } else {
                newest.copy(headPos);
            }
            return;
        }

        points.push(headPos.clone());
        arcLength += Math.sqrt(newestDistSq);
    }

    function trimToArcLength(maxKeep) {
        while (getLength() > 2 && arcLength > maxKeep) {
            const oldest = getPoint(0);
            const nextOldest = getPoint(1);
            arcLength = Math.max(0, arcLength - distanceBetween(oldest, nextOldest));
            start++;
        }
        compactIfNeeded();
    }

    return {
        getLength,
        getPoint,
        reset,
        append,
        trimToArcLength
    };
}
