export function createSfx() {
    let ctx = null;
    let enabled = true;
    let musicEnabled = true;
    let bgmMode = 'off';
    let activeBgmMode = 'off';
    let bgmLoadPromise = null;
    let bgmGain = null;
    let timeChillActive = false;
    let timeChillPhase = 'idle';
    let boostActive = false;
    const MUTE_GAME_BGM = true;
    const MUTE_MENU_BGM = false;
    const bgmBuffers = {
        game: null,
        menu: null
    };
    const bgmSources = {
        game: null,
        menu: null
    };

    const BGM_VOLUME = 0.5;
    const DEATH_VOLUME = 0.4;
    const FOOD_VOLUME = 0.3;
    const BOUNCE_VOLUME = 0.4;
    const TIMECHILL_VOLUME = 0.45;
    const BOOST_VOLUME = 0.4;
    const HURT_VOLUME = 0.45;

    function createTrack(path, { loop = false, volume = 1 } = {}) {
        const track = new Audio(new URL(path, import.meta.url));
        track.loop = loop;
        track.preload = 'auto';
        track.volume = volume;
        track.load();
        return track;
    }

    // Eagerly load all file-backed game sounds on startup.
    const deathSfx = createTrack('../assets/death.mp3', { volume: DEATH_VOLUME });
    const foodSfx = createTrack('../assets/food.mp3', { volume: FOOD_VOLUME });
    const bounceSfx = createTrack('../assets/bounce.mp3', { volume: BOUNCE_VOLUME });
    const boostSfx = createTrack('../assets/boost-1.mp3', { volume: BOOST_VOLUME });
    const hurtSfx = createTrack('../assets/hurt.mp3', { volume: HURT_VOLUME });
    const slow1aSfx = createTrack('../assets/slow-1-a.mp3', { volume: TIMECHILL_VOLUME });
    const slow1bSfx = createTrack('../assets/slow-1-b.mp3', { loop: true, volume: TIMECHILL_VOLUME });
    const slow1cSfx = createTrack('../assets/slow-1-c.mp3', { volume: TIMECHILL_VOLUME });

    slow1aSfx.addEventListener('ended', () => {
        if (!enabled || !timeChillActive || timeChillPhase !== 'a') return;
        timeChillPhase = 'b';
        slow1bSfx.currentTime = 0;
        const p = slow1bSfx.play();
        if (p && typeof p.catch === 'function') {
            p.catch(() => {
                // Browser may block playback until a user gesture.
            });
        }
    });

    slow1cSfx.addEventListener('ended', () => {
        if (!timeChillActive) timeChillPhase = 'idle';
    });

    function ensureCtx() {
        if (!ctx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return null;
            ctx = new AC();
        }
        return ctx;
    }

    function ensureBgmGainNode() {
        const c = ensureCtx();
        if (!c) return null;
        if (!bgmGain) {
            bgmGain = c.createGain();
            bgmGain.gain.value = BGM_VOLUME;
            bgmGain.connect(c.destination);
        }
        return bgmGain;
    }

    function stopBgmSource(mode) {
        const src = bgmSources[mode];
        if (!src) return;
        try {
            src.stop();
        } catch (_) {
            // Already ended/stopped.
        }
        src.disconnect();
        bgmSources[mode] = null;
    }

    function stopAllBgmSources() {
        stopBgmSource('game');
        stopBgmSource('menu');
    }

    async function ensureBgmBuffers() {
        if (bgmBuffers.game && bgmBuffers.menu) return;
        if (bgmLoadPromise) {
            await bgmLoadPromise;
            return;
        }
        const c = ensureCtx();
        if (!c) return;

        bgmLoadPromise = (async () => {
            const [gameRes, menuRes] = await Promise.all([
                fetch(new URL('../assets/bgm-2.mp3', import.meta.url)),
                fetch(new URL('../assets/main-menu-bgm.mp3', import.meta.url))
            ]);
            const [gameData, menuData] = await Promise.all([
                gameRes.arrayBuffer(),
                menuRes.arrayBuffer()
            ]);
            // Safari may detach the underlying buffer during decode; pass a copy.
            const [gameBuf, menuBuf] = await Promise.all([
                c.decodeAudioData(gameData.slice(0)),
                c.decodeAudioData(menuData.slice(0))
            ]);
            bgmBuffers.game = gameBuf;
            bgmBuffers.menu = menuBuf;
        })();

        try {
            await bgmLoadPromise;
        } finally {
            bgmLoadPromise = null;
        }
    }

    function startBgmSource(mode) {
        const c = ensureCtx();
        const gainNode = ensureBgmGainNode();
        const buffer = bgmBuffers[mode];
        if (!c || !gainNode || !buffer) return false;

        const src = c.createBufferSource();
        src.buffer = buffer;
        src.loop = true;
        src.connect(gainNode);
        src.start(0);
        bgmSources[mode] = src;
        return true;
    }

    function syncBgmPlayback() {
        let targetMode = (enabled && musicEnabled)
            ? (bgmMode === 'game' || bgmMode === 'menu' ? bgmMode : 'off')
            : 'off';
        if ((targetMode === 'game' && MUTE_GAME_BGM) || (targetMode === 'menu' && MUTE_MENU_BGM)) {
            targetMode = 'off';
        }

        if (targetMode === 'off') {
            stopAllBgmSources();
            activeBgmMode = 'off';
            return;
        }

        const c = ensureCtx();
        if (!c || c.state !== 'running') return;
        if (!bgmBuffers.game || !bgmBuffers.menu) {
            ensureBgmBuffers()
                .then(() => {
                    syncBgmPlayback();
                })
                .catch(() => {
                    // Keep game running even if BGM loading fails.
                });
            return;
        }

        if (activeBgmMode === targetMode && bgmSources[targetMode]) return;
        stopAllBgmSources();
        if (startBgmSource(targetMode)) {
            activeBgmMode = targetMode;
        }
    }

    // Eagerly pull BGM from disk/network so playback can start without loop gaps later.
    ensureBgmBuffers().catch(() => {
        // Keep running if preload fails; unlock()/mode changes can retry.
    });

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
        syncBgmPlayback();
    }

    function setTimeChillActive(active) {
        const next = !!active;
        if (next === timeChillActive) return;
        timeChillActive = next;

        if (next) {
            slow1cSfx.pause();
            slow1cSfx.currentTime = 0;
            slow1bSfx.pause();
            slow1bSfx.currentTime = 0;
            timeChillPhase = 'a';
            if (!enabled) return;
            slow1aSfx.currentTime = 0;
            const p = slow1aSfx.play();
            if (p && typeof p.catch === 'function') {
                p.catch(() => {
                    // Browser may block playback until a user gesture.
                });
            }
            return;
        }

        slow1aSfx.pause();
        slow1aSfx.currentTime = 0;
        slow1bSfx.pause();
        slow1bSfx.currentTime = 0;
        timeChillPhase = 'c';
        if (!enabled) {
            timeChillPhase = 'idle';
            return;
        }
        slow1cSfx.currentTime = 0;
        const p = slow1cSfx.play();
        if (p && typeof p.catch === 'function') {
            p.catch(() => {
                // Browser may block playback until a user gesture.
            });
        }
    }

    function setBoostActive(active) {
        const next = !!active;
        if (next === boostActive) return;
        boostActive = next;
        if (!next || !enabled) return;
        boostSfx.currentTime = 0;
        const p = boostSfx.play();
        if (p && typeof p.catch === 'function') {
            p.catch(() => {
                // Browser may block playback until a user gesture.
            });
        }
    }

    function setEnabled(v) {
        enabled = !!v;
        if (!enabled) {
            slow1aSfx.pause();
            slow1bSfx.pause();
            slow1cSfx.pause();
        } else if (timeChillActive) {
            if (timeChillPhase === 'a') {
                const p = slow1aSfx.play();
                if (p && typeof p.catch === 'function') p.catch(() => {});
            } else if (timeChillPhase === 'b') {
                const p = slow1bSfx.play();
                if (p && typeof p.catch === 'function') p.catch(() => {});
            }
        }
        syncBgmPlayback();
    }

    function isEnabled() {
        return enabled;
    }

    function setMusicEnabled(v) {
        musicEnabled = !!v;
        syncBgmPlayback();
    }

    function isMusicEnabled() {
        return musicEnabled;
    }

    function setBgmMode(mode) {
        const nextMode = (mode === 'game' || mode === 'menu') ? mode : 'off';
        if (nextMode === bgmMode) return;
        bgmMode = nextMode;
        syncBgmPlayback();
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

    function death() {
        if (!enabled) return;
        const track = deathSfx;
        track.currentTime = 0;
        const p = track.play();
        if (p && typeof p.catch === 'function') {
            p.catch(() => {
                // Browser may block playback until a user gesture.
            });
        }
    }

    function bounce() {
        if (!enabled) return;
        const track = bounceSfx;
        track.currentTime = 0;
        const p = track.play();
        if (p && typeof p.catch === 'function') {
            p.catch(() => {
                // Browser may block playback until a user gesture.
            });
        }
    }

    return {
        unlock,
        setEnabled,
        isEnabled,
        setMusicEnabled,
        isMusicEnabled,
        setBgmMode,
        setTimeChillActive,
        setBoostActive,
        menuMove() { blip({ freq: 560, dur: 0.05, type: 'triangle', gain: 0.03, slide: 1.08 }); },
        menuSelect() { blip({ freq: 760, dur: 0.11, type: 'square', gain: 0.045, slide: 1.35 }); },
        eat() {
            if (!enabled) return;
            const track = foodSfx;
            track.currentTime = 0;
            const p = track.play();
            if (p && typeof p.catch === 'function') {
                p.catch(() => {
                    // Browser may block playback until a user gesture.
                });
            }
        },
        hit() { blip({ freq: 180, dur: 0.12, type: 'sawtooth', gain: 0.045, slide: 0.72 }); },
        selfHit() {
            if (!enabled) return;
            hurtSfx.currentTime = 0;
            const p = hurtSfx.play();
            if (p && typeof p.catch === 'function') {
                p.catch(() => {
                    // Browser may block playback until a user gesture.
                });
            }
        },
        bounce,
        death,
        crash() {
            blip({ freq: 120, dur: 0.24, type: 'sawtooth', gain: 0.07, slide: 0.42 });
            blip({ freq: 70, dur: 0.3, type: 'square', gain: 0.06, slide: 0.35 });
        }
    };
}
