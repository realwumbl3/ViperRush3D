/**
 * Liquid glass displacement + specular maps (kube.io refraction article).
 * Math aligned with https://github.com/winaviation/liquid-web (lg-component.js).
 */

export const SurfaceEquations = {
    convex_circle: (x) => Math.sqrt(1 - (1 - x) ** 2),
    convex_squircle: (x) => (1 - (1 - x) ** 4) ** (1 / 4),
    concave: (x) => 1 - Math.sqrt(1 - x ** 2),
    lip: (x) => {
      const convex = (1 - (1 - Math.min(x * 2, 1)) ** 4) ** (1 / 4);
      const concave = 1 - Math.sqrt(1 - (1 - x) ** 2) + 0.1;
      const smootherstep = 6 * x ** 5 - 15 * x ** 4 + 10 * x ** 3;
      return convex * (1 - smootherstep) + concave * smootherstep;
    },
  };
  
  function refractRay(eta, normalX, normalY) {
    const dot = normalY;
    const k = 1 - eta * eta * (1 - dot * dot);
    if (k < 0) return null;
    const kSqrt = Math.sqrt(k);
    return [
      -(eta * dot + kSqrt) * normalX,
      eta - (eta * dot + kSqrt) * normalY,
    ];
  }
  
  /** Linear sample of the 1D bezel displacement profile (avoids banding). */
  export function samplePrecomputedBezel(bezelRatio, arr) {
    if (!arr.length) return 0;
    const t = Math.max(0, Math.min(1, bezelRatio));
    const x = t * (arr.length - 1);
    const i = Math.floor(x);
    const f = x - i;
    const a = arr[i] ?? 0;
    const b = arr[Math.min(i + 1, arr.length - 1)] ?? 0;
    return a + (b - a) * f;
  }
  
  export function calculateDisplacementMap1D(
    glassThickness,
    bezelWidth,
    surfaceFn,
    refractiveIndex,
    samples = 128,
  ) {
    const eta = 1 / refractiveIndex;
    const result = [];
    for (let i = 0; i < samples; i++) {
      const x = i / samples;
      const y = surfaceFn(x);
      const dx = x < 1 ? 0.0001 : -0.0001;
      const y2 = surfaceFn(Math.max(0, Math.min(1, x + dx)));
      const derivative = (y2 - y) / dx;
      const magnitude = Math.sqrt(derivative * derivative + 1);
      const normal = [-derivative / magnitude, -1 / magnitude];
      const refracted = refractRay(eta, normal[0], normal[1]);
      if (!refracted) {
        result.push(0);
      } else {
        const remainingHeightOnBezel = y * bezelWidth;
        const remainingHeight = remainingHeightOnBezel + glassThickness;
        result.push(refracted[0] * (remainingHeight / refracted[1]));
      }
    }
    return result;
  }
  
  export function calculateDisplacementMap2D(
    canvasWidth,
    canvasHeight,
    objectWidth,
    objectHeight,
    radius,
    bezelWidth,
    maximumDisplacement,
    precomputedMap,
    aaScale = 1,
  ) {
    const imageData = new ImageData(canvasWidth, canvasHeight);
    for (let i = 0; i < imageData.data.length; i += 4) {
      imageData.data[i] = 128;
      imageData.data[i + 1] = 128;
      imageData.data[i + 2] = 0;
      imageData.data[i + 3] = 255;
    }
    const radiusSquared = radius * radius;
    const outerFeather = Math.max(1.35 * aaScale, bezelWidth * 0.14 * aaScale);
    const radiusOuter = radius + outerFeather;
    const radiusPlusOuterSquared = radiusOuter * radiusOuter;
    const radiusMinusBezelSquared = Math.max(0, (radius - bezelWidth) ** 2);
    const widthBetweenRadiuses = objectWidth - radius * 2;
    const heightBetweenRadiuses = objectHeight - radius * 2;
    const objectX = (canvasWidth - objectWidth) / 2;
    const objectY = (canvasHeight - objectHeight) / 2;
  
    for (let y1 = 0; y1 < objectHeight; y1++) {
      for (let x1 = 0; x1 < objectWidth; x1++) {
        const idx = ((objectY + y1) * canvasWidth + objectX + x1) * 4;
        const isOnLeftSide = x1 < radius;
        const isOnRightSide = x1 >= objectWidth - radius;
        const isOnTopSide = y1 < radius;
        const isOnBottomSide = y1 >= objectHeight - radius;
        const x = isOnLeftSide
          ? x1 - radius
          : isOnRightSide
            ? x1 - radius - widthBetweenRadiuses
            : 0;
        const y = isOnTopSide
          ? y1 - radius
          : isOnBottomSide
            ? y1 - radius - heightBetweenRadiuses
            : 0;
        const distanceToCenterSquared = x * x + y * y;
        const isInBezel =
          distanceToCenterSquared <= radiusPlusOuterSquared &&
          distanceToCenterSquared >= radiusMinusBezelSquared;
        if (isInBezel) {
          const dCenter = Math.sqrt(distanceToCenterSquared);
          let opacity = 1;
          if (dCenter > radius) {
            const denom =
              Math.sqrt(radiusPlusOuterSquared) - Math.sqrt(radiusSquared);
            opacity =
              denom > 1e-6
                ? 1 -
                  (dCenter - Math.sqrt(radiusSquared)) / denom
                : 1;
            opacity = Math.max(0, Math.min(1, opacity));
          }
          const distanceFromCenter = dCenter;
          const distanceFromSide = radius - distanceFromCenter;
          const cos = distanceFromCenter > 0 ? x / distanceFromCenter : 0;
          const sin = distanceFromCenter > 0 ? y / distanceFromCenter : 0;
          const bezelRatio = Math.max(
            0,
            Math.min(1, distanceFromSide / bezelWidth),
          );
          const distance = samplePrecomputedBezel(bezelRatio, precomputedMap);
          const dX =
            maximumDisplacement > 0 ? (-cos * distance) / maximumDisplacement : 0;
          const dY =
            maximumDisplacement > 0 ? (-sin * distance) / maximumDisplacement : 0;
          imageData.data[idx] = Math.max(
            0,
            Math.min(255, 128 + dX * 127 * opacity),
          );
          imageData.data[idx + 1] = Math.max(
            0,
            Math.min(255, 128 + dY * 127 * opacity),
          );
          imageData.data[idx + 2] = 0;
          imageData.data[idx + 3] = 255;
        }
      }
    }
    return imageData;
  }
  
  export function calculateSpecularHighlight(
    objectWidth,
    objectHeight,
    radius,
    bezelWidth,
    specularAngle = Math.PI / 3,
    thicknessScale = 1,
    aaScale = 1,
  ) {
    const imageData = new ImageData(objectWidth, objectHeight);
    const specularVector = [Math.cos(specularAngle), Math.sin(specularAngle)];
    const specularThickness = 1.5 * thicknessScale;
    const radiusSquared = radius * radius;
    const outerFeather = Math.max(1.2 * aaScale, bezelWidth * 0.12 * aaScale);
    const radiusPlusOuterSquared = (radius + outerFeather) * (radius + outerFeather);
    const radiusMinusSpecularSquared = Math.max(
      0,
      (radius - specularThickness) * (radius - specularThickness),
    );
    const widthBetweenRadiuses = objectWidth - radius * 2;
    const heightBetweenRadiuses = objectHeight - radius * 2;
  
    for (let y1 = 0; y1 < objectHeight; y1++) {
      for (let x1 = 0; x1 < objectWidth; x1++) {
        const idx = (y1 * objectWidth + x1) * 4;
        const isOnLeftSide = x1 < radius;
        const isOnRightSide = x1 >= objectWidth - radius;
        const isOnTopSide = y1 < radius;
        const isOnBottomSide = y1 >= objectHeight - radius;
        const x = isOnLeftSide
          ? x1 - radius
          : isOnRightSide
            ? x1 - radius - widthBetweenRadiuses
            : 0;
        const y = isOnTopSide
          ? y1 - radius
          : isOnBottomSide
            ? y1 - radius - heightBetweenRadiuses
            : 0;
        const distanceToCenterSquared = x * x + y * y;
        const isNearEdge =
          distanceToCenterSquared <= radiusPlusOuterSquared &&
          distanceToCenterSquared >= radiusMinusSpecularSquared;
        if (isNearEdge) {
          const distanceFromCenter = Math.sqrt(distanceToCenterSquared);
          const distanceFromSide = radius - distanceFromCenter;
          const denom =
            Math.sqrt(radiusPlusOuterSquared) - Math.sqrt(radiusSquared);
          const opacity =
            distanceToCenterSquared < radiusSquared
              ? 1
              : denom > 1e-6
                ? 1 -
                  (distanceFromCenter - Math.sqrt(radiusSquared)) / denom
                : 1;
          const opacityClamped = Math.max(0, Math.min(1, opacity));
          const cos = distanceFromCenter > 0 ? x / distanceFromCenter : 0;
          const sin = distanceFromCenter > 0 ? -y / distanceFromCenter : 0;
          const dotProduct = Math.abs(
            cos * specularVector[0] + sin * specularVector[1],
          );
          const edgeRatio = Math.max(
            0,
            Math.min(1, distanceFromSide / specularThickness),
          );
          const sharpFalloff = Math.sqrt(1 - (1 - edgeRatio) * (1 - edgeRatio));
          const coefficient = dotProduct * sharpFalloff;
          const color = Math.min(255, 255 * coefficient);
          const finalOpacity = Math.min(
            255,
            color * coefficient * opacityClamped,
          );
          imageData.data[idx] = color;
          imageData.data[idx + 1] = color;
          imageData.data[idx + 2] = color;
          imageData.data[idx + 3] = finalOpacity;
        }
      }
    }
    return imageData;
  }
  
  /** Downscale maps with high-quality smoothing (reduces stair-steps in feDisplacementMap). */
  export function downscaleImageDataSmooth(imageData, targetW, targetH) {
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = imageData.width;
    srcCanvas.height = imageData.height;
    const sctx = srcCanvas.getContext('2d');
    sctx.putImageData(imageData, 0, 0);
    const dstCanvas = document.createElement('canvas');
    dstCanvas.width = targetW;
    dstCanvas.height = targetH;
    const dctx = dstCanvas.getContext('2d');
    dctx.imageSmoothingEnabled = true;
    dctx.imageSmoothingQuality = 'high';
    dctx.drawImage(srcCanvas, 0, 0, targetW, targetH);
    return dctx.getImageData(0, 0, targetW, targetH);
  }
  
  /** Light separable blur on R and G only; neutral = (128,128). */
  export function softenDisplacementMap(imageData, iterations = 1) {
    const w = imageData.width;
    const h = imageData.height;
    const d = imageData.data;
    const rowBuf = new Float32Array(w * 2);
    const colBuf = new Float32Array(h * 2);
    const k0 = 0.22;
    const k1 = 0.56;
    const k2 = 0.22;
    for (let iter = 0; iter < iterations; iter++) {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const xm = Math.max(0, x - 1);
          const xp = Math.min(w - 1, x + 1);
          const il = (y * w + xm) * 4;
          const ic = (y * w + x) * 4;
          const ir = (y * w + xp) * 4;
          rowBuf[x * 2] = d[il] * k0 + d[ic] * k1 + d[ir] * k2;
          rowBuf[x * 2 + 1] =
            d[il + 1] * k0 + d[ic + 1] * k1 + d[ir + 1] * k2;
        }
        for (let x = 0; x < w; x++) {
          const o = (y * w + x) * 4;
          d[o] = Math.max(0, Math.min(255, Math.round(rowBuf[x * 2])));
          d[o + 1] = Math.max(
            0,
            Math.min(255, Math.round(rowBuf[x * 2 + 1])),
          );
        }
      }
      for (let x = 0; x < w; x++) {
        for (let y = 0; y < h; y++) {
          const ym = Math.max(0, y - 1);
          const yp = Math.min(h - 1, y + 1);
          const i0 = (ym * w + x) * 4;
          const i1 = (y * w + x) * 4;
          const i2 = (yp * w + x) * 4;
          colBuf[y * 2] = d[i0] * k0 + d[i1] * k1 + d[i2] * k2;
          colBuf[y * 2 + 1] =
            d[i0 + 1] * k0 + d[i1 + 1] * k1 + d[i2 + 1] * k2;
        }
        for (let y = 0; y < h; y++) {
          const o = (y * w + x) * 4;
          d[o] = Math.max(0, Math.min(255, Math.round(colBuf[y * 2])));
          d[o + 1] = Math.max(
            0,
            Math.min(255, Math.round(colBuf[y * 2 + 1])),
          );
          d[o + 2] = 128;
          d[o + 3] = 255;
        }
      }
    }
    return imageData;
  }
  
  export function imageDataToDataURL(imageData) {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d');
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL();
  }
  
  export function supportsSvgBackdropFilter() {
    if (typeof document === 'undefined') return false;
    const isChromium = !!globalThis.chrome;
    const testEl = document.createElement('div');
    testEl.style.backdropFilter = 'url(#test)';
    const supportsUrl = testEl.style.backdropFilter.includes('url');
    return isChromium && supportsUrl;
  }
  
  export function debounce(fn, wait) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }
  