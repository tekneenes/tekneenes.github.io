/* ==========================================================================
   LEGENCY-INSPIRED INTERACTIVE PORTFOLIO ENGINE
   Includes:
   1. Two-State Dark/Light Theme Toggle (synced with <meta name="color-scheme">)
   2. WebGL2 Bayer 8x8 Hero Planet Shader (Reactive to theme & pointer ripples)
   3. WebGL2 Bayer 8x8 Dithered Wave Closer Shader
   4. Nav Book 2D Canvas Bayer Dither Pointer Trail
   5. Page Entry Pixelated Grid Reveal Transition
   6. Two-Step Floating Nav + Keyboard Trap
   7. GSAP ScrollTrigger: Rolling Headings, Pixelated Scroll Transition,
      Curved SVG Arc Marquee, Interactive Feature Showcase, Project Filters
   ========================================================================== */

(() => {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const darkMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

  /* --------------------------------------------------------------------------
     1. DARK / LIGHT THEME ENGINE (Modern Web Guidance compliant)
     -------------------------------------------------------------------------- */
  const metaScheme = document.querySelector('meta[name="color-scheme"]');

  function getResolvedTheme() {
    const content = metaScheme?.getAttribute("content") || "light dark";
    if (content === "dark") return "dark";
    if (content === "light") return "light";
    return darkMediaQuery.matches ? "dark" : "light";
  }

  function applyThemeOverride(targetScheme) {
    const systemScheme = darkMediaQuery.matches ? "dark" : "light";
    if (targetScheme !== systemScheme) {
      try {
        localStorage.setItem("color-scheme", targetScheme);
      } catch {}
      if (metaScheme) metaScheme.content = targetScheme;
    } else {
      try {
        localStorage.removeItem("color-scheme");
      } catch {}
      if (metaScheme) metaScheme.content = "light dark";
    }
    window.dispatchEvent(new CustomEvent("theme:changed", { detail: { theme: getResolvedTheme() } }));
  }

  function initThemeToggle() {
    document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const current = getResolvedTheme();
        const next = current === "dark" ? "light" : "dark";
        applyThemeOverride(next);
      });
    });

    darkMediaQuery.addEventListener("change", () => {
      window.dispatchEvent(new CustomEvent("theme:changed", { detail: { theme: getResolvedTheme() } }));
    });

    window.addEventListener("storage", (e) => {
      if (e.key === "color-scheme" && metaScheme) {
        metaScheme.content = e.newValue ?? "light dark";
        window.dispatchEvent(new CustomEvent("theme:changed", { detail: { theme: getResolvedTheme() } }));
      }
    });
  }

  /* --------------------------------------------------------------------------
     2. PAGE ENTRY PIXELATED GRID REVEAL (.transition)
     -------------------------------------------------------------------------- */
  function initPageTransition() {
    const transitionEl = document.querySelector(".transition");
    if (!transitionEl) return;
    if (prefersReducedMotion || typeof gsap === "undefined") {
      transitionEl.style.display = "none";
      return;
    }

    const cols = window.getComputedStyle(transitionEl).getPropertyValue("grid-template-columns").split(" ").length || 24;
    const cellSize = window.innerWidth / cols;
    const rows = Math.ceil(window.innerHeight / cellSize);
    transitionEl.style.gridTemplateRows = `repeat(${rows}, ${cellSize}px)`;
    transitionEl.innerHTML = "";

    const fragment = document.createDocumentFragment();
    const total = cols * rows;
    for (let i = 0; i < total; i++) {
      const block = document.createElement("div");
      block.className = "transition-block";
      fragment.appendChild(block);
    }
    transitionEl.appendChild(fragment);

    gsap
      .timeline({
        onStart: () => gsap.set(transitionEl, { background: "transparent" }),
        onComplete: () => gsap.set(transitionEl, { display: "none" }),
        defaults: { ease: "linear" },
      })
      .to(
        ".transition-block",
        {
          opacity: 0,
          duration: 0.1,
          stagger: { amount: 0.42, from: "random" },
        },
        0.12
      );
  }

  /* --------------------------------------------------------------------------
     3. TWO-STEP FLOATING NAVIGATION & NAV DITHER CANVAS
     -------------------------------------------------------------------------- */
  const BAYER_64 = [
    0, 48, 12, 60, 3, 51, 15, 63,
    32, 16, 44, 28, 35, 19, 47, 31,
    8, 56, 4, 52, 11, 59, 7, 55,
    40, 24, 36, 20, 43, 27, 39, 23,
    2, 50, 14, 62, 1, 49, 13, 61,
    34, 18, 46, 30, 33, 17, 45, 29,
    10, 58, 6, 54, 9, 57, 5, 53,
    42, 26, 38, 22, 41, 25, 37, 21,
  ];

  function initNavBookDither(navEl) {
    const book = navEl.querySelector(".tsnav__book");
    const canvas = book?.querySelector("[data-nav-dither]");
    if (!book || !canvas) return () => {};

    let ctx = null;
    let rafId = 0;
    let active = false;
    let pointerIn = false;
    let alpha = 1;
    let leaveTime = 0;
    let pos = { x: 0, y: 0 };
    let target = { x: 0, y: 0 };

    const stop = () => {
      active = false;
      pointerIn = false;
      cancelAnimationFrame(rafId);
      canvas.hidden = true;
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    };

    const render = (now) => {
      if (!active || !ctx) return;
      if (navEl.getAttribute("data-nav-status") !== "active") {
        stop();
        return;
      }
      if (!pointerIn) {
        const t = Math.min((now - leaveTime) / 300, 1);
        if (t >= 1) {
          stop();
          return;
        }
        alpha = 1 - t * t;
      } else {
        alpha = 1;
      }

      pos.x += (target.x - pos.x) * 0.18;
      pos.y += (target.y - pos.y) * 0.18;

      const radius = 38;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#0004f6";

      const x0 = Math.max(0, Math.floor(pos.x - radius));
      const x1 = Math.min(canvas.width, Math.ceil(pos.x + radius));
      const y0 = Math.max(0, Math.floor(pos.y - radius));
      const y1 = Math.min(canvas.height, Math.ceil(pos.y + radius));

      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const d = Math.hypot(x + 0.5 - pos.x, y + 0.5 - pos.y) / radius;
          if (d < 1) {
            const val = (1 - d * d) ** 2 * (0.66 + 0.18 * Math.sin(d * 16 - now * 0.0035));
            const threshold = (BAYER_64[(y % 8) * 8 + (x % 8)] + 0.5) / 64;
            if (val > threshold) {
              ctx.fillRect(x, y, 1, 1);
            }
          }
        }
      }
      rafId = requestAnimationFrame(render);
    };

    book.addEventListener("pointermove", (e) => {
      if (prefersReducedMotion) return;
      const rect = book.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      ctx ||= canvas.getContext("2d");
      if (!active) {
        canvas.width = Math.ceil(rect.width / 4);
        canvas.height = Math.ceil(rect.height / 4);
        active = true;
        canvas.hidden = false;
        rafId = requestAnimationFrame(render);
      }
      target.x = ((e.clientX - rect.left) / rect.width) * canvas.width;
      target.y = ((e.clientY - rect.top) / rect.height) * canvas.height;
      if (!pointerIn) {
        pos.x = target.x;
        pos.y = target.y;
        pointerIn = true;
      }
    });

    book.addEventListener("pointerleave", () => {
      pointerIn = false;
      leaveTime = performance.now();
    });

    return stop;
  }

  function initNavigation() {
    const nav = document.querySelector("[data-twostep-nav]");
    if (!nav) return;
    const stopDither = initNavBookDither(nav);
    const toggleBtn = nav.querySelector('[data-nav-toggle="toggle"]');

    const setStatus = (status) => {
      nav.setAttribute("data-nav-status", status);
      const isOpen = status === "active";
      if (!isOpen) stopDither();
      toggleBtn?.setAttribute("aria-expanded", String(isOpen));
      toggleBtn?.setAttribute("aria-label", isOpen ? "Menüyü kapat" : "Menüyü aç");
    };

    const isOpen = () => nav.getAttribute("data-nav-status") === "active";

    document.querySelectorAll('[data-nav-toggle="toggle"]').forEach((btn) => {
      btn.addEventListener("click", () => setStatus(isOpen() ? "not-active" : "active"));
    });

    document.querySelectorAll('[data-nav-toggle="close"]').forEach((el) => {
      el.addEventListener("click", () => setStatus("not-active"));
    });

    nav.querySelectorAll("a[href^='#']").forEach((link) => {
      link.addEventListener("click", () => setStatus("not-active"));
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && isOpen()) setStatus("not-active");
    });
  }

  /* --------------------------------------------------------------------------
     4. WEBGL2 HERO BAYER 8x8 DITHER PLANET (Theme-Reactive!)
     -------------------------------------------------------------------------- */
  function initHeroPlanetDither() {
    const container = document.querySelector("[data-hero-dither]");
    if (!container) return;

    const canvas = document.createElement("canvas");
    canvas.className = "live-dither__canvas";
    canvas.setAttribute("aria-hidden", "true");
    container.appendChild(canvas);

    const gl = canvas.getContext("webgl2", { antialias: false, alpha: false });
    if (!gl) return;

    const vsSource = `#version 300 es
      in vec2 a_pos;
      void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
    `;

    const fsSource = `#version 300 es
      precision highp float;
      uniform vec2 u_res;
      uniform float u_time;
      uniform vec2 u_pointer;
      uniform float u_ripple;
      uniform float u_px;
      uniform vec3 u_bg;
      uniform vec3 u_mid;
      uniform vec3 u_hi;
      uniform float u_isLight;
      out vec4 fragColor;

      const float BAYER[64] = float[64](
         0.0,48.0,12.0,60.0, 3.0,51.0,15.0,63.0,
        32.0,16.0,44.0,28.0,35.0,19.0,47.0,31.0,
         8.0,56.0, 4.0,52.0,11.0,59.0, 7.0,55.0,
        40.0,24.0,36.0,20.0,43.0,27.0,39.0,23.0,
         2.0,50.0,14.0,62.0, 1.0,49.0,13.0,61.0,
        34.0,18.0,46.0,30.0,33.0,17.0,45.0,29.0,
        10.0,58.0, 6.0,54.0, 9.0,57.0, 5.0,53.0,
        42.0,26.0,38.0,22.0,41.0,25.0,37.0,21.0
      );

      float bayer8(vec2 c) {
        int x = int(mod(c.x, 8.0));
        int y = int(mod(c.y, 8.0));
        return BAYER[y * 8 + x] / 64.0;
      }

      void main() {
        float px = max(u_px, 1.0);
        vec2 cell = floor(gl_FragCoord.xy / px);
        vec2 p = cell * px + 0.5 * px;
        vec2 q = (p - vec2(0.68, 0.52) * u_res) / u_res.y;
        vec2 m = (u_pointer - vec2(0.68, 0.52) * u_res) / u_res.y;

        float d = length(q - m);
        float wave = u_ripple * 0.55 * sin(d * 18.0 - u_time * 3.4) * exp(-d * 2.4);

        // Procedural 3D Orbital Sphere + Atmospheric Rings
        float r = length(q);
        float sphere = smoothstep(0.46, 0.08, r + wave * 0.04);
        float angle = atan(q.y, q.x);
        float swirl = sin(r * 14.0 - u_time * 0.9 + sin(angle * 3.0 + u_time * 0.4)) * 0.5 + 0.5;
        float ring = smoothstep(0.09, 0.0, abs(length(q * vec2(0.75, 1.85)) - 0.36 + wave * 0.03));

        // Directional light on sphere
        vec2 lightDir = normalize(vec2(-0.6, 0.5));
        float rim = clamp(dot(normalize(q + 0.0001), lightDir) * 0.5 + 0.5, 0.0, 1.0);

        float lum = clamp(sphere * (0.45 + 0.55 * rim * swirl) + ring * 0.65 + wave * 0.16, 0.0, 1.0);

        float b = bayer8(cell);
        vec3 col = mix(u_bg, u_mid, 1.0 - step(clamp(lum * 2.0, 0.0, 1.0), b));
        col = mix(col, u_hi, 1.0 - step(clamp(lum * 2.0 - 1.0, 0.0, 1.0), b));
        fragColor = vec4(col, 1.0);
      }
    `;

    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    };

    const vs = compile(gl.VERTEX_SHADER, vsSource);
    const fs = compile(gl.FRAGMENT_SHADER, fsSource);
    if (!vs || !fs) return;

    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "u_res");
    const uTime = gl.getUniformLocation(prog, "u_time");
    const uPointer = gl.getUniformLocation(prog, "u_pointer");
    const uRipple = gl.getUniformLocation(prog, "u_ripple");
    const uPx = gl.getUniformLocation(prog, "u_px");
    const uBg = gl.getUniformLocation(prog, "u_bg");
    const uMid = gl.getUniformLocation(prog, "u_mid");
    const uHi = gl.getUniformLocation(prog, "u_hi");

    const syncThemeColors = () => {
      const isDark = getResolvedTheme() === "dark";
      gl.useProgram(prog);
      if (isDark) {
        // Dark Mode: Deep Obsidian bg (#07070c), Electric Cobalt mid (#0004f6), Pale Violet/Lime highlight (#cdccff)
        gl.uniform3fv(uBg, [7 / 255, 7 / 255, 12 / 255]);
        gl.uniform3fv(uMid, [0 / 255, 4 / 255, 246 / 255]);
        gl.uniform3fv(uHi, [205 / 255, 204 / 255, 255 / 255]);
      } else {
        // Light Mode: Warm Light Grey bg (#f2f2f2), Pale Lavender mid (#cdccff), Electric Cobalt highlight (#0004f6)
        gl.uniform3fv(uBg, [242 / 255, 242 / 255, 242 / 255]);
        gl.uniform3fv(uMid, [205 / 255, 204 / 255, 255 / 255]);
        gl.uniform3fv(uHi, [0 / 255, 4 / 255, 246 / 255]);
      }
    };

    syncThemeColors();
    window.addEventListener("theme:changed", syncThemeColors);

    let dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(container.clientWidth * dpr));
      const h = Math.max(1, Math.round(container.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
        gl.uniform2f(uRes, w, h);
        gl.uniform1f(uPx, 4 * dpr);
      }
    };
    window.addEventListener("resize", resize);
    resize();

    let cur = { x: canvas.width * 0.68, y: canvas.height * 0.5 };
    let tgt = { ...cur };
    let ripple = 0.3;
    let tgtRipple = 0.3;

    const host = container.closest("[data-live-dither-host]") || container;
    host.addEventListener("pointermove", (e) => {
      const r = container.getBoundingClientRect();
      tgt.x = (e.clientX - r.left) * dpr;
      tgt.y = (r.height - (e.clientY - r.top)) * dpr;
      tgtRipple = 1.0;
    });
    host.addEventListener("pointerleave", () => {
      tgtRipple = 0.28;
    });

    const t0 = performance.now();
    const tick = (now) => {
      const elapsed = (now - t0) * 0.001;
      cur.x += (tgt.x - cur.x) * 0.12;
      cur.y += (tgt.y - cur.y) * 0.12;
      ripple += (tgtRipple - ripple) * 0.06;

      gl.useProgram(prog);
      gl.uniform1f(uTime, elapsed);
      gl.uniform2f(uPointer, cur.x, cur.y);
      gl.uniform1f(uRipple, ripple);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      canvas.classList.add("is-live");

      if (!prefersReducedMotion) {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  }

  /* --------------------------------------------------------------------------
     5. WEBGL2 CLOSER DITHERED WAVE SHADER (Exact Legency Footer Shader)
     -------------------------------------------------------------------------- */
  function initCloserWaveDither() {
    const canvas = document.querySelector("[data-dithered-wave]");
    const closer = canvas?.closest(".closer");
    if (!canvas || !closer) return;

    const gl = canvas.getContext("webgl2", { antialias: false, alpha: false });
    if (!gl) return;

    const vsSource = `#version 300 es
      in vec2 a_pos;
      void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
    `;

    const fsSource = `#version 300 es
      precision highp float;
      uniform vec2 u_resolution;
      uniform float u_time;
      uniform vec2 u_pointer;
      uniform float u_ripple;
      uniform float u_pxSize;
      uniform vec3 u_bg;
      uniform vec3 u_fg;
      out vec4 fragColor;

      const float BAYER[64] = float[64](
         0.0,48.0,12.0,60.0, 3.0,51.0,15.0,63.0,
        32.0,16.0,44.0,28.0,35.0,19.0,47.0,31.0,
         8.0,56.0, 4.0,52.0,11.0,59.0, 7.0,55.0,
        40.0,24.0,36.0,20.0,43.0,27.0,39.0,23.0,
         2.0,50.0,14.0,62.0, 1.0,49.0,13.0,61.0,
        34.0,18.0,46.0,30.0,33.0,17.0,45.0,29.0,
        10.0,58.0, 6.0,54.0, 9.0,57.0, 5.0,53.0,
        42.0,26.0,38.0,22.0,41.0,25.0,37.0,21.0
      );

      float bayer8(vec2 cell) {
        int x = int(mod(cell.x, 8.0));
        int y = int(mod(cell.y, 8.0));
        return BAYER[y * 8 + x] / 64.0;
      }

      float waveField(vec2 p, float t) {
        float w = 0.0;
        w += sin(p.x * 3.0 + t * 1.15);
        w += sin(p.x * 1.7 - p.y * 2.3 + t * 0.9);
        w += 0.75 * sin(p.y * 4.0 + p.x * 1.1 - t * 1.7);
        w += 0.55 * sin((p.x + p.y) * 2.4 + t * 0.5);
        return w * 0.28;
      }

      void main() {
        vec2 res = u_resolution;
        float px = max(u_pxSize, 1.0);
        vec2 cell = floor(gl_FragCoord.xy / px);
        vec2 cellPx = cell * px + 0.5 * px;
        vec2 uv = (cellPx - 0.5 * res) / res.y;

        float w = waveField(uv, u_time);
        vec2 m = (u_pointer - 0.5 * res) / res.y;
        float d = length(uv - m);
        w += u_ripple * 0.6 * sin(d * 16.0 - u_time * 3.2) * exp(-d * 2.2);

        float r = length(uv * vec2(0.85, 1.0));
        float glow = smoothstep(0.66, 0.0, r + 0.12 * w);
        float intensity = clamp(mix(glow, 0.5 + 0.5 * w, 0.3) * 0.85 - 0.12, 0.0, 1.0);

        float bit = step(bayer8(cell), intensity);
        fragColor = vec4(mix(u_bg, u_fg, bit), 1.0);
      }
    `;

    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    };

    const vs = compile(gl.VERTEX_SHADER, vsSource);
    const fs = compile(gl.FRAGMENT_SHADER, fsSource);
    if (!vs || !fs) return;

    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "u_resolution");
    const uTime = gl.getUniformLocation(prog, "u_time");
    const uPointer = gl.getUniformLocation(prog, "u_pointer");
    const uRipple = gl.getUniformLocation(prog, "u_ripple");
    const uPx = gl.getUniformLocation(prog, "u_pxSize");

    gl.uniform3fv(gl.getUniformLocation(prog, "u_bg"), [0, 0, 0]);
    gl.uniform3fv(gl.getUniformLocation(prog, "u_fg"), [0, 4 / 255, 246 / 255]);

    let dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
        gl.uniform2f(uRes, w, h);
        gl.uniform1f(uPx, 4 * dpr);
      }
    };
    window.addEventListener("resize", resize);
    resize();

    let cur = { x: canvas.width / 2, y: canvas.height / 2 };
    let tgt = { ...cur };
    let ripple = 0;
    let tgtRipple = 0;

    closer.addEventListener("pointermove", (e) => {
      const r = canvas.getBoundingClientRect();
      tgt.x = (e.clientX - r.left) * dpr;
      tgt.y = (r.height - (e.clientY - r.top)) * dpr;
      tgtRipple = 1;
    });
    closer.addEventListener("pointerleave", () => {
      tgtRipple = 0;
    });

    const t0 = performance.now();
    const tick = (now) => {
      const elapsed = (now - t0) * 0.001;
      cur.x += (tgt.x - cur.x) * 0.12;
      cur.y += (tgt.y - cur.y) * 0.12;
      ripple += (tgtRipple - ripple) * 0.06;

      gl.useProgram(prog);
      gl.uniform1f(uTime, elapsed);
      gl.uniform2f(uPointer, cur.x, cur.y);
      gl.uniform1f(uRipple, ripple);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      canvas.classList.add("is-live");

      if (!prefersReducedMotion) {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  }

  /* --------------------------------------------------------------------------
     6. CYCLING CLIENT / TECH STACK WALL
     -------------------------------------------------------------------------- */
  function initCyclingWall() {
    const wall = document.querySelector("[data-logo-wall]");
    if (!wall || prefersReducedMotion) return;

    const slots = Array.from(wall.querySelectorAll(".logo-wall__item"));
    const pool = [
      "GastroMind SaaS", "GastroQR Cloud", "Gastrofy POS", "Omega Call WebRTC",
      "Stark Mark 85 3D", "VRMF C++ Codec", "Nur İslami Yaşam", "Paylaş Gitsin",
      "Zara HVAC Web", "Erkol Matbaa", "Flutter & Dart", "Firebase Cloud"
    ];
    let idx = 8;

    setInterval(() => {
      const randomSlot = slots[Math.floor(Math.random() * slots.length)];
      const target = randomSlot?.querySelector(".logo-wall__target");
      if (!target) return;

      const nextName = pool[idx % pool.length];
      idx++;

      target.style.opacity = "0";
      target.style.transform = "translateY(-14px)";

      setTimeout(() => {
        target.innerHTML = `<span class="dot"></span>${nextName}`;
        target.style.transform = "translateY(14px)";
        requestAnimationFrame(() => {
          target.style.opacity = "1";
          target.style.transform = "translateY(0)";
        });
      }, 350);
    }, 2400);
  }

  /* --------------------------------------------------------------------------
     7. PROJECT FILTERING, FEATURE TABS & TESTIMONIAL SLIDER
     -------------------------------------------------------------------------- */
  function initInteractiveSections() {
    // Project Filters
    const filterBtns = document.querySelectorAll("[data-filter-btn]");
    const projectCards = document.querySelectorAll("[data-project-cat]");

    filterBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const cat = btn.getAttribute("data-filter-btn");
        filterBtns.forEach((b) => b.classList.toggle("is-active", b === btn));

        projectCards.forEach((card) => {
          const tags = (card.getAttribute("data-project-cat") || "").split(" ");
          const match = cat === "all" || tags.includes(cat);
          card.classList.toggle("is-hidden", !match);
        });
      });
    });

    // Separates Feature Showcase Tabs + Auto-Cycle
    const tabs = Array.from(document.querySelectorAll("[data-feature-tab]"));
    const items = Array.from(document.querySelectorAll("[data-feature-item]"));
    const visuals = Array.from(document.querySelectorAll("[data-feature-visual]"));
    const progressBar = document.querySelector("[data-feature-progress]");

    const activateFeature = (index) => {
      tabs.forEach((t, i) => t.classList.toggle("is-active", i === index));
      items.forEach((item, i) => item.classList.toggle("is-active", i === index));
      visuals.forEach((vis, i) => vis.classList.toggle("is-active", i === index));
      if (progressBar) {
        progressBar.style.transform = `scaleX(${(index + 1) / items.length})`;
      }
    };

    tabs.forEach((tab, idx) => {
      tab.addEventListener("click", () => activateFeature(idx));
    });

    // Testimonial Slider
    const cards = Array.from(document.querySelectorAll("[data-testimonial-card]"));
    const prevBtn = document.querySelector("[data-testimonial-prev]");
    const nextBtn = document.querySelector("[data-testimonial-next]");
    const currentEl = document.querySelector("[data-testimonial-current]");
    let currentIdx = 0;

    const showSlide = (i) => {
      currentIdx = (i + cards.length) % cards.length;
      cards.forEach((c, idx) => c.classList.toggle("is--active", idx === currentIdx));
      if (currentEl) currentEl.textContent = String(currentIdx + 1);
    };

    prevBtn?.addEventListener("click", () => showSlide(currentIdx - 1));
    nextBtn?.addEventListener("click", () => showSlide(currentIdx + 1));
  }

  /* --------------------------------------------------------------------------
     8. GSAP SCROLL ANIMATIONS (Pixelated Scroll Reveal, Arc Marquee, Roll Text)
     -------------------------------------------------------------------------- */
  function initScrollAnimations() {
    if (typeof gsap === "undefined" || prefersReducedMotion) return;
    if (typeof ScrollTrigger !== "undefined") {
      gsap.registerPlugin(ScrollTrigger);
    }

    // Curved SVG Arc Marquee
    document.querySelectorAll("[data-arc-marquee]").forEach((textPath) => {
      const unit = textPath.getAttribute("data-arc-unit") || "Webflow, Tasarım & Interaktif Mühendislik — ";
      const reps = 8;
      textPath.textContent = unit.repeat(reps);

      const runArc = () => {
        const totalLen = textPath.getComputedTextLength();
        if (!totalLen) return;
        const unitLen = totalLen / reps;
        const state = { x: 0 };
        gsap.to(state, {
          x: unitLen,
          duration: unitLen / 55,
          ease: "none",
          repeat: -1,
          onUpdate: () => textPath.setAttribute("startOffset", `${-state.x}px`),
        });
      };
      runArc();
    });

    // Pixelated Scroll Section Transition
    document.querySelectorAll("[data-pixelated-scroll-transition]").forEach((wrapper) => {
      const cols = window.innerWidth <= 767 ? 10 : 22;
      const rows = 5;
      const panel = document.createElement("div");
      panel.setAttribute("data-pixelated-scroll-panel", "");

      const pixels = [];
      for (let c = 0; c < cols; c++) {
        const col = document.createElement("div");
        col.setAttribute("data-pixelated-scroll-column", "");
        for (let r = 0; r < rows; r++) {
          const px = document.createElement("div");
          px.setAttribute("data-pixelated-scroll-pixel", "");
          col.appendChild(px);
          pixels.push({
            el: px,
            priority: (rows - 1 - r) * 50 + Math.random() * 260 + Math.sin(c * 0.3) * 30,
          });
        }
        panel.appendChild(col);
      }
      wrapper.appendChild(panel);
      pixels.sort((a, b) => a.priority - b.priority);

      if (typeof ScrollTrigger !== "undefined") {
        gsap.fromTo(
          pixels.map((p) => p.el),
          { autoAlpha: 1 },
          {
            autoAlpha: 0,
            duration: 0.1,
            stagger: { amount: 1.2, from: "start" },
            ease: "none",
            scrollTrigger: {
              trigger: wrapper.closest("section") || wrapper,
              start: "top bottom",
              end: "top 35%",
              scrub: 0.3,
            },
          }
        );
      }
    });

    // Character Rolling H2 Headings (Legency signature `te()` effect)
    document.querySelectorAll("[data-roll-heading]").forEach((h2) => {
      const rawText = h2.textContent.trim();
      h2.setAttribute("aria-label", rawText);
      const words = rawText.split(/\s+/);
      h2.innerHTML = "";

      const letters = [];
      words.forEach((word, wIdx) => {
        const wordSpan = document.createElement("span");
        wordSpan.style.display = "inline-block";
        wordSpan.style.overflow = "hidden";
        wordSpan.style.verticalAlign = "bottom";

        Array.from(word).forEach((ch) => {
          const wrap = document.createElement("span");
          wrap.className = "roll-letter";

          const orig = document.createElement("span");
          orig.className = "roll-char";
          orig.textContent = ch;

          const twin = document.createElement("span");
          twin.className = "roll-char";
          twin.setAttribute("data-roll-twin", "");
          twin.textContent = ch;

          wrap.appendChild(orig);
          wrap.appendChild(twin);
          wordSpan.appendChild(wrap);
          letters.push(wrap);
        });

        h2.appendChild(wordSpan);
        if (wIdx < words.length - 1) {
          h2.appendChild(document.createTextNode(" "));
        }
      });

      if (typeof ScrollTrigger !== "undefined") {
        gsap.to(letters, {
          yPercent: 100,
          "--roll-fade": 1,
          duration: 0.9,
          ease: "power2.inOut",
          stagger: { amount: 0.35, from: "random" },
          scrollTrigger: {
            trigger: h2,
            start: "top 86%",
            once: true,
          },
        });
      }
    });
  }

  /* --------------------------------------------------------------------------
     BOOT ALL MODULES
     -------------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    initThemeToggle();
    initNavigation();
    initHeroPlanetDither();
    initCloserWaveDither();
    initCyclingWall();
    initInteractiveSections();
    initPageTransition();
    initScrollAnimations();
  });
})();
