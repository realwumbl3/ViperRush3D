export const SubtleBoostMotionBlurShader = {
    uniforms: {
        tDiffuse: { value: null },
        strength: { value: 0 }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float strength;
        varying vec2 vUv;
        void main() {
            vec4 sharp = texture2D(tDiffuse, vUv);
            if (strength < 0.001) {
                gl_FragColor = sharp;
            } else {
                vec2 d = vUv - 0.5;
                float L = length(d);
                vec2 dir = L > 0.0001 ? d / L : vec2(1.0, 0.0);
                float stepUv = 0.0032 + strength * 0.016;
                vec4 acc = vec4(0.0);
                float wsum = 0.0;
                for (int i = -2; i <= 2; i++) {
                    float fi = float(i);
                    float w = 1.0 - abs(fi) * 0.18;
                    vec2 uv = vUv - dir * fi * stepUv;
                    acc += texture2D(tDiffuse, uv) * w;
                    wsum += w;
                }
                acc /= wsum;
                float mixAmt = clamp(strength * 0.45, 0.0, 0.26);
                gl_FragColor = mix(sharp, acc, mixAmt);
            }
        }
    `
};
