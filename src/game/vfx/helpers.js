import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { distanceBetween } from '../utils/math.js';
import {
    PARTICLE_FLOOR_Y,
    PARTICLE_BOUNCE_RESTITUTION,
    PARTICLE_BOUNCE_FRICTION,
    PARTICLE_BOUNCE_SLEEP_VY
} from '../config/crash.js';

export function computeCumulativeArcLengths(points) {
    const n = points.length;
    const cum = new Array(n);
    cum[0] = 0;
    for (let i = 1; i < n; i++) {
        cum[i] = cum[i - 1] + distanceBetween(points[i], points[i - 1]);
    }
    return cum;
}

export function slicePolylineByArcLength(points, cum, maxArc) {
    const n = points.length;
    if (n === 0) return [];
    if (n === 1) {
        const p0 = points[0].clone();
        const p1 = p0.clone();
        p1.y += 0.008;
        return [p0, p1];
    }
    if (maxArc <= 1e-7) {
        const p0 = points[0].clone();
        const p1 = points[1].clone().lerp(points[0], 0.12);
        return [p0, p1];
    }
    const total = cum[n - 1];
    if (maxArc >= total - 1e-7) {
        const out = [];
        for (let i = 0; i < n; i++) out.push(points[i].clone());
        return out;
    }
    const out = [points[0].clone()];
    for (let i = 1; i < n; i++) {
        if (cum[i] <= maxArc) {
            out.push(points[i].clone());
        } else {
            const prev = cum[i - 1];
            const seg = cum[i] - prev;
            const t = seg > 1e-8 ? (maxArc - prev) / seg : 1;
            out.push(new THREE.Vector3().lerpVectors(points[i - 1], points[i], Math.max(0, Math.min(1, t))));
            break;
        }
    }
    if (out.length < 2) {
        const b = points[1].clone().lerp(points[0], 0.18);
        return [points[0].clone(), b];
    }
    return out;
}

export function applyFatLinePositions(line, geo, points) {
    if (points.length < 2) return;
    const flat = [];
    for (let i = 0; i < points.length; i++) {
        flat.push(points[i].x, points[i].y, points[i].z);
    }
    geo.setPositions(flat);
    line.computeLineDistances();
    if (geo.computeBoundingSphere) geo.computeBoundingSphere();
}

export function makeCrackLineMaterial(colorHex, opacity, linewidthWorld) {
    const mat = new LineMaterial({
        color: colorHex,
        linewidth: linewidthWorld,
        worldUnits: true,
        transparent: true,
        opacity,
        depthWrite: false,
        depthTest: false
    });
    mat.resolution.set(window.innerWidth, window.innerHeight);
    return mat;
}

export function addFatLine(parent, pts, mat) {
    const flat = [];
    for (let i = 0; i < pts.length; i++) {
        flat.push(pts[i].x, pts[i].y, pts[i].z);
    }
    const geo = new LineGeometry();
    geo.setPositions(flat);
    const line = new Line2(geo, mat);
    line.computeLineDistances();
    parent.add(line);
}

export function inwardTangentBasis(inward, outTanA, outTanB) {
    const inN = inward.clone().normalize();
    outTanA.copy(new THREE.Vector3(0, 1, 0)).cross(inN);
    if (outTanA.lengthSq() < 1e-8) outTanA.set(1, 0, 0).cross(inN);
    outTanA.normalize();
    outTanB.crossVectors(inN, outTanA).normalize();
}

export function applyParticleGroundBounce(pos, vel, count, rootY = 0) {
    const floorY = PARTICLE_FLOOR_Y;
    const rest = PARTICLE_BOUNCE_RESTITUTION;
    const fric = PARTICLE_BOUNCE_FRICTION;
    const sleep = PARTICLE_BOUNCE_SLEEP_VY;
    for (let i = 0; i < count; i++) {
        const ix = i * 3;
        const worldY = pos[ix + 1] + rootY;
        if (worldY < floorY) {
            pos[ix + 1] = floorY - rootY;
            if (vel[ix + 1] < 0) {
                vel[ix + 1] = -vel[ix + 1] * rest;
                if (vel[ix + 1] < sleep) vel[ix + 1] = 0;
            }
            vel[ix] *= fric;
            vel[ix + 2] *= fric;
        }
    }
}

export function snapCrackAlong(along) {
    return Math.round(along / 0.12) * 0.12;
}

export function buildPolygonalCrackSpine(y0, height, rng) {
    const segmentCount = 8 + Math.floor(rng() * 2);
    const points = [[0, y0]];
    let along = 0;
    let drift = rng() > 0.5 ? 1 : -1;

    for (let i = 1; i <= segmentCount; i++) {
        const t = i / segmentCount;
        const up = y0 + height * t;
        const kick = (i === 1 ? 0.16 : 0.22 + rng() * 0.24) * drift;
        along = THREE.MathUtils.clamp(along + kick, -1.32, 1.32);
        if (rng() > 0.56) drift *= -1;
        if (i === segmentCount) along *= 0.86;
        points.push([snapCrackAlong(along), up]);
    }

    return points;
}

export function buildPolygonalCrackBranch(startAlong, startUp, dir, rng, scale = 1) {
    const points = [[startAlong, startUp]];
    let along = startAlong;
    let up = startUp;
    let lateral = dir * (0.34 + rng() * 0.22) * scale;
    const segmentCount = 2 + Math.floor(rng() * 2);

    for (let i = 0; i < segmentCount; i++) {
        along += lateral;
        up += (0.34 + rng() * 0.34) * scale;
        points.push([snapCrackAlong(along), up]);

        if (i === 0 && rng() > 0.48) lateral *= -0.42;
        else lateral *= 0.7 + rng() * 0.12;
    }

    return points;
}
