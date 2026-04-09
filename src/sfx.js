export function createSfx() {
    let ctx = null;
    let enabled = true;

    function ensureCtx() {
        if (!ctx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return null;
            ctx = new AC();
        }
        return ctx;
    }

    async function unlock() {
        const c = ensureCtx();
        if (!c) return;
        if (c.state === 'suspended') {
            try {
                await c.resume();
            } catch (_) {
                // Ignore; browser may block until further user gesture.
            }
        }
    }

    function setEnabled(v) {
        enabled = !!v;
    }

    function isEnabled() {
        return enabled;
    }

    function blip({ freq = 440, dur = 0.08, type = 'square', gain = 0.04, slide = 0.75 }) {
        if (!enabled) return;
        const c = ensureCtx();
        if (!c || c.state !== 'running') return;

        const now = c.currentTime;
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), now + dur);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(gain, now + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
        osc.connect(g);
        g.connect(c.destination);
        osc.start(now);
        osc.stop(now + dur + 0.01);
    }

    return {
        unlock,
        setEnabled,
        isEnabled,
        menuMove() { blip({ freq: 560, dur: 0.05, type: 'triangle', gain: 0.03, slide: 1.08 }); },
        menuSelect() { blip({ freq: 760, dur: 0.11, type: 'square', gain: 0.045, slide: 1.35 }); },
        eat() { blip({ freq: 920, dur: 0.07, type: 'sine', gain: 0.04, slide: 1.4 }); },
        hit() { blip({ freq: 180, dur: 0.12, type: 'sawtooth', gain: 0.045, slide: 0.72 }); },
        selfHit() {
            blip({ freq: 220, dur: 0.12, type: 'sawtooth', gain: 0.055, slide: 0.68 });
            blip({ freq: 130, dur: 0.16, type: 'square', gain: 0.05, slide: 0.5 });
        },
        crash() {
            blip({ freq: 120, dur: 0.24, type: 'sawtooth', gain: 0.07, slide: 0.42 });
            blip({ freq: 70, dur: 0.3, type: 'square', gain: 0.06, slide: 0.35 });
        }
    };
}
