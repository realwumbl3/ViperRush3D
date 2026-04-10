import { runtime } from '../runtime.js';
import { isGameplayActive } from '../game-state.js';
import { isRotationPlayBlocked } from './device.js';
import { pauseGame } from '../pause.js';

export function enforceRotationPlayGate() {
    if (!isRotationPlayBlocked()) return;
    runtime.inputController?.reset();
    if (isGameplayActive()) pauseGame();
}
