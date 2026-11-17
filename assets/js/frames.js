/* UPVC Club — procedural window / door renderer.
   Produces a standalone SVG string for each product type, finish and glass,
   used by the "See it in your home" camera visualizer and as product artwork. */
(function (global) {
  "use strict";

  const FINISHES = [
    { id: "white", name: "Classic White", fill: "#f3f2ee", light: "#ffffff", edge: "#c9c8c2", handle: "#e9e9e6" },
    { id: "anthracite", name: "Anthracite Grey", fill: "#3b3f45", light: "#5a5f66", edge: "#25282c", handle: "#c9ccd0" },
    { id: "black", name: "Matte Black", fill: "#1b1c1e", light: "#36383b", edge: "#0b0c0d", handle: "#b9bcc0" },
    { id: "golden-oak", name: "Golden Oak", fill: "#b5773a", light: "#d29a5c", edge: "#7d4c1f", handle: "#d9c7a0", wood: true },
    { id: "walnut", name: "Walnut", fill: "#5b3a22", light: "#7a5233", edge: "#3a2313", handle: "#d9c7a0", wood: true },
    { id: "silver", name: "Aluminium Silver", fill: "#b9bec5", light: "#e3e6ea", edge: "#868c94", handle: "#4a4e54" },
    { id: "champagne", name: "Champagne", fill: "#c8b48c", light: "#e6d6b4", edge: "#957f57", handle: "#5b4b30" },
  ];

  const GLASSES = [
    { id: "clear", name: "Clear", fill: "rgba(200,225,240,0.10)", tint: "rgba(170,205,225,0.22)", refl: 0.22 },
    { id: "tinted", name: "Grey Tint", fill: "rgba(55,65,75,0.42)", tint: "rgba(35,45,55,0.5)", refl: 0.16 },
    { id: "bronze", name: "Bronze", fill: "rgba(120,82,45,0.38)", tint: "rgba(95,60,30,0.45)", refl: 0.16 },
    { id: "reflective", name: "Reflective Blue", fill: "rgba(60,110,165,0.5)", tint: "rgba(40,85,140,0.55)", refl: 0.3 },
    { id: "frosted", name: "Frosted", fill: "rgba(238,242,246,0.82)", tint: "rgba(225,232,238,0.88)", refl: 0.1 },
  ];

  const TYPES = [
    { id: "sliding-window", name: "Sliding Window", w: 1500, h: 1200, icon: "view_column" },
    { id: "casement-window", name: "Casement Window", w: 1200, h: 1400, icon: "window" },
    { id: "fixed-window", name: "Picture Window", w: 1600, h: 1200, icon: "crop_landscape" },
    { id: "sliding-door", name: "Sliding Door", w: 2400, h: 2200, icon: "door_sliding" },
    { id: "french-door", name: "French Door", w: 1600, h: 2200, icon: "door_front" },
    { id: "balcony", name: "Balcony Glazing", w: 3000, h: 1500, icon: "balcony" },
    { id: "partition", name: "Glass Partition", w: 2400, h: 2400, icon: "space_dashboard" },
    { id: "jali-door", name: "Jali / Mesh Door", w: 1000, h: 2200, icon: "grid_on" },
    { id: "bifold-door", name: "Slide & Fold Door", w: 3000, h: 2200, icon: "view_week" },
    { id: "shower", name: "Shower Enclosure", w: 1200, h: 2000, icon: "shower" },
    { id: "louvers", name: "WPC Louvers", w: 1800, h: 2400, icon: "view_agenda" },
  ];

  const byId = (list, id, fallback) => list.find((x) => x.id === id) || fallback || list[0];
  let uid = 0;

  function build(typeId, opts) {
    opts = opts || {};
    const type = byId(TYPES, typeId);
    const fin = byId(FINISHES, opts.finish);
    const glass = byId(GLASSES, opts.glass);
    const p = "f" + (++uid).toString(36) + Math.random().toString(36).slice(2, 6);
    const W = type.w, H = type.h;
    const out = [];

    /* ---------- primitives ---------- */
    const profileFill = (dir) => `url(#${p}-${dir === "v" ? "pv" : "ph"})`;
    function bar(x, y, w, h) {
      const dir = h > w ? "v" : "h";
      out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${profileFill(dir)}"/>`);
      if (fin.wood) out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${p}-grain${dir})" opacity="0.55"/>`);
    }
    // a rectangular frame with mitred bevel look
    function frame(x, y, w, h, t) {
      bar(x, y, w, t);
      bar(x, y + h - t, w, t);
      bar(x, y + t, t, h - 2 * t);
      bar(x + w - t, y + t, t, h - 2 * t);
      // inner shadow line + outer edge
      out.push(`<rect x="${x + t}" y="${y + t}" width="${w - 2 * t}" height="${h - 2 * t}" fill="none" stroke="rgba(0,0,0,0.28)" stroke-width="${Math.max(2, t * 0.06)}"/>`);
      out.push(`<rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${h - 2}" fill="none" stroke="${fin.edge}" stroke-width="3"/>`);
      // mitre lines
      const m = `stroke="${fin.edge}" stroke-width="2" opacity="0.6"`;
      out.push(`<line x1="${x}" y1="${y}" x2="${x + t}" y2="${y + t}" ${m}/><line x1="${x + w}" y1="${y}" x2="${x + w - t}" y2="${y + t}" ${m}/>`);
      out.push(`<line x1="${x}" y1="${y + h}" x2="${x + t}" y2="${y + h - t}" ${m}/><line x1="${x + w}" y1="${y + h}" x2="${x + w - t}" y2="${y + h - t}" ${m}/>`);
    }
    function pane(x, y, w, h) {
      out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${p}-glass)"/>`);
      out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${p}-refl)"/>`);
      // gasket
      out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#141518" stroke-width="${Math.max(4, Math.min(w, h) * 0.008)}" opacity="0.85"/>`);
    }
    function sash(x, y, w, h, t) {
      pane(x + t, y + t, w - 2 * t, h - 2 * t);
      frame(x, y, w, h, t);
    }
    function handleV(cx, cy, len) {
      const hw = Math.max(18, len * 0.12);
      out.push(`<rect x="${cx - hw / 2}" y="${cy - len / 2}" width="${hw}" height="${len}" rx="${hw / 2}" fill="${fin.handle}" stroke="rgba(0,0,0,0.35)" stroke-width="2"/>`);
      out.push(`<rect x="${cx - hw / 2 + 3}" y="${cy - len / 2 + 6}" width="${hw * 0.3}" height="${len - 12}" rx="${hw * 0.15}" fill="rgba(255,255,255,0.45)"/>`);
    }
    function lever(cx, cy, len, left) {
      const d = left ? -1 : 1;
      out.push(`<rect x="${cx - 14}" y="${cy - 40}" width="28" height="80" rx="10" fill="${fin.handle}" stroke="rgba(0,0,0,0.35)" stroke-width="2"/>`);
      out.push(`<rect x="${left ? cx - len : cx}" y="${cy - 9}" width="${len}" height="18" rx="9" fill="${fin.handle}" stroke="rgba(0,0,0,0.35)" stroke-width="2" transform="rotate(${d * 0} ${cx} ${cy})"/>`);
    }
    function sill(y, h) {
      out.push(`<rect x="0" y="${y}" width="${W}" height="${h}" fill="${fin.edge}"/>`);
      out.push(`<rect x="0" y="${y}" width="${W}" height="${h * 0.35}" fill="${fin.light}" opacity="0.6"/>`);
    }

    /* ---------- types ---------- */
    switch (type.id) {
      case "sliding-window": {
        const t = 70, s = 62, ov = 40;
        pane(t, t, W - 2 * t, H - 2 * t);
        const inner = W - 2 * t, sw = inner / 2 + ov / 2;
        sash(t, t + 6, sw, H - 2 * t - 12, s);
        sash(W - t - sw, t + 6, sw, H - 2 * t - 12, s);
        // interlock
        bar(W / 2 - ov / 2 - 6, t + 6, ov + 12, H - 2 * t - 12);
        handleV(t + s / 2, H / 2, 160);
        handleV(W - t - s / 2, H / 2, 160);
        frame(0, 0, W, H, t);
        // track grooves
        out.push(`<rect x="${t}" y="${H - t + 18}" width="${W - 2 * t}" height="8" fill="rgba(0,0,0,0.25)"/>`);
        out.push(`<rect x="${t}" y="${H - t + 36}" width="${W - 2 * t}" height="8" fill="rgba(0,0,0,0.18)"/>`);
        break;
      }
      case "casement-window": {
        const t = 70, s = 64, m = 60, tr = Math.round(H * 0.3);
        // top fixed light
        pane(t, t, W - 2 * t, tr - t);
        bar(t, tr, W - 2 * t, m);
        const sh = H - tr - m - t, sw = (W - 2 * t - m) / 2;
        sash(t, tr + m, sw, sh, s);
        sash(t + sw + m, tr + m, sw, sh, s);
        bar(t + sw, tr + m, m, sh);
        handleV(t + sw - s / 2, tr + m + sh / 2, 150);
        handleV(t + sw + m + s / 2, tr + m + sh / 2, 150);
        frame(0, 0, W, H, t);
        break;
      }
      case "fixed-window": {
        const t = 80, b = 46;
        pane(t, t, W - 2 * t, H - 2 * t);
        // inner bead
        frame(t, t, W - 2 * t, H - 2 * t, b);
        frame(0, 0, W, H, t);
        break;
      }
      case "sliding-door": {
        const t = 80, s = 70, ov = 46, n = 3;
        const inner = W - 2 * t, sw = (inner + ov * (n - 1)) / n;
        pane(t, t, inner, H - 2 * t);
        for (let i = 0; i < n; i++) {
          const x = t + i * (sw - ov);
          sash(x, t + 8, sw, H - 2 * t - 16, s);
        }
        handleV(t + sw - s / 2, H * 0.52, 300);
        handleV(t + 2 * (sw - ov) + s / 2, H * 0.52, 300);
        frame(0, 0, W, H, t);
        out.push(`<rect x="${t}" y="${H - t + 20}" width="${inner}" height="10" fill="rgba(0,0,0,0.25)"/>`);
        break;
      }
      case "french-door": {
        const t = 80, s = 84, bp = Math.round(H * 0.2);
        const lw = (W - 2 * t) / 2;
        for (let i = 0; i < 2; i++) {
          const x = t + i * lw;
          pane(x + s, t + s, lw - 2 * s, H - 2 * t - 2 * s - bp);
          // bottom solid panel
          bar(x + s, H - t - s - bp, lw - 2 * s, bp);
          out.push(`<rect x="${x + s + 30}" y="${H - t - s - bp + 30}" width="${lw - 2 * s - 60}" height="${bp - 60}" fill="none" stroke="rgba(0,0,0,0.25)" stroke-width="4"/>`);
          frame(x, t, lw, H - 2 * t, s);
        }
        lever(W / 2 - s / 2, H * 0.5, 90, true);
        lever(W / 2 + s / 2, H * 0.5, 90, false);
        frame(0, 0, W, H, t);
        break;
      }
      case "balcony": {
        const t = 44, n = 5, s = 30, ov = 20;
        const top = 70, bot = 90;
        const inner = W - 2 * t, pw = (inner + ov * (n - 1)) / n;
        pane(t, top, inner, H - top - bot);
        for (let i = 0; i < n; i++) sash(t + i * (pw - ov), top + 4, pw, H - top - bot - 8, s);
        bar(0, 0, W, top);
        bar(0, H - bot, W, bot);
        bar(0, top, t, H - top - bot);
        bar(W - t, top, t, H - top - bot);
        out.push(`<rect x="0" y="${H - bot + 20}" width="${W}" height="8" fill="rgba(0,0,0,0.25)"/>`);
        out.push(`<rect x="0" y="${H - bot + 44}" width="${W}" height="8" fill="rgba(0,0,0,0.18)"/>`);
        break;
      }
      case "partition": {
        const t = 34, n = 4, mw = (W - 2 * t) / n, band0 = H * 0.42, band1 = H * 0.58;
        for (let i = 0; i < n; i++) {
          const x = t + i * mw;
          pane(x, t, mw, H - 2 * t);
          out.push(`<rect x="${x}" y="${band0}" width="${mw}" height="${band1 - band0}" fill="rgba(240,243,246,0.78)"/>`);
          if (i > 0) bar(x - t / 2, t, t, H - 2 * t);
        }
        // door module (last) with long pull handle
        const dx = t + (n - 1) * mw;
        out.push(`<rect x="${dx + 60}" y="${H * 0.32}" width="22" height="${H * 0.36}" rx="11" fill="${fin.handle}" stroke="rgba(0,0,0,0.35)" stroke-width="2"/>`);
        frame(0, 0, W, H, t);
        break;
      }
      case "jali-door": {
        const t = 84, rail = 80, mid = H * 0.5;
        const ix = t, iy = t, iw = W - 2 * t, ih = H - 2 * t;
        out.push(`<rect x="${ix}" y="${iy}" width="${iw}" height="${ih}" fill="rgba(30,30,30,0.18)"/>`);
        // diamond jali
        const step = 70, lines = [];
        for (let k = -ih; k < iw + ih; k += step) {
          lines.push(`<line x1="${ix + k}" y1="${iy}" x2="${ix + k + ih}" y2="${iy + ih}"/>`);
          lines.push(`<line x1="${ix + k}" y1="${iy + ih}" x2="${ix + k + ih}" y2="${iy}"/>`);
        }
        out.push(`<clipPath id="${p}-jc"><rect x="${ix}" y="${iy}" width="${iw}" height="${ih}"/></clipPath>`);
        out.push(`<g clip-path="url(#${p}-jc)" stroke="${fin.fill}" stroke-width="14" opacity="0.95">${lines.join("")}</g>`);
        out.push(`<g clip-path="url(#${p}-jc)" stroke="${fin.edge}" stroke-width="3" opacity="0.6">${lines.join("")}</g>`);
        // fine mesh
        out.push(`<rect x="${ix}" y="${iy}" width="${iw}" height="${ih}" fill="url(#${p}-mesh)"/>`);
        bar(t, mid - rail / 2, iw, rail);
        lever(W - t - 20, mid, 100, true);
        frame(0, 0, W, H, t);
        break;
      }
      case "bifold-door": {
        const t = 70, s = 64, n = 5;
        const inner = W - 2 * t, pw = inner / n;
        for (let i = 0; i < n; i++) {
          const x = t + i * pw;
          sash(x, t, pw, H - 2 * t, s);
          // hinge knuckles between leaves
          if (i > 0) for (const hy of [H * 0.15, H * 0.5, H * 0.85]) out.push(`<rect x="${x - 7}" y="${hy - 30}" width="14" height="60" rx="6" fill="${fin.handle}" stroke="rgba(0,0,0,0.35)" stroke-width="2"/>`);
        }
        handleV(t + 2 * pw - s / 2, H * 0.52, 260);
        frame(0, 0, W, H, t);
        out.push(`<rect x="${t}" y="${H - t + 20}" width="${inner}" height="10" fill="rgba(0,0,0,0.25)"/>`);
        break;
      }
      case "shower": {
        // frameless: two glass panels, chrome hinges and a slim top channel
        const g = 14, base = 50, split = W * 0.42;
        pane(0, 0, split - g / 2, H - base);
        pane(split + g / 2, 0, W - split - g / 2, H - base);
        out.push(`<rect x="0" y="0" width="${W}" height="22" fill="url(#${p}-ph)"/>`);
        out.push(`<rect x="0" y="${H - base}" width="${W}" height="${base}" fill="url(#${p}-ph)"/>`);
        for (const hy of [H * 0.18, H * 0.78]) out.push(`<rect x="${split - 34}" y="${hy - 40}" width="68" height="80" rx="10" fill="${fin.light}" stroke="${fin.edge}" stroke-width="4"/>`);
        out.push(`<rect x="${split + 90}" y="${H * 0.36}" width="26" height="${H * 0.26}" rx="13" fill="${fin.light}" stroke="${fin.edge}" stroke-width="4"/>`);
        out.push(`<rect x="${split + 70}" y="${H * 0.4}" width="30" height="16" fill="${fin.edge}"/><rect x="${split + 70}" y="${H * 0.58}" width="30" height="16" fill="${fin.edge}"/>`);
        break;
      }
      case "louvers": {
        // vertical WPC slats on a dark backing
        const n = 14, gap = 22, sw = (W - gap * (n + 1)) / n;
        out.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#1d1f22"/>`);
        for (let i = 0; i < n; i++) {
          const x = gap + i * (sw + gap);
          bar(x, 0, sw, H);
          out.push(`<rect x="${x + sw * 0.78}" y="0" width="${sw * 0.22}" height="${H}" fill="rgba(0,0,0,0.25)"/>`);
        }
        out.push(`<rect x="0" y="${H - 8}" width="${W}" height="8" fill="rgba(0,0,0,0.35)"/>`);
        break;
      }
    }

    if (type.id === "sliding-window" || type.id === "casement-window" || type.id === "fixed-window") sill(H - 6, 6);

    /* ---------- defs ---------- */
    const grain = (dir) => {
      const vertical = dir === "v";
      const lines = [];
      for (let i = 0; i < 14; i++) {
        const o = 6 + i * 11 + (i % 3) * 3;
        lines.push(vertical
          ? `<path d="M${o} 0 Q ${o + 6} 60 ${o - 3} 120 T ${o + 2} 240" stroke="${fin.edge}" stroke-width="${1 + (i % 4) * 0.6}" fill="none" opacity="${0.35 + (i % 3) * 0.15}"/>`
          : `<path d="M0 ${o} Q 60 ${o + 6} 120 ${o - 3} T 240 ${o + 2}" stroke="${fin.edge}" stroke-width="${1 + (i % 4) * 0.6}" fill="none" opacity="${0.35 + (i % 3) * 0.15}"/>`);
      }
      return `<pattern id="${p}-grain${dir}" patternUnits="userSpaceOnUse" width="${vertical ? 160 : 240}" height="${vertical ? 240 : 160}">${lines.join("")}</pattern>`;
    };

    const defs = `<defs>
      <linearGradient id="${p}-pv" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="${fin.edge}"/><stop offset="0.18" stop-color="${fin.light}"/>
        <stop offset="0.55" stop-color="${fin.fill}"/><stop offset="1" stop-color="${fin.edge}"/>
      </linearGradient>
      <linearGradient id="${p}-ph" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${fin.edge}"/><stop offset="0.18" stop-color="${fin.light}"/>
        <stop offset="0.55" stop-color="${fin.fill}"/><stop offset="1" stop-color="${fin.edge}"/>
      </linearGradient>
      <linearGradient id="${p}-glass" x1="0" y1="0" x2="0.4" y2="1">
        <stop offset="0" stop-color="${glass.tint}"/><stop offset="1" stop-color="${glass.fill}"/>
      </linearGradient>
      <linearGradient id="${p}-refl" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${W}" y2="${H}">
        <stop offset="0" stop-color="#fff" stop-opacity="0"/>
        <stop offset="0.28" stop-color="#fff" stop-opacity="0"/>
        <stop offset="0.3" stop-color="#fff" stop-opacity="${glass.refl}"/>
        <stop offset="0.36" stop-color="#fff" stop-opacity="${glass.refl * 0.35}"/>
        <stop offset="0.4" stop-color="#fff" stop-opacity="0"/>
        <stop offset="0.44" stop-color="#fff" stop-opacity="${glass.refl * 0.6}"/>
        <stop offset="0.46" stop-color="#fff" stop-opacity="0"/>
        <stop offset="1" stop-color="#fff" stop-opacity="0"/>
      </linearGradient>
      <pattern id="${p}-mesh" patternUnits="userSpaceOnUse" width="12" height="12">
        <path d="M0 0H12M0 0V12" stroke="rgba(20,20,20,0.35)" stroke-width="1.5"/>
      </pattern>
      ${fin.wood ? grain("v") + grain("h") : ""}
    </defs>`;

    const w = opts.width || W, h = opts.height || Math.round((opts.width || W) * H / W);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet">${defs}${out.join("")}</svg>`;
  }

  /* Guess a renderable type from an API product / category. */
  function guessType(product) {
    const s = [product && product.name, product && product.slug, product && product.category && (product.category.name + " " + product.category.slug)]
      .filter(Boolean).join(" ").toLowerCase();
    if (/louver|louvre|wpc|panel|cladding|decor/.test(s)) return "louvers";
    if (/shower|cubicle|enclosure/.test(s)) return "shower";
    if (/jali|mesh|net|security|safety/.test(s)) return "jali-door";
    if (/balcon/.test(s)) return "balcony";
    if (/fold/.test(s)) return "bifold-door";
    if (/partition|office|cabin|structural|glazing/.test(s)) return "partition";
    if (/sliding/.test(s) && /door/.test(s)) return "sliding-door";
    if (/door/.test(s)) return "french-door";
    if (/casement|openable|tilt/.test(s)) return "casement-window";
    if (/fixed|picture|ventilator/.test(s)) return "fixed-window";
    return "sliding-window";
  }

  /* A finish that suits each product type when shown as artwork. */
  const SHOWCASE_FINISH = {
    "sliding-window": "white", "casement-window": "anthracite", "fixed-window": "black", "sliding-door": "black",
    "french-door": "golden-oak", balcony: "white", partition: "black", "jali-door": "anthracite",
    "bifold-door": "anthracite", shower: "silver", louvers: "walnut",
  };

  function toDataURL(svg) {
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  global.UPVCFrames = { TYPES, FINISHES, GLASSES, SHOWCASE_FINISH, svg: build, guessType, toDataURL, byId };
})(window);
