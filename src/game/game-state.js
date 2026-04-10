import { runtime } from './runtime.js';

export function isGameplayActive() {
    return runtime.gameActive && !runtime.gamePaused;
}

export function isMenuOpen() {
    return runtime.gamePaused || (!runtime.gameActive && !runtime.crashAnimating);
}

export function shouldOrbitMenuCamera() {
    return !runtime.hasStartedRunOnce && !runtime.gameActive && !runtime.gamePaused && !runtime.crashAnimating;
}
