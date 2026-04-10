export function getSavedHighScore(storageKey) {
    const raw = localStorage.getItem(storageKey);
    if (raw == null) return 0;
    const val = parseInt(raw, 10);
    return Number.isFinite(val) && val > 0 ? val : 0;
}

export function saveHighScoreIfNeeded(storageKey, value) {
    const current = getSavedHighScore(storageKey);
    const next = Math.max(current, Math.max(0, Math.floor(value)));
    if (next !== current) localStorage.setItem(storageKey, String(next));
    return next;
}
