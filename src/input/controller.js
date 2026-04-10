const GAMEPAD_STICK_DEADZONE = 0.18;
const GAMEPAD_TRIGGER_DEADZONE = 0.2;
const GAMEPAD_AXIS_TURN_GAIN = 1.15;

export function createInputController({
    isGameActive,
    isMobileDevice,
    isPointerLocked,
    requestPointerLock,
    onMouseTurn,
    onPointerHintChange,
    isUiTargetBlocked,
    onRestartRequest,
    touchTurnSensitivity = 1,
    touchTurnDeadzone = 0.08,
    touchSpeedSensitivity = 1,
    touchSpeedDeadzone = 0.08
}) {
    const state = {
        left: false,
        right: false,
        mouseAccel: false,
        mouseBrake: false,
        gamepadTurnAxis: 0,
        gamepadAccel: false,
        gamepadBrake: false,
        touchTurnAxis: 0
    };

    let heldMouseButtons = 0;
    let lastMouseDownButton = 0;
    let activeGamepadIndex = null;
    let restartHeld = false;
    const turnTouches = new Map();
    const speedTouches = new Map();
    const touchPointerPad = new Map();

    function isMobileNow() {
        return typeof isMobileDevice === 'function' ? !!isMobileDevice() : false;
    }

    function turnAxisFromPointerEvent(e) {
        const halfW = Math.max(1, window.innerWidth * 0.5);
        const raw = ((window.innerWidth * 0.25) - e.clientX) / halfW;
        const scaled = Math.max(-1, Math.min(1, raw * touchTurnSensitivity));
        return Math.abs(scaled) < touchTurnDeadzone ? 0 : scaled;
    }

    function speedAxisFromPointerEvent(e) {
        const halfH = Math.max(1, window.innerHeight * 0.5);
        const raw = ((window.innerHeight * 0.5) - e.clientY) / halfH;
        const scaled = Math.max(-1, Math.min(1, raw * touchSpeedSensitivity));
        return Math.abs(scaled) < touchSpeedDeadzone ? 0 : scaled;
    }

    function updateTouchControlState() {
        let touchTurnAxis = 0;
        for (const axis of turnTouches.values()) {
            if (Math.abs(axis) > Math.abs(touchTurnAxis)) touchTurnAxis = axis;
        }
        state.touchTurnAxis = touchTurnAxis;

        let touchSpeedAxis = 0;
        for (const axis of speedTouches.values()) {
            if (Math.abs(axis) > Math.abs(touchSpeedAxis)) touchSpeedAxis = axis;
        }
        state.mouseAccel = touchSpeedAxis > 0;
        state.mouseBrake = touchSpeedAxis < 0;
    }

    function readGamepadButtonValue(gamepad, index) {
        if (!gamepad || !gamepad.buttons || index >= gamepad.buttons.length) return 0;
        const b = gamepad.buttons[index];
        if (!b) return 0;
        if (typeof b === 'number') return b;
        if (typeof b.value === 'number') return b.value;
        return b.pressed ? 1 : 0;
    }

    function selectActiveGamepad(gamepads) {
        if (activeGamepadIndex != null) {
            const current = gamepads[activeGamepadIndex];
            if (current && current.connected) return current;
        }
        activeGamepadIndex = null;
        for (let i = 0; i < gamepads.length; i++) {
            const gp = gamepads[i];
            if (gp && gp.connected) {
                activeGamepadIndex = gp.index;
                return gp;
            }
        }
        return null;
    }

    function applyHeldButtonsToMouseInput() {
        if (!isGameActive() || !isPointerLocked()) return;
        if (heldMouseButtons === 0) {
            state.mouseAccel = false;
            state.mouseBrake = false;
        } else if (heldMouseButtons === 3) {
            if (lastMouseDownButton === 0) {
                state.mouseAccel = true;
                state.mouseBrake = false;
            } else {
                state.mouseBrake = true;
                state.mouseAccel = false;
            }
        } else if (heldMouseButtons & 1) {
            state.mouseAccel = true;
            state.mouseBrake = false;
        } else {
            state.mouseBrake = true;
            state.mouseAccel = false;
        }
    }

    function onKeyDown(e) {
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') state.left = true;
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') state.right = true;
    }

    function onKeyUp(e) {
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') state.left = false;
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') state.right = false;
    }

    function onPointerLockChange() {
        if (!isPointerLocked()) {
            heldMouseButtons = 0;
            state.mouseAccel = false;
            state.mouseBrake = false;
        }
        onPointerHintChange();
    }

    function onMouseMove(e) {
        if (isMobileNow()) {
            if (touchPointerPad.has(e.pointerId)) {
                const pad = touchPointerPad.get(e.pointerId);
                if (pad === 'turn') {
                    turnTouches.set(e.pointerId, turnAxisFromPointerEvent(e));
                } else if (pad === 'speed') {
                    speedTouches.set(e.pointerId, speedAxisFromPointerEvent(e));
                }
                updateTouchControlState();
            }
            if (e.cancelable) e.preventDefault();
            return;
        }
        if (!isGameActive() || !isPointerLocked()) return;
        const mask = e.buttons & 3;
        if (mask !== heldMouseButtons) {
            const prev = heldMouseButtons;
            if (mask === 3 && prev === 2) lastMouseDownButton = 0;
            else if (mask === 3 && prev === 1) lastMouseDownButton = 2;
            heldMouseButtons = mask;
            applyHeldButtonsToMouseInput();
        }
        if (e.movementX !== 0) onMouseTurn(e.movementX);
    }

    function onPointerDown(e) {
        if (!isGameActive()) return;
        if (isMobileNow()) {
            if (isUiTargetBlocked(e.target)) return;
            const turnZone = e.clientX < (window.innerWidth * 0.5);
            if (turnZone) {
                touchPointerPad.set(e.pointerId, 'turn');
                turnTouches.set(e.pointerId, turnAxisFromPointerEvent(e));
            } else {
                touchPointerPad.set(e.pointerId, 'speed');
                speedTouches.set(e.pointerId, speedAxisFromPointerEvent(e));
            }
            updateTouchControlState();
            if (e.cancelable) e.preventDefault();
            return;
        }
        if (!isPointerLocked()) {
            if (e.button === 0) requestPointerLock();
            return;
        }
        if (isUiTargetBlocked(e.target)) return;
        if (e.button !== 0 && e.button !== 2) return;
        lastMouseDownButton = e.button;
        heldMouseButtons = e.buttons & 3;
        if (e.button === 2) e.preventDefault();
        applyHeldButtonsToMouseInput();
    }

    function onPointerUp(e) {
        if (isMobileNow() && touchPointerPad.has(e.pointerId)) {
            const pad = touchPointerPad.get(e.pointerId);
            if (pad === 'turn') turnTouches.delete(e.pointerId);
            if (pad === 'speed') speedTouches.delete(e.pointerId);
            touchPointerPad.delete(e.pointerId);
            updateTouchControlState();
            if (e.cancelable) e.preventDefault();
            return;
        }
        if (e.button !== 0 && e.button !== 2) return;
        heldMouseButtons = e.buttons & 3;
        applyHeldButtonsToMouseInput();
    }

    function onPointerCancel(e) {
        if (isMobileNow() && touchPointerPad.has(e.pointerId)) {
            const pad = touchPointerPad.get(e.pointerId);
            if (pad === 'turn') turnTouches.delete(e.pointerId);
            if (pad === 'speed') speedTouches.delete(e.pointerId);
            touchPointerPad.delete(e.pointerId);
            updateTouchControlState();
            if (e.cancelable) e.preventDefault();
        }
    }

    function onContextMenu(e) {
        e.preventDefault();
    }

    function onTouchPadGesture(e) {
        if (!isMobileNow()) return;
        if (e.cancelable) e.preventDefault();
    }

    function onGamepadConnected(e) {
        if (activeGamepadIndex == null) activeGamepadIndex = e.gamepad.index;
    }

    function onGamepadDisconnected(e) {
        if (activeGamepadIndex === e.gamepad.index) activeGamepadIndex = null;
        updateGamepadInput();
    }

    function attach() {
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        document.addEventListener('pointerlockchange', onPointerLockChange);
        document.addEventListener('pointermove', onMouseMove);
        window.addEventListener('pointerdown', onPointerDown, true);
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('pointercancel', onPointerCancel);
        window.addEventListener('touchstart', onTouchPadGesture, { capture: true, passive: false });
        window.addEventListener('touchmove', onTouchPadGesture, { capture: true, passive: false });
        window.addEventListener('contextmenu', onContextMenu);
        window.addEventListener('gamepadconnected', onGamepadConnected);
        window.addEventListener('gamepaddisconnected', onGamepadDisconnected);
    }

    function reset() {
        state.left = false;
        state.right = false;
        state.mouseAccel = false;
        state.mouseBrake = false;
        state.gamepadTurnAxis = 0;
        state.gamepadAccel = false;
        state.gamepadBrake = false;
        state.touchTurnAxis = 0;
        heldMouseButtons = 0;
        lastMouseDownButton = 0;
        turnTouches.clear();
        speedTouches.clear();
        touchPointerPad.clear();
    }

    function updateGamepadInput() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = selectActiveGamepad(pads || []);
        if (!gp) {
            state.gamepadTurnAxis = 0;
            state.gamepadAccel = false;
            state.gamepadBrake = false;
            restartHeld = false;
            return;
        }

        const restartPressed = (
            readGamepadButtonValue(gp, 7) > GAMEPAD_TRIGGER_DEADZONE || // RT
            readGamepadButtonValue(gp, 0) > 0.5                         // A/Cross
        );
        if (restartPressed && !restartHeld && !isGameActive() && typeof onRestartRequest === 'function') {
            onRestartRequest();
        }
        restartHeld = restartPressed;

        const stickX = gp.axes && gp.axes.length > 0 ? gp.axes[0] : 0;
        const leftPressed = readGamepadButtonValue(gp, 14) > 0.5;
        const rightPressed = readGamepadButtonValue(gp, 15) > 0.5;
        let turn = 0;
        if (Math.abs(stickX) >= GAMEPAD_STICK_DEADZONE) {
            turn += -stickX * GAMEPAD_AXIS_TURN_GAIN;
        }
        if (leftPressed) turn += 1;
        if (rightPressed) turn -= 1;
        state.gamepadTurnAxis = Math.max(-1, Math.min(1, turn));

        const accelStrength = Math.max(
            readGamepadButtonValue(gp, 7),
            readGamepadButtonValue(gp, 5),
            readGamepadButtonValue(gp, 0)
        );
        const brakeStrength = Math.max(
            readGamepadButtonValue(gp, 6),
            readGamepadButtonValue(gp, 4),
            readGamepadButtonValue(gp, 1)
        );
        if (accelStrength > GAMEPAD_TRIGGER_DEADZONE && brakeStrength > GAMEPAD_TRIGGER_DEADZONE) {
            state.gamepadAccel = accelStrength >= brakeStrength;
            state.gamepadBrake = brakeStrength > accelStrength;
        } else {
            state.gamepadAccel = accelStrength > GAMEPAD_TRIGGER_DEADZONE;
            state.gamepadBrake = brakeStrength > GAMEPAD_TRIGGER_DEADZONE;
        }
    }

    return {
        state,
        attach,
        reset,
        updateGamepadInput
    };
}
