import * as THREE from 'three';
import {
    SNAKE_BURST_COUNT,
    SNAKE_BURST_LIFE_DECAY
} from '../config/crash.js';
import { SELF_HIT_TAIL_EXPLODE_STAGGER } from '../config/gameplay.js';
import { FOOD_EAT_BURST_COUNT, FOOD_COLOR, BODY_COLOR } from '../config/entities.js';
import { applyParticleGroundBounce } from './helpers.js';

export function createBurstSystem({ scene, crashSnakeBursts, tailExplosionQueue }) {
    function spawnSnakeBurst(worldPos, colorHex) {
        const count = SNAKE_BURST_COUNT;
        const pos = new Float32Array(count * 3);
        const vel = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            pos[i * 3] = worldPos.x + (Math.random() - 0.5) * 0.45;
            pos[i * 3 + 1] = worldPos.y + (Math.random() - 0.5) * 0.45;
            pos[i * 3 + 2] = worldPos.z + (Math.random() - 0.5) * 0.45;
            const s = 7 + Math.random() * 18;
            vel[i * 3] = (Math.random() - 0.5) * s;
            vel[i * 3 + 1] = 4 + Math.random() * 14;
            vel[i * 3 + 2] = (Math.random() - 0.5) * s;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const mat = new THREE.PointsMaterial({
            color: colorHex,
            size: 0.12,
            transparent: true,
            opacity: 0.98,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            sizeAttenuation: true
        });
        const mesh = new THREE.Points(geo, mat);
        scene.add(mesh);
        crashSnakeBursts.push({ mesh, vel, count, life: 1 });
    }

    function spawnFoodBurst(worldPos) {
        const count = FOOD_EAT_BURST_COUNT;
        const pos = new Float32Array(count * 3);
        const vel = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            pos[i * 3] = worldPos.x + (Math.random() - 0.5) * 0.3;
            pos[i * 3 + 1] = worldPos.y + (Math.random() - 0.5) * 0.3;
            pos[i * 3 + 2] = worldPos.z + (Math.random() - 0.5) * 0.3;
            const s = 6 + Math.random() * 10;
            vel[i * 3] = (Math.random() - 0.5) * s;
            vel[i * 3 + 1] = 3 + Math.random() * 8;
            vel[i * 3 + 2] = (Math.random() - 0.5) * s;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const mat = new THREE.PointsMaterial({
            color: FOOD_COLOR,
            size: 0.1,
            transparent: true,
            opacity: 0.98,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            sizeAttenuation: true
        });
        const mesh = new THREE.Points(geo, mat);
        scene.add(mesh);
        crashSnakeBursts.push({ mesh, vel, count, life: 0.85 });
    }

    function queueTailExplosionTrail(worldPositions, colorHex = BODY_COLOR) {
        if (!worldPositions || worldPositions.length === 0) return;
        for (let i = 0; i < worldPositions.length; i++) {
            const pos = worldPositions[i];
            if (!pos) continue;
            tailExplosionQueue.push({
                worldPos: pos.clone(),
                colorHex,
                wait: tailExplosionQueue.length === 0 ? 0 : SELF_HIT_TAIL_EXPLODE_STAGGER
            });
        }
    }

    function updateTailExplosionTrail(delta) {
        let remaining = delta;
        while (remaining > 0 && tailExplosionQueue.length > 0) {
            const next = tailExplosionQueue[0];
            if (next.wait > remaining) {
                next.wait -= remaining;
                break;
            }
            remaining -= next.wait;
            tailExplosionQueue.shift();
            spawnSnakeBurst(next.worldPos, next.colorHex);
        }
    }

    function updateSnakeBursts(delta) {
        for (let j = crashSnakeBursts.length - 1; j >= 0; j--) {
            const b = crashSnakeBursts[j];
            const arr = b.mesh.geometry.attributes.position.array;
            for (let i = 0; i < b.count; i++) {
                const ix = i * 3;
                arr[ix] += b.vel[ix] * delta;
                arr[ix + 1] += b.vel[ix + 1] * delta;
                arr[ix + 2] += b.vel[ix + 2] * delta;
                b.vel[ix + 1] -= 22 * delta;
                b.vel[ix] *= 0.992;
                b.vel[ix + 2] *= 0.992;
            }
            applyParticleGroundBounce(arr, b.vel, b.count, 0);
            b.mesh.geometry.attributes.position.needsUpdate = true;
            b.life -= delta * SNAKE_BURST_LIFE_DECAY;
            b.mesh.material.opacity = Math.max(0, b.life);
            if (b.life <= 0) {
                scene.remove(b.mesh);
                b.mesh.geometry.dispose();
                b.mesh.material.dispose();
                crashSnakeBursts.splice(j, 1);
            }
        }
    }

    return {
        spawnSnakeBurst,
        spawnFoodBurst,
        queueTailExplosionTrail,
        updateTailExplosionTrail,
        updateSnakeBursts
    };
}
