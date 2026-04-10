export function createDeathReplayState() {
    return {
        frames: [],
        eventsByFrame: new Map(),
        captureAccumulator: 0,
        playbackAccumulator: 0,
        active: false,
        frameIndex: 0
    };
}

export function clearDeathReplayState(state) {
    state.frames.length = 0;
    state.eventsByFrame.clear();
    state.captureAccumulator = 0;
    state.playbackAccumulator = 0;
    state.active = false;
    state.frameIndex = 0;
}

export function recordDeathReplayEventState(state, type, data = null) {
    const frameIndex = Math.max(0, state.frames.length - 1);
    let bucket = state.eventsByFrame.get(frameIndex);
    if (!bucket) {
        bucket = [];
        state.eventsByFrame.set(frameIndex, bucket);
    }
    bucket.push({ type, data });
}

export function captureDeathReplayFrameState(state, {
    snakeHead,
    snakeSegments,
    currentRotationY,
    food,
    foodFloatBaseY
}) {
    if (!snakeHead) return;
    const segCount = snakeSegments.length;
    const segPos = new Float32Array(segCount * 3);
    const segQuat = new Float32Array(segCount * 4);
    for (let i = 0; i < segCount; i++) {
        const s = snakeSegments[i];
        const p = s.position;
        const q = s.quaternion;
        const pIdx = i * 3;
        const qIdx = i * 4;
        segPos[pIdx] = p.x;
        segPos[pIdx + 1] = p.y;
        segPos[pIdx + 2] = p.z;
        segQuat[qIdx] = q.x;
        segQuat[qIdx + 1] = q.y;
        segQuat[qIdx + 2] = q.z;
        segQuat[qIdx + 3] = q.w;
    }
    state.frames.push({
        hx: snakeHead.position.x,
        hy: snakeHead.position.y,
        hz: snakeHead.position.z,
        ry: currentRotationY,
        fx: food ? food.position.x : 0,
        fy: food ? food.position.y : foodFloatBaseY,
        fz: food ? food.position.z : 0,
        segPos,
        segQuat
    });
}

export function startDeathReplayState(state, { applyFrame, playEvents }) {
    state.active = state.frames.length > 1;
    state.frameIndex = 0;
    state.playbackAccumulator = 0;
    if (!state.active) return;
    applyFrame(state.frames[0]);
    playEvents(0);
}

export function updateDeathReplayState(state, delta, {
    captureFps,
    playbackSpeed,
    applyFrame,
    playEvents
}) {
    if (!state.active || state.frames.length < 2) return;
    state.playbackAccumulator += delta * captureFps * playbackSpeed;
    while (state.playbackAccumulator >= 1) {
        state.playbackAccumulator -= 1;
        state.frameIndex = (state.frameIndex + 1) % state.frames.length;
        playEvents(state.frameIndex);
    }
    applyFrame(state.frames[state.frameIndex]);
}
