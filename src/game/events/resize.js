import { runtime } from '../runtime.js';
import { enforceRotationPlayGate } from '../platform/rotation-gate.js';
import { updatePointerHint, updateTouchControlsUi } from '../ui/overlay.js';

export function onResize() {
    runtime.camera.aspect = window.innerWidth / window.innerHeight;
    runtime.camera.updateProjectionMatrix();
    runtime.renderer.setSize(window.innerWidth, window.innerHeight);
    if (runtime.composer) {
        runtime.composer.setSize(window.innerWidth, window.innerHeight);
        runtime.composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }
    if (runtime.wallEdgeMaterials.length > 0) {
        const rw = window.innerWidth;
        const rh = window.innerHeight;
        for (let i = 0; i < runtime.wallEdgeMaterials.length; i++) {
            runtime.wallEdgeMaterials[i].resolution.set(rw, rh);
        }
    } else if (runtime.wallEdgeMaterial) {
        runtime.wallEdgeMaterial.resolution.set(window.innerWidth, window.innerHeight);
    }
    if (runtime.floorGridMaterials.length > 0) {
        const rw = window.innerWidth;
        const rh = window.innerHeight;
        for (let i = 0; i < runtime.floorGridMaterials.length; i++) {
            runtime.floorGridMaterials[i].resolution.set(rw, rh);
        }
    }
    if (runtime.crashVfxRoot && runtime.crashVfxRoot.userData.fatLineMaterials) {
        const rw = window.innerWidth;
        const rh = window.innerHeight;
        runtime.crashVfxRoot.userData.fatLineMaterials.forEach(m => m.resolution.set(rw, rh));
    }
    enforceRotationPlayGate();
    updatePointerHint();
    updateTouchControlsUi();
}
