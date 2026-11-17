/* UPVC Club — "Try at Home" visualizer.
   Live camera (or an uploaded photo / sample room) with a window or door
   rendered on top in true perspective. Drag the four corners to fit the
   opening, pinch or drag to move, pick style / finish / glass, then capture
   and share. Everything runs on the device; nothing is uploaded. */
(function () {
  "use strict";

  const F = window.UPVCFrames;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const params = new URLSearchParams(location.search);

  const el = {
    stage: $("#viz-stage"), video: $("#viz-video"), photo: $("#viz-photo"), canvas: $("#viz-overlay"),
    outline: $("#viz-outline polygon"), handles: $$(".viz-handle"), hint: $("#viz-hint"), start: $("#viz-start"),
    error: $("#viz-error"), opts: $("#viz-opts"), tabs: $$(".viz-tab"), file: $("#viz-file"), sheet: $("#viz-result"),
    resultImg: $("#viz-result-img"), help: $("#viz-help"), toast: $("#viz-toast"), flash: $(".viz-flash"),
    subtitle: $("#viz-subtitle"), quote: $$(".viz-quote-link"), pauseBtn: $("#viz-pause"), flipBtn: $("#viz-flip"),
    cleanBtn: $("#viz-clean"),
  };

  const state = {
    type: F.TYPES.some((t) => t.id === params.get("type")) ? params.get("type") : "sliding-window",
    finish: F.FINISHES.some((t) => t.id === params.get("finish")) ? params.get("finish") : "white",
    glass: F.GLASSES.some((t) => t.id === params.get("glass")) ? params.get("glass") : "clear",
    opacity: 1, brightness: 1,
    corners: null, // normalised [[x,y] x4] TL, TR, BR, BL (0..1 of stage)
    source: null, // 'camera' | 'photo'
    facing: "environment", stream: null, paused: false, productName: "", tab: "style",
  };

  let raster = null; // offscreen canvas with the product
  let rasterJob = 0;
  let W = 0, H = 0, DPR = 1;

  /* ---------------- geometry ---------------- */
  function homography(q) {
    // unit square -> quad (Heckbert)
    const [x0, y0] = q[0], [x1, y1] = q[1], [x2, y2] = q[2], [x3, y3] = q[3];
    const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
    const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
    let g = 0, h = 0;
    if (Math.abs(dx3) > 1e-9 || Math.abs(dy3) > 1e-9) {
      const den = dx1 * dy2 - dx2 * dy1;
      g = (dx3 * dy2 - dx2 * dy3) / den;
      h = (dx1 * dy3 - dx3 * dy1) / den;
    }
    const a = x1 - x0 + g * x1, b = x3 - x0 + h * x3, c = x0;
    const d = y1 - y0 + g * y1, e = y3 - y0 + h * y3, f = y0;
    return (u, v) => { const w = g * u + h * v + 1; return [(a * u + b * v + c) / w, (d * u + e * v + f) / w]; };
  }

  function drawTri(ctx, img, s, d) {
    const [x0, y0] = s[0], [x1, y1] = s[1], [x2, y2] = s[2];
    const [u0, v0] = d[0], [u1, v1] = d[1], [u2, v2] = d[2];
    const det = x0 * (y1 - y2) + x1 * (y2 - y0) + x2 * (y0 - y1);
    if (Math.abs(det) < 1e-9) return;
    const a = (u0 * (y1 - y2) + u1 * (y2 - y0) + u2 * (y0 - y1)) / det;
    const c = (u0 * (x2 - x1) + u1 * (x0 - x2) + u2 * (x1 - x0)) / det;
    const e = (u0 * (x1 * y2 - x2 * y1) + u1 * (x2 * y0 - x0 * y2) + u2 * (x0 * y1 - x1 * y0)) / det;
    const b = (v0 * (y1 - y2) + v1 * (y2 - y0) + v2 * (y0 - y1)) / det;
    const dd = (v0 * (x2 - x1) + v1 * (x0 - x2) + v2 * (x1 - x0)) / det;
    const f = (v0 * (x1 * y2 - x2 * y1) + v1 * (x2 * y0 - x0 * y2) + v2 * (x0 * y1 - x1 * y0)) / det;
    // expand the clip triangle slightly to hide seams
    const cx = (u0 + u1 + u2) / 3, cy = (v0 + v1 + v2) / 3;
    const grow = (px, py) => { const dx = px - cx, dy = py - cy, l = Math.hypot(dx, dy) || 1; return [px + (dx / l) * 0.7, py + (dy / l) * 0.7]; };
    const p0 = grow(u0, v0), p1 = grow(u1, v1), p2 = grow(u2, v2);
    ctx.save();
    ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.closePath();
    ctx.clip();
    ctx.transform(a, b, c, dd, e, f);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }

  function warp(ctx, img, quad, n) {
    const iw = img.width, ih = img.height, H2 = homography(quad);
    const pts = [];
    for (let j = 0; j <= n; j++) {
      const row = [];
      for (let i = 0; i <= n; i++) row.push(H2(i / n, j / n));
      pts.push(row);
    }
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const s00 = [(i / n) * iw, (j / n) * ih], s10 = [((i + 1) / n) * iw, (j / n) * ih];
        const s01 = [(i / n) * iw, ((j + 1) / n) * ih], s11 = [((i + 1) / n) * iw, ((j + 1) / n) * ih];
        drawTri(ctx, img, [s00, s10, s11], [pts[j][i], pts[j][i + 1], pts[j + 1][i + 1]]);
        drawTri(ctx, img, [s00, s11, s01], [pts[j][i], pts[j + 1][i + 1], pts[j + 1][i]]);
      }
    }
  }

  /* Exact perspective rendering with WebGL: per-pixel inverse homography. */
  function homMatrix(q) {
    const [x0, y0] = q[0], [x1, y1] = q[1], [x2, y2] = q[2], [x3, y3] = q[3];
    const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
    const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
    let g = 0, h = 0;
    if (Math.abs(dx3) > 1e-9 || Math.abs(dy3) > 1e-9) {
      const den = dx1 * dy2 - dx2 * dy1;
      g = (dx3 * dy2 - dx2 * dy3) / den;
      h = (dx1 * dy3 - dx3 * dy1) / den;
    }
    return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h, 1];
  }
  function invert3(m) {
    const [a, b, c, d, e, f, g, h, i] = m;
    const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
    const det = a * A + b * B + c * C;
    if (Math.abs(det) < 1e-12) return null;
    const k = 1 / det;
    return [A * k, -(b * i - c * h) * k, (b * f - c * e) * k, B * k, (a * i - c * g) * k, -(a * f - c * d) * k, C * k, -(a * h - b * g) * k, (a * e - b * d) * k];
  }

  function createGL(canvas) {
    const gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false, preserveDrawingBuffer: false });
    if (!gl) return null;
    const vs = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
    const fs = `precision highp float;
      uniform sampler2D t; uniform mat3 m; uniform vec2 res; uniform float scale; uniform float alpha;
      void main(){
        vec2 p = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y) / scale;
        vec3 uv = m * vec3(p, 1.0);
        vec2 st = uv.xy / uv.z;
        if (uv.z <= 0.0 || st.x < 0.0 || st.y < 0.0 || st.x > 1.0 || st.y > 1.0) discard;
        gl_FragColor = texture2D(t, st) * alpha;
      }`;
    const sh = (type, src) => { const o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); return o; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const tex = gl.createTexture();
    const u = (n) => gl.getUniformLocation(prog, n);
    const U = { m: u("m"), res: u("res"), scale: u("scale"), alpha: u("alpha") };
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    let hasTex = false;
    return {
      setImage(src) {
        // power-of-two copy so we can mipmap (crisp when the window is small on screen)
        const pot = (n) => Math.min(2048, Math.pow(2, Math.ceil(Math.log2(Math.max(256, n)))));
        const c = document.createElement("canvas");
        c.width = pot(src.width); c.height = pot(src.height);
        c.getContext("2d").drawImage(src, 0, 0, c.width, c.height);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        hasTex = true;
      },
      render(quad, scale, alpha) {
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        if (!hasTex || !quad) return;
        const inv = invert3(homMatrix(quad));
        if (!inv) return;
        // GLSL mat3 is column-major
        gl.uniformMatrix3fv(U.m, false, new Float32Array([inv[0], inv[3], inv[6], inv[1], inv[4], inv[7], inv[2], inv[5], inv[8]]));
        gl.uniform2f(U.res, canvas.width, canvas.height);
        gl.uniform1f(U.scale, scale);
        gl.uniform1f(U.alpha, alpha);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      },
      clear() { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); },
    };
  }
  const glr = createGL(el.canvas);

  const px = (c) => [c[0] * W, c[1] * H];
  const quadPx = () => state.corners.map(px);

  function inside(pt, poly) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  }

  /* ---------------- product raster ---------------- */
  function rasterize() {
    const job = ++rasterJob;
    const type = F.byId(F.TYPES, state.type);
    const maxSide = 1400;
    const scale = maxSide / Math.max(type.w, type.h);
    const w = Math.round(type.w * scale), h = Math.round(type.h * scale);
    const svg = F.svg(state.type, { finish: state.finish, glass: state.glass, width: w, height: h });
    const img = new Image();
    img.decoding = "async";
    return new Promise((resolve) => {
      img.onload = () => {
        if (job !== rasterJob) return resolve();
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        const x = c.getContext("2d");
        x.drawImage(img, 0, 0, w, h);
        const b = state.brightness;
        if (Math.abs(b - 1) > 0.01) {
          x.globalCompositeOperation = "source-atop";
          x.fillStyle = b < 1 ? `rgba(0,0,0,${(1 - b).toFixed(3)})` : `rgba(255,255,255,${Math.min(0.6, b - 1).toFixed(3)})`;
          x.fillRect(0, 0, w, h);
        }
        raster = c;
        if (glr) glr.setImage(c);
        draw();
        resolve();
      };
      img.onerror = () => resolve();
      img.src = F.toDataURL(svg);
    });
  }

  /* ---------------- drawing ---------------- */
  let raf = 0, fast = false;
  function draw() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      if (!state.corners) { if (glr) glr.clear(); return; }
      const q = quadPx();
      if (glr) {
        glr.render(raster ? q : null, DPR, state.opacity);
      } else {
        const ctx = el.canvas.getContext("2d");
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, el.canvas.width, el.canvas.height);
        if (raster) {
          ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
          ctx.globalAlpha = state.opacity;
          warp(ctx, raster, q, fast ? 8 : 18);
          ctx.globalAlpha = 1;
        }
      }
      el.outline.setAttribute("points", q.map((p) => p.join(",")).join(" "));
      el.handles.forEach((hd, i) => { hd.style.transform = `translate(${q[i][0]}px, ${q[i][1]}px)`; });
    });
  }

  function resize() {
    const r = el.stage.getBoundingClientRect();
    W = r.width; H = r.height; DPR = Math.min(window.devicePixelRatio || 1, 2);
    el.canvas.width = Math.round(W * DPR); el.canvas.height = Math.round(H * DPR);
    $("#viz-outline").setAttribute("viewBox", `0 0 ${W} ${H}`);
    if (!state.corners) resetCorners(); else draw();
  }

  function resetCorners() {
    const type = F.byId(F.TYPES, state.type);
    const ar = type.w / type.h;
    let w = W * 0.62, h = w / ar;
    if (h > H * 0.62) { h = H * 0.62; w = h * ar; }
    const x = (W - w) / 2, y = (H - h) / 2.2;
    state.corners = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(([a, b]) => [a / W, b / H]);
    draw();
  }

  // When changing type, keep the centre & width but adapt the aspect ratio
  function refitForType() {
    if (!state.corners) return resetCorners();
    const q = quadPx();
    const cx = q.reduce((s, p) => s + p[0], 0) / 4, cy = q.reduce((s, p) => s + p[1], 0) / 4;
    const width = (Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]) + Math.hypot(q[2][0] - q[3][0], q[2][1] - q[3][1])) / 2;
    const type = F.byId(F.TYPES, state.type);
    let w = width, h = w * type.h / type.w;
    if (h > H * 0.9) { h = H * 0.9; w = h * type.w / type.h; }
    state.corners = [[cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2], [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2]].map(([a, b]) => [a / W, b / H]);
  }

  /* ---------------- gestures ---------------- */
  const pointers = new Map();
  let gesture = null;

  function stagePoint(e) {
    const r = el.stage.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  el.handles.forEach((hd, i) => {
    hd.addEventListener("pointerdown", (e) => {
      e.preventDefault(); e.stopPropagation();
      hd.setPointerCapture(e.pointerId);
      hd.classList.add("is-drag");
      fast = true; hideHint();
      const move = (ev) => {
        const [x, y] = stagePoint(ev);
        state.corners[i] = [Math.max(-0.2, Math.min(1.2, x / W)), Math.max(-0.2, Math.min(1.2, y / H))];
        draw();
      };
      const up = () => {
        hd.classList.remove("is-drag"); fast = false; draw();
        hd.removeEventListener("pointermove", move); hd.removeEventListener("pointerup", up); hd.removeEventListener("pointercancel", up);
      };
      hd.addEventListener("pointermove", move); hd.addEventListener("pointerup", up); hd.addEventListener("pointercancel", up);
    });
    hd.addEventListener("keydown", (e) => {
      const step = (e.shiftKey ? 10 : 2);
      const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (!d) return;
      e.preventDefault();
      state.corners[i] = [state.corners[i][0] + d[0] / W, state.corners[i][1] + d[1] / H];
      draw();
    });
  });

  el.stage.addEventListener("pointerdown", (e) => {
    if (!state.corners || !state.source || e.target.closest(".viz-handle, .viz-start, button, a")) return;
    pointers.set(e.pointerId, stagePoint(e));
    el.stage.setPointerCapture(e.pointerId);
    startGesture();
  });
  el.stage.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId) || !gesture) return;
    pointers.set(e.pointerId, stagePoint(e));
    updateGesture();
  });
  const endPointer = (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size) startGesture(); else { gesture = null; fast = false; draw(); }
  };
  el.stage.addEventListener("pointerup", endPointer);
  el.stage.addEventListener("pointercancel", endPointer);

  function startGesture() {
    const pts = Array.from(pointers.values());
    const q = quadPx();
    if (pts.length === 1) {
      if (!inside(pts[0], q)) { gesture = null; return; }
      gesture = { kind: "move", start: pts[0], quad: q };
    } else {
      const [a, b] = pts;
      gesture = { kind: "pinch", quad: q, mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], dist: Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, ang: Math.atan2(b[1] - a[1], b[0] - a[0]) };
    }
    fast = true; hideHint();
  }

  function updateGesture() {
    const pts = Array.from(pointers.values());
    if (gesture.kind === "move" && pts.length === 1) {
      const dx = pts[0][0] - gesture.start[0], dy = pts[0][1] - gesture.start[1];
      state.corners = gesture.quad.map(([x, y]) => [(x + dx) / W, (y + dy) / H]);
    } else if (gesture.kind === "pinch" && pts.length >= 2) {
      const [a, b] = pts;
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const s = Math.hypot(b[0] - a[0], b[1] - a[1]) / gesture.dist;
      const rot = Math.atan2(b[1] - a[1], b[0] - a[0]) - gesture.ang;
      const cos = Math.cos(rot), sin = Math.sin(rot);
      state.corners = gesture.quad.map(([x, y]) => {
        const rx = x - gesture.mid[0], ry = y - gesture.mid[1];
        return [(mid[0] + s * (rx * cos - ry * sin)) / W, (mid[1] + s * (rx * sin + ry * cos)) / H];
      });
    }
    draw();
  }

  el.stage.addEventListener("wheel", (e) => {
    if (!state.corners) return;
    e.preventDefault();
    const q = quadPx();
    const cx = q.reduce((s, p) => s + p[0], 0) / 4, cy = q.reduce((s, p) => s + p[1], 0) / 4;
    const s = Math.exp(-e.deltaY * 0.0015);
    state.corners = q.map(([x, y]) => [(cx + (x - cx) * s) / W, (cy + (y - cy) * s) / H]);
    hideHint(); draw();
  }, { passive: false });

  function hideHint() { el.hint.classList.add("is-gone"); }

  /* ---------------- sources ---------------- */
  function showError(msg) { el.error.textContent = msg; el.error.classList.add("is-on"); }

  async function startCamera() {
    el.error.classList.remove("is-on");
    if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showError("Your browser can't open the camera here. Please upload a photo of your room instead (the site must be opened over https).");
      return;
    }
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: state.facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      state.stream = stream;
      el.video.srcObject = stream;
      el.video.style.transform = state.facing === "user" ? "scaleX(-1)" : "";
      await el.video.play().catch(() => {});
      setSource("camera");
    } catch (err) {
      const name = err && err.name;
      if (name === "NotAllowedError" || name === "SecurityError") showError("Camera permission was blocked. Allow camera access in your browser settings, or upload a photo instead.");
      else if (name === "NotFoundError" || name === "OverconstrainedError") showError("No camera was found on this device. Upload a photo of your room instead.");
      else showError("Couldn't start the camera. Try again or upload a photo instead.");
    }
  }

  function stopCamera() {
    if (state.stream) state.stream.getTracks().forEach((t) => t.stop());
    state.stream = null;
  }

  function setSource(kind) {
    state.source = kind;
    state.paused = false;
    el.stage.classList.remove("viz-paused");
    el.video.hidden = kind !== "camera";
    el.photo.hidden = kind !== "photo";
    if (kind !== "camera") stopCamera();
    el.start.hidden = true;
    el.pauseBtn.hidden = kind !== "camera";
    el.flipBtn.hidden = kind !== "camera";
    resize();
    if (!localStorage_get("upvc-viz-help")) openSheet(el.help);
  }

  function loadPhoto(src, corners) {
    return new Promise((resolve) => {
      el.photo.onload = () => {
        setSource("photo");
        if (corners) {
          // corners are given in image-normalised space; map into the contain rect
          const r = mediaRect();
          state.corners = corners.map(([x, y]) => [(r.x + x * r.w) / W, (r.y + y * r.h) / H]);
          draw();
        }
        resolve();
      };
      el.photo.src = src;
    });
  }

  el.file.addEventListener("change", () => {
    const f = el.file.files && el.file.files[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    loadPhoto(url);
    el.file.value = "";
  });

  /* Sample room, drawn procedurally so it works offline */
  function sampleRoom() {
    const c = document.createElement("canvas");
    const w = 1600, h = 1200;
    c.width = w; c.height = h;
    const x = c.getContext("2d");
    let g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#e2d8c8"); g.addColorStop(1, "#cbbda8");
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    // opening
    const o = { x: 430, y: 230, w: 740, h: 560 };
    g = x.createLinearGradient(0, o.y, 0, o.y + o.h);
    g.addColorStop(0, "#7fb0dc"); g.addColorStop(0.7, "#cfe0ea"); g.addColorStop(1, "#e9dcc4");
    x.fillStyle = g; x.fillRect(o.x, o.y, o.w, o.h);
    // skyline
    x.fillStyle = "#9fb3c4";
    [[0, 260], [70, 330], [150, 220], [230, 300], [330, 250], [420, 360], [520, 280], [610, 330], [680, 240]].forEach(([dx, bh]) => x.fillRect(o.x + dx, o.y + o.h - bh, 80, bh));
    x.fillStyle = "#7f9a76";
    x.beginPath(); x.moveTo(o.x, o.y + o.h);
    for (let i = 0; i <= 20; i++) x.lineTo(o.x + (i / 20) * o.w, o.y + o.h - 70 - Math.sin(i * 1.3) * 26);
    x.lineTo(o.x + o.w, o.y + o.h); x.fill();
    // reveal / plaster depth
    x.fillStyle = "rgba(0,0,0,0.12)"; x.fillRect(o.x - 18, o.y - 18, o.w + 36, 18); x.fillRect(o.x - 18, o.y, 18, o.h);
    x.fillStyle = "#efe7da"; x.fillRect(o.x - 30, o.y + o.h, o.w + 60, 26);
    // floor
    g = x.createLinearGradient(0, 960, 0, h);
    g.addColorStop(0, "#9b7f60"); g.addColorStop(1, "#7a6248");
    x.fillStyle = g; x.fillRect(0, 960, w, h - 960);
    x.strokeStyle = "rgba(0,0,0,0.08)"; x.lineWidth = 3;
    for (let i = -10; i < 30; i++) { x.beginPath(); x.moveTo(i * 120, h); x.lineTo(w / 2 + (i - 10) * 30, 960); x.stroke(); }
    x.fillStyle = "#e9e1d4"; x.fillRect(0, 945, w, 18);
    // sofa
    x.fillStyle = "#3f4a5c"; roundRect(x, 140, 820, 560, 210, 30); x.fill();
    x.fillStyle = "#4b5870"; roundRect(x, 170, 760, 500, 120, 26); x.fill();
    x.fillStyle = "#2f3848"; x.fillRect(170, 1030, 16, 40); x.fillRect(674, 1030, 16, 40);
    x.fillStyle = "#c56a46"; roundRect(x, 210, 790, 120, 90, 18); x.fill();
    // plant
    x.fillStyle = "#b28a62"; roundRect(x, 1270, 900, 120, 140, 16); x.fill();
    x.fillStyle = "#4f7a4a";
    for (let i = 0; i < 9; i++) { x.beginPath(); x.ellipse(1330 + Math.cos(i) * 60, 840 - i * 26, 30, 70, i * 0.7, 0, Math.PI * 2); x.fill(); }
    // lamp
    x.strokeStyle = "#2a2a2a"; x.lineWidth = 6; x.beginPath(); x.moveTo(1180, 1060); x.lineTo(1180, 640); x.stroke();
    x.fillStyle = "#f1e3c2"; x.beginPath(); x.moveTo(1130, 640); x.lineTo(1230, 640); x.lineTo(1210, 560); x.lineTo(1150, 560); x.fill();
    // soft vignette
    g = x.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0.25)");
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    return { src: c.toDataURL("image/jpeg", 0.9), corners: [[o.x / w, o.y / h], [(o.x + o.w) / w, o.y / h], [(o.x + o.w) / w, (o.y + o.h) / h], [o.x / w, (o.y + o.h) / h]] };
  }
  function roundRect(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }

  function useSample() {
    const s = sampleRoom();
    return loadPhoto(s.src, s.corners);
  }

  /* where the media is drawn inside the stage */
  function mediaRect() {
    const isVideo = state.source === "camera";
    const nw = isVideo ? el.video.videoWidth : el.photo.naturalWidth;
    const nh = isVideo ? el.video.videoHeight : el.photo.naturalHeight;
    if (!nw || !nh) return { x: 0, y: 0, w: W, h: H, nw: W, nh: H };
    const s = isVideo ? Math.max(W / nw, H / nh) : Math.min(W / nw, H / nh);
    const w = nw * s, h = nh * s;
    return { x: (W - w) / 2, y: (H - h) / 2, w, h, nw, nh, s };
  }

  /* ---------------- capture ---------------- */
  let lastBlob = null;
  async function capture() {
    if (!state.source) return;
    const r = mediaRect();
    // visible region of media within the stage
    const vx = Math.max(0, r.x), vy = Math.max(0, r.y);
    const vw = Math.min(W, r.x + r.w) - vx, vh = Math.min(H, r.y + r.h) - vy;
    let k = r.nw / r.w; // media px per stage px
    const maxOut = 2400;
    if (vw * k > maxOut) k = maxOut / vw;
    const out = document.createElement("canvas");
    out.width = Math.round(vw * k); out.height = Math.round(vh * k);
    const x = out.getContext("2d");
    const media = state.source === "camera" ? el.video : el.photo;
    const sx = (vx - r.x) / r.w * r.nw, sy = (vy - r.y) / r.h * r.nh, sw = vw / r.w * r.nw, sh = vh / r.h * r.nh;
    if (state.source === "camera" && state.facing === "user") {
      x.save(); x.translate(out.width, 0); x.scale(-1, 1);
      x.drawImage(media, r.nw - sx - sw, sy, sw, sh, 0, 0, out.width, out.height);
      x.restore();
    } else {
      x.drawImage(media, sx, sy, sw, sh, 0, 0, out.width, out.height);
    }
    if (raster && state.corners) {
      const q = quadPx().map(([a, b]) => [(a - vx) * k, (b - vy) * k]);
      const gc = document.createElement("canvas");
      gc.width = out.width; gc.height = out.height;
      const r2 = glr ? createGL(gc) : null;
      if (r2) {
        r2.setImage(raster);
        r2.render(q, 1, state.opacity);
        x.drawImage(gc, 0, 0);
      } else {
        x.globalAlpha = state.opacity;
        warp(x, raster, q, 24);
        x.globalAlpha = 1;
      }
    }
    // watermark
    const fs = Math.max(14, Math.round(out.width * 0.018));
    x.font = `700 ${fs}px Manrope, system-ui, sans-serif`;
    const label = `UPVC Club · ${F.byId(F.TYPES, state.type).name} · ${F.byId(F.FINISHES, state.finish).name}`;
    const tw = x.measureText(label).width;
    x.fillStyle = "rgba(11,27,51,0.7)";
    x.fillRect(out.width - tw - fs * 2, out.height - fs * 2.4, tw + fs * 1.4, fs * 1.8);
    x.fillStyle = "#fff";
    x.fillText(label, out.width - tw - fs * 1.3, out.height - fs * 1.1);

    if (window.gsap) gsap.fromTo(el.flash, { opacity: 0.85 }, { opacity: 0, duration: 0.6, ease: "power2.out" });
    lastBlob = await new Promise((res) => out.toBlob(res, "image/jpeg", 0.92));
    if (el.resultImg.src.startsWith("blob:")) URL.revokeObjectURL(el.resultImg.src);
    el.resultImg.src = lastBlob ? URL.createObjectURL(lastBlob) : out.toDataURL("image/jpeg", 0.9);
    openSheet(el.sheet);
  }

  function filename() { return `upvc-club-${state.type}-${state.finish}.jpg`; }

  $("#viz-download").addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = el.resultImg.src; a.download = filename();
    document.body.appendChild(a); a.click(); a.remove();
    toast("Saved to your downloads");
  });
  $("#viz-share").addEventListener("click", async () => {
    try {
      const file = lastBlob ? new File([lastBlob], filename(), { type: "image/jpeg" }) : null;
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "My UPVC Club window", text: configText() });
      } else if (navigator.share) {
        await navigator.share({ title: "UPVC Club", text: configText(), url: location.href });
      } else {
        $("#viz-download").click();
      }
    } catch (e) { /* share cancelled */ }
  });

  function configText() {
    const t = F.byId(F.TYPES, state.type).name, f = F.byId(F.FINISHES, state.finish).name, g = F.byId(F.GLASSES, state.glass).name;
    return `${state.productName ? state.productName + " — " : ""}${t}, ${f} frame, ${g} glass`;
  }
  function updateQuoteLinks() {
    const q = `contact.html?product=${encodeURIComponent(state.productName || F.byId(F.TYPES, state.type).name)}&config=${encodeURIComponent(configText())}`;
    el.quote.forEach((a) => (a.href = q));
    $$(".dynamic-whatsapp-link", document).forEach((a) => (a.dataset.waText = `Hi UPVC Club, I'd like a quote for: ${configText()}`));
    const wa = $("#viz-wa");
    if (wa) wa.href = `https://wa.me/${(wa.dataset.phone || "919582010747")}?text=${encodeURIComponent(`Hi UPVC Club, I tried this in my home and would like a quote: ${configText()}`)}`;
  }
  document.addEventListener("upvc:settings", (e) => {
    const s = e.detail || {};
    const wa = $("#viz-wa");
    if (wa && s.phone) { wa.dataset.phone = s.phone.replace(/[^0-9]/g, ""); updateQuoteLinks(); }
  });

  /* ---------------- sheets & toast ---------------- */
  function openSheet(sheet) { sheet.classList.add("is-open"); sheet.setAttribute("aria-hidden", "false"); const f = $("button, a", sheet); if (f) f.focus({ preventScroll: true }); }
  function closeSheet(sheet) { sheet.classList.remove("is-open"); sheet.setAttribute("aria-hidden", "true"); }
  $$("[data-close]").forEach((b) => b.addEventListener("click", () => {
    const s = b.closest(".viz-sheet"); closeSheet(s);
    if (s === el.help) localStorage_set("upvc-viz-help", "1");
  }));
  $$(".viz-sheet").forEach((s) => s.addEventListener("click", (e) => { if (e.target === s) { closeSheet(s); if (s === el.help) localStorage_set("upvc-viz-help", "1"); } }));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") $$(".viz-sheet.is-open").forEach(closeSheet); });

  let toastTimer;
  function toast(msg) {
    el.toast.textContent = msg; el.toast.classList.add("is-on");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.toast.classList.remove("is-on"), 2200);
  }

  function localStorage_get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function localStorage_set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }

  /* ---------------- option panel ---------------- */
  function renderOpts() {
    const e = window.UPVC ? UPVC.esc : (s) => s;
    let h = "";
    if (state.tab === "style") {
      h = F.TYPES.map((t) => `<button class="viz-opt" data-set="type" data-val="${t.id}" aria-pressed="${t.id === state.type}">
          <span class="viz-opt-thumb">${F.svg(t.id, { finish: state.finish, glass: "clear", width: 56, height: Math.round(56 * t.h / t.w) })}</span>${e(t.name)}</button>`).join("");
    } else if (state.tab === "finish") {
      h = F.FINISHES.map((f) => `<button class="viz-opt" data-set="finish" data-val="${f.id}" aria-pressed="${f.id === state.finish}">
          <span class="viz-swatch" style="background:${f.wood ? `repeating-linear-gradient(100deg, ${f.fill} 0 4px, ${f.edge} 4px 6px, ${f.light} 6px 9px)` : `linear-gradient(135deg, ${f.light}, ${f.fill} 55%, ${f.edge})`}"></span>${e(f.name)}</button>`).join("");
    } else if (state.tab === "glass") {
      h = F.GLASSES.map((g) => `<button class="viz-opt" data-set="glass" data-val="${g.id}" aria-pressed="${g.id === state.glass}">
          <span class="viz-glass" style="box-shadow: inset 0 0 0 40px ${g.tint}"></span>${e(g.name)}</button>`).join("");
    } else {
      h = `<div class="viz-sliders">
          <label class="viz-slider">Visibility<input type="range" min="40" max="100" value="${Math.round(state.opacity * 100)}" data-range="opacity"><output>${Math.round(state.opacity * 100)}%</output></label>
          <label class="viz-slider">Brightness<input type="range" min="50" max="140" value="${Math.round(state.brightness * 100)}" data-range="brightness"><output>${Math.round(state.brightness * 100)}%</output></label>
          <div class="viz-toggles">
            <button class="viz-toggle" data-act="reset"><span class="material-icons-outlined">restart_alt</span>Reset position</button>
            <button class="viz-toggle" data-act="square"><span class="material-icons-outlined">crop_free</span>Straighten</button>
          </div>
        </div>`;
    }
    el.opts.innerHTML = h;
  }

  el.opts.addEventListener("click", (e) => {
    const b = e.target.closest("[data-set], [data-act]");
    if (!b) return;
    if (b.dataset.act === "reset") { resetCorners(); return; }
    if (b.dataset.act === "square") { refitForType(); draw(); return; }
    const k = b.dataset.set, v = b.dataset.val;
    state[k] = v;
    if (k === "type") { refitForType(); }
    $$(`[data-set="${k}"]`, el.opts).forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.val === v)));
    if (k === "finish" && state.tab === "style") renderOpts();
    rasterize();
    updateQuoteLinks();
  });
  el.opts.addEventListener("input", (e) => {
    const r = e.target.closest("[data-range]");
    if (!r) return;
    const v = parseInt(r.value, 10) / 100;
    state[r.dataset.range] = v;
    r.nextElementSibling.textContent = r.value + "%";
    if (r.dataset.range === "brightness") rasterize(); else draw();
  });
  el.tabs.forEach((t) => t.addEventListener("click", () => {
    state.tab = t.dataset.tab;
    el.tabs.forEach((x) => x.setAttribute("aria-selected", String(x === t)));
    renderOpts();
  }));

  /* ---------------- buttons ---------------- */
  $("#viz-cam").addEventListener("click", startCamera);
  $("#viz-upload").addEventListener("click", () => el.file.click());
  $("#viz-sample").addEventListener("click", useSample);
  $("#viz-source").addEventListener("click", () => { el.start.hidden = false; stopCamera(); });
  $("#viz-capture").addEventListener("click", capture);
  $("#viz-help-btn").addEventListener("click", () => openSheet(el.help));
  $("#viz-retake").addEventListener("click", () => closeSheet(el.sheet));
  el.flipBtn.addEventListener("click", () => { state.facing = state.facing === "environment" ? "user" : "environment"; startCamera(); });
  el.pauseBtn.addEventListener("click", () => {
    state.paused = !state.paused;
    if (state.paused) el.video.pause(); else el.video.play();
    el.stage.classList.toggle("viz-paused", state.paused);
    el.pauseBtn.classList.toggle("is-on", state.paused);
    el.pauseBtn.querySelector(".material-icons-outlined").textContent = state.paused ? "play_arrow" : "pause";
  });
  el.cleanBtn.addEventListener("click", () => {
    const on = el.stage.classList.toggle("viz-clean");
    el.cleanBtn.classList.toggle("is-on", on);
  });

  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", () => setTimeout(resize, 300));
  document.addEventListener("visibilitychange", () => { if (document.hidden && state.source === "camera") el.video.pause(); else if (state.source === "camera" && !state.paused) el.video.play().catch(() => {}); });
  window.addEventListener("pagehide", stopCamera);

  /* ---------------- boot ---------------- */
  async function boot() {
    resize();
    renderOpts();
    updateQuoteLinks();
    await rasterize();
    const slug = params.get("product");
    if (slug && typeof fetchProductDetail === "function") {
      const p = await fetchProductDetail(slug);
      if (p) {
        state.productName = p.name;
        if (!params.get("type")) { state.type = F.guessType(p); refitForType(); renderOpts(); rasterize(); }
        el.subtitle.textContent = p.name;
        updateQuoteLinks();
      }
    }
    if (params.get("sample")) useSample();
  }
  boot();

  // expose for debugging/tests
  window.UPVCVisualizer = { state, capture, useSample, draw, homography };
})();
