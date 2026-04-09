/**
 * Vanilla ES module port of LiquidGlassPill.jsx — same visuals and behavior,
 * no React. Build DOM with the platform APIs; use {@link createLiquidGlassPill}.
 */
import {
    SurfaceEquations,
    calculateDisplacementMap1D,
    calculateDisplacementMap2D,
    calculateSpecularHighlight,
    debounce,
    downscaleImageDataSmooth,
    imageDataToDataURL,
    softenDisplacementMap,
    supportsSvgBackdropFilter,
  } from './lib/liquidGlass.js';
  
  const DEFAULTS = {
    surfaceType: 'convex_squircle',
    glassThickness: 100,
    refractiveIndex: 1.5,
    refractionScale: 1.35,
    specularOpacity: 0.55,
    blur: 1.15,
    fallbackBlurPx: 14,
  };
  
  const MAX_LIQUID_MAP_MAJOR = 1000;
  const MAX_LIQUID_SUPER_PIXELS = 850000;
  const LIQUID_MAP_DPR_CAP = 1.35;
  const DEFAULT_SPECULAR_ANGLE = Math.PI / 3;
  const HOVER_SPECULAR_LERP = 0.078;
  const HOVER_SPECULAR_ANGLE_EPS = 0.012;
  const HOVER_SPECULAR_SLOPE_MULT = 1.95;
  const HOVER_SPECULAR_RGB_GAIN = 1.42;
  const HOVER_SPECULAR_ALPHA_GAIN = 1.68;
  const IDLE_SPECULAR_MAP_BLUR = 0.52;
  const HOVER_SPECULAR_MAP_BLUR = 0.32;
  const HOVER_SPECULAR_LERP_EXIT = 0.036;
  const HOVER_EXIT_BOOST_DECAY = 0.968;
  
  const SVG_NS = 'http://www.w3.org/2000/svg';
  
  function shortestAngleDelta(from, to) {
    let d = to - from;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }
  
  function computeLiquidMapLayout(
    w,
    h,
    mapDevicePixelRatio,
    bezelWidthFull,
    glassThickness,
  ) {
    const maxSide = Math.max(w, h);
    let rw = w;
    let rh = h;
    if (maxSide > MAX_LIQUID_MAP_MAJOR) {
      const s = MAX_LIQUID_MAP_MAJOR / maxSide;
      rw = Math.max(1, Math.round(w * s));
      rh = Math.max(1, Math.round(h * s));
    }
    const geoScale = rw / w;
  
    let mapScale = Math.max(1, Math.min(LIQUID_MAP_DPR_CAP, mapDevicePixelRatio || 1));
    let sw = Math.max(1, Math.round(rw * mapScale));
    let sh = Math.max(1, Math.round(rh * mapScale));
    let superPixels = sw * sh;
    if (superPixels > MAX_LIQUID_SUPER_PIXELS) {
      const f = Math.sqrt(MAX_LIQUID_SUPER_PIXELS / superPixels);
      mapScale = Math.max(1, mapScale * f);
      sw = Math.max(1, Math.round(rw * mapScale));
      sh = Math.max(1, Math.round(rh * mapScale));
      superPixels = sw * sh;
      if (superPixels > MAX_LIQUID_SUPER_PIXELS) {
        const g = Math.sqrt(MAX_LIQUID_SUPER_PIXELS / superPixels);
        rw = Math.max(1, Math.round(rw * g));
        rh = Math.max(1, Math.round(rh * g));
        sw = Math.max(1, Math.round(rw * mapScale));
        sh = Math.max(1, Math.round(rh * mapScale));
      }
    }
  
    const sradius = Math.round(sh / 2);
    const rwBezel = Math.max(4, Math.round(bezelWidthFull * geoScale));
    const sbezel = Math.max(8, Math.round(rwBezel * mapScale));
    const glassT = Math.max(1, glassThickness * geoScale);
  
    return {
      rw,
      rh,
      geoScale,
      mapScale,
      sw,
      sh,
      sradius,
      rwBezel,
      sbezel,
      glassT,
    };
  }
  
  function makeFilterId() {
    const raw =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID().replace(/-/g, '')
        : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    return `liquidGlass-${raw}`;
  }
  
  function appendChildren(target, children) {
    if (children == null) return;
    if (typeof children === 'string') {
      target.appendChild(document.createTextNode(children));
      return;
    }
    if (Array.isArray(children)) {
      for (const c of children) appendChildren(target, c);
      return;
    }
    if (children instanceof Node) {
      target.appendChild(children);
    }
  }
  
  /**
   * @typedef {Object} LiquidGlassPillOptions
   * @property {string} [className]
   * @property {string} [surfaceType]
   * @property {number} [glassThickness]
   * @property {number} [refractionScale]
   * @property {number} [specularOpacity]
   * @property {number} [blur]
   * @property {number} [fallbackBlurPx]
   * @property {number} [bezelWidth]
   * @property {number} [refractiveIndex]
   * @property {Node|string|Node[]|null} [children]
   */
  
  /**
   * Creates the liquid-glass pill root element and wires resize / hover behavior.
   * Call `destroy()` when removing from the document.
   *
   * @param {LiquidGlassPillOptions} [options]
   * @returns {{ element: HTMLDivElement, destroy: () => void, setChildren: (Node|string|Node[]|null) => void }}
   */
  export function createLiquidGlassPill(options = {}) {
    const {
      className = '',
      surfaceType = DEFAULTS.surfaceType,
      glassThickness = DEFAULTS.glassThickness,
      refractionScale = DEFAULTS.refractionScale,
      specularOpacity = DEFAULTS.specularOpacity,
      blur = DEFAULTS.blur,
      fallbackBlurPx = DEFAULTS.fallbackBlurPx,
      bezelWidth,
      refractiveIndex = DEFAULTS.refractiveIndex,
      children: initialChildren,
    } = options;
  
    const filterId = makeFilterId();
    let useLiquid = supportsSvgBackdropFilter();
  
    const root = document.createElement('div');
    const contentSpan = document.createElement('span');
    contentSpan.className = 'liquid-glass-content';
  
    /** @type {SVGSVGElement | null} */
    let svg = null;
    /** @type {HTMLDivElement | null} */
    let fallbackGlass = null;
  
    function syncChromeClass() {
      root.className =
        `liquid-glass-pill ${useLiquid ? 'liquid-glass-pill--chrome' : 'liquid-glass-pill--fallback'} ${className}`.trim();
    }
  
    function syncBackdropStyle() {
      root.style.setProperty('--liquid-fallback-blur', `${fallbackBlurPx}px`);
      if (useLiquid) {
        root.style.backdropFilter = `url(#${filterId})`;
        root.style.webkitBackdropFilter = `url(#${filterId})`;
      } else {
        root.style.removeProperty('backdrop-filter');
        root.style.removeProperty('-webkit-backdrop-filter');
      }
    }
  
    function buildSvgFilter() {
      const svgEl = document.createElementNS(SVG_NS, 'svg');
      svgEl.setAttribute('class', 'liquid-glass-pill__svg-defs');
      svgEl.setAttribute('aria-hidden', 'true');
  
      const defs = document.createElementNS(SVG_NS, 'defs');
      const filter = document.createElementNS(SVG_NS, 'filter');
      filter.setAttribute('id', filterId);
      filter.setAttribute('x', '-25%');
      filter.setAttribute('y', '-25%');
      filter.setAttribute('width', '150%');
      filter.setAttribute('height', '150%');
      filter.setAttribute('color-interpolation-filters', 'sRGB');
  
      const feBlur = document.createElementNS(SVG_NS, 'feGaussianBlur');
      feBlur.setAttribute('id', `${filterId}-feBlur`);
      feBlur.setAttribute('in', 'SourceGraphic');
      feBlur.setAttribute('stdDeviation', String(blur));
      feBlur.setAttribute('result', 'blurred');
  
      const feDispImg = document.createElementNS(SVG_NS, 'feImage');
      feDispImg.setAttribute('id', `${filterId}-disp`);
      feDispImg.setAttribute('href', '');
      feDispImg.setAttribute('x', '0');
      feDispImg.setAttribute('y', '0');
      feDispImg.setAttribute('width', '200');
      feDispImg.setAttribute('height', '80');
      feDispImg.setAttribute('result', 'displacement_raw');
      feDispImg.setAttribute('preserveAspectRatio', 'none');
  
      const feDispBlur = document.createElementNS(SVG_NS, 'feGaussianBlur');
      feDispBlur.setAttribute('id', `${filterId}-feDispBlur`);
      feDispBlur.setAttribute('in', 'displacement_raw');
      feDispBlur.setAttribute('stdDeviation', '0.85');
      feDispBlur.setAttribute('result', 'displacement_map');
  
      const feDisp = document.createElementNS(SVG_NS, 'feDisplacementMap');
      feDisp.setAttribute('id', `${filterId}-feDisp`);
      feDisp.setAttribute('in', 'blurred');
      feDisp.setAttribute('in2', 'displacement_map');
      feDisp.setAttribute('scale', '50');
      feDisp.setAttribute('xChannelSelector', 'R');
      feDisp.setAttribute('yChannelSelector', 'G');
      feDisp.setAttribute('result', 'displaced');
  
      const feSat = document.createElementNS(SVG_NS, 'feColorMatrix');
      feSat.setAttribute('in', 'displaced');
      feSat.setAttribute('type', 'saturate');
      feSat.setAttribute('values', '1.25');
      feSat.setAttribute('result', 'displaced_saturated');
  
      const feSpecImg = document.createElementNS(SVG_NS, 'feImage');
      feSpecImg.setAttribute('id', `${filterId}-spec`);
      feSpecImg.setAttribute('href', '');
      feSpecImg.setAttribute('x', '0');
      feSpecImg.setAttribute('y', '0');
      feSpecImg.setAttribute('width', '200');
      feSpecImg.setAttribute('height', '80');
      feSpecImg.setAttribute('result', 'specular_raw');
      feSpecImg.setAttribute('preserveAspectRatio', 'none');
  
      const feSpecBlur = document.createElementNS(SVG_NS, 'feGaussianBlur');
      feSpecBlur.setAttribute('id', `${filterId}-feSpecBlur`);
      feSpecBlur.setAttribute('in', 'specular_raw');
      feSpecBlur.setAttribute('stdDeviation', String(IDLE_SPECULAR_MAP_BLUR));
      feSpecBlur.setAttribute('result', 'specular_layer');
  
      const feSpecTransfer = document.createElementNS(SVG_NS, 'feComponentTransfer');
      feSpecTransfer.setAttribute('in', 'specular_layer');
      feSpecTransfer.setAttribute('result', 'specular_faded');
  
      const feFuncA = document.createElementNS(SVG_NS, 'feFuncA');
      feFuncA.setAttribute('id', `${filterId}-feSpecA`);
      feFuncA.setAttribute('type', 'linear');
      feFuncA.setAttribute('slope', String(specularOpacity));
  
      feSpecTransfer.appendChild(feFuncA);
  
      const feBlend = document.createElementNS(SVG_NS, 'feBlend');
      feBlend.setAttribute('in', 'specular_faded');
      feBlend.setAttribute('in2', 'displaced_saturated');
      feBlend.setAttribute('mode', 'screen');
  
      filter.append(
        feBlur,
        feDispImg,
        feDispBlur,
        feDisp,
        feSat,
        feSpecImg,
        feSpecBlur,
        feSpecTransfer,
        feBlend,
      );
      defs.appendChild(filter);
      svgEl.appendChild(defs);
      return svgEl;
    }
  
    function rebuildShell() {
      if (svg) {
        svg.remove();
        svg = null;
      }
      if (fallbackGlass) {
        fallbackGlass.remove();
        fallbackGlass = null;
      }
  
      if (useLiquid) {
        svg = buildSvgFilter();
        root.insertBefore(svg, contentSpan);
      } else {
        fallbackGlass = document.createElement('div');
        fallbackGlass.className = 'liquid-glass-pill__glass';
        root.insertBefore(fallbackGlass, contentSpan);
      }
  
      syncChromeClass();
      syncBackdropStyle();
    }
  
    appendChildren(contentSpan, initialChildren);
    root.appendChild(contentSpan);
    rebuildShell();
  
    const lastSizeRef = { w: 0, h: 0 };
    /** @type {null | { sw: number; sh: number; sradius: number; sbezel: number; mapScale: number; w: number; h: number }} */
    let glassCacheRef = null;
  
    function applySpecularOnly(specularAngle, boostT = 0) {
      if (!svg || !glassCacheRef || !useLiquid) return;
  
      const c = glassCacheRef;
      const t = Math.max(0, Math.min(1, boostT));
  
      let specularData = calculateSpecularHighlight(
        c.sw,
        c.sh,
        c.sradius,
        c.sbezel,
        specularAngle,
        c.mapScale,
        c.mapScale,
      );
      specularData = downscaleImageDataSmooth(specularData, c.w, c.h);
  
      if (t > 1e-6) {
        const rg = 1 + (HOVER_SPECULAR_RGB_GAIN - 1) * t;
        const ag = 1 + (HOVER_SPECULAR_ALPHA_GAIN - 1) * t;
        const d = specularData.data;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 3] === 0) continue;
          d[i] = Math.min(255, d[i] * rg);
          d[i + 1] = Math.min(255, d[i + 1] * rg);
          d[i + 2] = Math.min(255, d[i + 2] * rg);
          d[i + 3] = Math.min(255, d[i + 3] * ag);
        }
      }
  
      const specularUrl = imageDataToDataURL(specularData);
      const specId = `${filterId}-spec`;
      const specularImage = svg.querySelector(`#${CSS.escape(specId)}`);
      const specularAlpha = svg.querySelector(
        `#${CSS.escape(`${filterId}-feSpecA`)}`,
      );
      const specMapBlur = svg.querySelector(
        `#${CSS.escape(`${filterId}-feSpecBlur`)}`,
      );
      const slopeMult = 1 + (HOVER_SPECULAR_SLOPE_MULT - 1) * t;
      const blurDev =
        IDLE_SPECULAR_MAP_BLUR +
        (HOVER_SPECULAR_MAP_BLUR - IDLE_SPECULAR_MAP_BLUR) * t;
      specularImage?.setAttribute('href', specularUrl);
      specularAlpha?.setAttribute(
        'slope',
        String(specularOpacity * slopeMult),
      );
      specMapBlur?.setAttribute('stdDeviation', String(blurDev));
    }
  
    function applyFilter() {
      if (!svg || !useLiquid) return;
  
      const w = Math.max(1, Math.round(root.clientWidth));
      const h = Math.max(1, Math.round(root.clientHeight));
      const minDim = Math.min(w, h);
      const bezelWidthFull =
        bezelWidth != null && Number.isFinite(bezelWidth)
          ? Math.max(4, Math.round(bezelWidth))
          : Math.max(8, Math.round(minDim * 0.06));
  
      const layoutArea = w * h;
      const rawDpr =
        typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      const mapDevicePixelRatio = Math.min(LIQUID_MAP_DPR_CAP, rawDpr);
      const {
        geoScale,
        mapScale,
        sw,
        sh,
        sradius,
        rwBezel,
        sbezel,
        glassT,
      } = computeLiquidMapLayout(
        w,
        h,
        mapDevicePixelRatio,
        bezelWidthFull,
        glassThickness,
      );
  
      const surfaceFn =
        SurfaceEquations[surfaceType] ?? SurfaceEquations.convex_squircle;
  
      const precomputed = calculateDisplacementMap1D(
        glassT,
        rwBezel,
        surfaceFn,
        refractiveIndex,
      );
      const maximumDisplacementMini = Math.max(
        ...precomputed.map((v) => Math.abs(v)),
      );
      const displacementScale =
        ((maximumDisplacementMini || 1) / geoScale) * refractionScale;
  
      let displacementData = calculateDisplacementMap2D(
        sw,
        sh,
        sw,
        sh,
        sradius,
        sbezel,
        maximumDisplacementMini || 1,
        precomputed,
        mapScale,
      );
      displacementData = downscaleImageDataSmooth(displacementData, w, h);
      if (layoutArea <= 140000) {
        softenDisplacementMap(displacementData, 1);
      }
  
      glassCacheRef = {
        sw,
        sh,
        sradius,
        sbezel,
        mapScale,
        w,
        h,
      };
  
      let specularData = calculateSpecularHighlight(
        sw,
        sh,
        sradius,
        sbezel,
        DEFAULT_SPECULAR_ANGLE,
        mapScale,
        mapScale,
      );
      specularData = downscaleImageDataSmooth(specularData, w, h);
  
      const displacementUrl = imageDataToDataURL(displacementData);
      const specularUrl = imageDataToDataURL(specularData);
  
      const dispId = `${filterId}-disp`;
      const specId = `${filterId}-spec`;
      const displacementImage = svg.querySelector(`#${CSS.escape(dispId)}`);
      const specularImage = svg.querySelector(`#${CSS.escape(specId)}`);
      const displacementMap = svg.querySelector(`#${CSS.escape(`${filterId}-feDisp`)}`);
      const specularAlpha = svg.querySelector(`#${CSS.escape(`${filterId}-feSpecA`)}`);
      const filterBlur = svg.querySelector(`#${CSS.escape(`${filterId}-feBlur`)}`);
      const dispMapPreBlur = svg.querySelector(
        `#${CSS.escape(`${filterId}-feDispBlur`)}`,
      );
      const specMapBlur = svg.querySelector(
        `#${CSS.escape(`${filterId}-feSpecBlur`)}`,
      );
  
      const heavyLayout = layoutArea > 120000;
      filterBlur?.setAttribute(
        'stdDeviation',
        String(heavyLayout ? blur * 0.72 : blur),
      );
      dispMapPreBlur?.setAttribute(
        'stdDeviation',
        String(heavyLayout ? 0.42 : 0.85),
      );
      specMapBlur?.setAttribute(
        'stdDeviation',
        String(IDLE_SPECULAR_MAP_BLUR),
      );
  
      displacementImage?.setAttribute('width', String(w));
      displacementImage?.setAttribute('height', String(h));
      specularImage?.setAttribute('width', String(w));
      specularImage?.setAttribute('height', String(h));
      displacementImage?.setAttribute('href', displacementUrl);
      specularImage?.setAttribute('href', specularUrl);
      displacementMap?.setAttribute('scale', String(displacementScale));
      specularAlpha?.setAttribute('slope', String(specularOpacity));
  
      lastSizeRef.w = w;
      lastSizeRef.h = h;
    }
  
    let applyFilterRef = applyFilter;
    const debouncedApply = debounce(() => applyFilterRef(), 160);
  
    applyFilterRef = applyFilter;
    queueMicrotask(() => {
      applyFilterRef();
    });
  
    const ro = new ResizeObserver(() => {
      const nw = Math.round(root.clientWidth);
      const nh = Math.round(root.clientHeight);
      const { w: lw, h: lh } = lastSizeRef;
      if (Math.abs(nw - lw) < 2 && Math.abs(nh - lh) < 2) return;
      debouncedApply();
    });
    ro.observe(root);
  
    const onWin = () => debouncedApply();
    window.addEventListener('resize', onWin);
    window.visualViewport?.addEventListener('resize', onWin);
  
    let hoverCleanup = () => {};
    function setupHover() {
      hoverCleanup();
      if (!useLiquid) {
        hoverCleanup = () => {};
        return;
      }
  
      const el = root;
      let hovering = false;
      let exiting = false;
      let raf = 0;
      let targetAngle = DEFAULT_SPECULAR_ANGLE;
      let smoothAngle = DEFAULT_SPECULAR_ANGLE;
      let exitBoost = 1;
      let applySpecularRef = applySpecularOnly;
      applySpecularRef = applySpecularOnly;
  
      const pump = () => {
        raf = 0;
  
        if (hovering) {
          exiting = false;
          smoothAngle +=
            shortestAngleDelta(smoothAngle, targetAngle) * HOVER_SPECULAR_LERP;
          applySpecularRef(smoothAngle, 1);
          if (
            Math.abs(shortestAngleDelta(smoothAngle, targetAngle)) >
            HOVER_SPECULAR_ANGLE_EPS
          ) {
            raf = requestAnimationFrame(pump);
          }
          return;
        }
  
        if (exiting) {
          smoothAngle +=
            shortestAngleDelta(smoothAngle, DEFAULT_SPECULAR_ANGLE) *
            HOVER_SPECULAR_LERP_EXIT;
          exitBoost *= HOVER_EXIT_BOOST_DECAY;
          applySpecularRef(smoothAngle, exitBoost);
  
          const angDone =
            Math.abs(
              shortestAngleDelta(smoothAngle, DEFAULT_SPECULAR_ANGLE),
            ) <= HOVER_SPECULAR_ANGLE_EPS;
          const boostDone = exitBoost < 0.012;
          if (!angDone || !boostDone) {
            raf = requestAnimationFrame(pump);
          } else {
            exiting = false;
            exitBoost = 0;
            smoothAngle = DEFAULT_SPECULAR_ANGLE;
            applySpecularRef(DEFAULT_SPECULAR_ANGLE, 0);
          }
        }
      };
  
      const queuePump = () => {
        if (raf) return;
        raf = requestAnimationFrame(pump);
      };
  
      const onEnter = () => {
        hovering = true;
        exiting = false;
        exitBoost = 1;
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        smoothAngle = DEFAULT_SPECULAR_ANGLE;
        targetAngle = DEFAULT_SPECULAR_ANGLE;
      };
  
      const onLeave = () => {
        if (!hovering) return;
        hovering = false;
        exiting = true;
        exitBoost = 1;
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(pump);
      };
  
      const onMove = (e) => {
        if (!hovering) return;
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        targetAngle = Math.atan2(e.clientY - cy, e.clientX - cx);
        queuePump();
      };
  
      el.addEventListener('pointerenter', onEnter);
      el.addEventListener('pointerleave', onLeave);
      el.addEventListener('pointermove', onMove);
  
      hoverCleanup = () => {
        if (raf) cancelAnimationFrame(raf);
        el.removeEventListener('pointerenter', onEnter);
        el.removeEventListener('pointerleave', onLeave);
        el.removeEventListener('pointermove', onMove);
      };
    }
  
    setupHover();
  
    function destroy() {
      hoverCleanup();
      ro.disconnect();
      window.removeEventListener('resize', onWin);
      window.visualViewport?.removeEventListener('resize', onWin);
    }
  
    function setChildren(children) {
      contentSpan.replaceChildren();
      appendChildren(contentSpan, children);
    }
  
    return {
      element: root,
      destroy,
      setChildren,
    };
  }
  
  export default createLiquidGlassPill;
  