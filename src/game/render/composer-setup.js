import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SubtleBoostMotionBlurShader } from '../../render/shaders/subtle-boost-motion-blur.js';
import { runtime } from '../runtime.js';

export function setupComposer() {
    runtime.composer = new EffectComposer(runtime.renderer);
    runtime.composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    runtime.composer.addPass(new RenderPass(runtime.scene, runtime.camera));
    runtime.motionBlurPass = new ShaderPass(SubtleBoostMotionBlurShader);
    runtime.motionBlurPass.uniforms.strength.value = 0;
    runtime.composer.addPass(runtime.motionBlurPass);
    runtime.composer.addPass(new OutputPass());
}
