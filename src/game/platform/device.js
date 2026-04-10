import { ROTATE_BLOCK_MAX_WIDTH } from '../config/menu.js';

export function isMobilePhoneLike() {
    const ua = navigator.userAgent || '';
    const touchPoints = navigator.maxTouchPoints || 0;
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const hasTouchApi = ('ontouchstart' in window) || touchPoints > 0;
    return (
        /Android|iPhone|iPad|iPod|Mobile/i.test(ua) ||
        (hasTouchApi && coarse) ||
        touchPoints > 1
    );
}

export function isRotationPlayBlocked() {
    if (!isMobilePhoneLike()) return false;
    if (window.matchMedia) {
        return window.matchMedia('(orientation: portrait)').matches && window.innerWidth <= ROTATE_BLOCK_MAX_WIDTH;
    }
    return window.innerHeight > window.innerWidth && window.innerWidth <= ROTATE_BLOCK_MAX_WIDTH;
}
