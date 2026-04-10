export function formatGameTime(seconds) {
    const whole = Math.max(0, Math.ceil(seconds));
    const mm = Math.floor(whole / 60);
    const ss = whole % 60;
    return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}
