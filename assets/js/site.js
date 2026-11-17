/* UPVC Club — site chrome + scroll motion.
   Smooth scroll (Lenis) + GSAP ScrollTrigger driven by data attributes:
     data-split            heading revealed line by line
     data-reveal           fade/slide up   (data-reveal-stagger on parent staggers children)
     data-parallax="0.2"   image parallax
     data-img-reveal       clip-path wipe + scale on enter
     data-fill             words light up as you scroll
     data-count            animated numbers
     data-hscroll          pinned horizontal scroller (desktop)
     data-theme="dark"     page switches to dark while section is in view
     .marquee              scroll-velocity marquee
     .magnetic             magnetic hover
     data-cursor="View"    custom cursor label
*/
(function () {
  "use strict";

  const html = document.documentElement;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasGSAP = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";
  if (reduced) html.classList.add("reduced-motion");
  if (!hasGSAP) html.classList.add("reveal-fallback");

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  let lenis = null;
  const UPVC = (window.UPVC = window.UPVC || {});

  /* ---------------- Smooth scroll ---------------- */
  function initLenis() {
    if (reduced || typeof window.Lenis === "undefined" || document.body.classList.contains("viz-page")) return;
    lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 1 });
    UPVC.lenis = lenis;
    if (hasGSAP) {
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
    // in-page anchors
    $$('a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (id.length < 2) return;
      const el = document.querySelector(id);
      if (el) { e.preventDefault(); lenis.scrollTo(el, { offset: -80 }); }
    }));
  }

  /* ---------------- Header / menu / dock ---------------- */
  function initChrome() {
    const header = $(".site-header");
    const dock = $(".dock");
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const down = y > lastY && y > 120;
      if (header) {
        header.classList.toggle("is-scrolled", y > 20);
        if (!html.classList.contains("menu-open")) header.classList.toggle("is-hidden", down);
      }
      if (dock) dock.classList.toggle("is-hidden", down && y > 400);
      lastY = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    const btn = $(".menu-btn");
    if (btn) {
      btn.addEventListener("click", () => {
        const open = !html.classList.contains("menu-open");
        html.classList.toggle("menu-open", open);
        btn.setAttribute("aria-expanded", String(open));
        $(".mobile-menu").setAttribute("aria-hidden", String(!open));
        if (lenis) open ? lenis.stop() : lenis.start();
      });
      $$(".mobile-menu a").forEach((a) => a.addEventListener("click", () => {
        html.classList.remove("menu-open");
        if (lenis) lenis.start();
      }));
    }

    // active nav
    const here = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    $$("[data-nav]").forEach((a) => {
      const target = a.getAttribute("href").split("?")[0].toLowerCase();
      const match = target === here || (here === "product-detail.html" && target === "products.html");
      a.classList.toggle("active", match);
      if (match) a.setAttribute("aria-current", "page");
    });

    // year
    $$("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
  }

  /* ---------------- Preloader & page transitions ---------------- */
  function runPreloader() {
    const pre = $(".preloader");
    let firstVisit = true;
    try { firstVisit = !sessionStorage.getItem("upvc-visited"); sessionStorage.setItem("upvc-visited", "1"); } catch (e) { /* storage blocked */ }
    if (!pre || !hasGSAP || reduced || !firstVisit) {
      if (pre) pre.remove();
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const count = $(".preloader-count", pre);
      const bar = $(".preloader-bar i", pre);
      const o = { v: 0 };
      const tl = gsap.timeline({ onComplete: () => { pre.remove(); } });
      tl.to(o, { v: 100, duration: 1.4, ease: "power2.inOut", onUpdate: () => { count.textContent = Math.round(o.v); } }, 0)
        .to(bar, { scaleX: 1, duration: 1.4, ease: "power2.inOut" }, 0)
        .to(pre, { yPercent: -100, duration: 0.9, ease: "expo.inOut" }, "+=0.1")
        .add(resolve, "-=0.55");
    });
  }

  function initTransitions() {
    const curtain = $(".curtain");
    if (!curtain || !hasGSAP || reduced) { html.classList.remove("curtain-in"); return; }
    gsap.set(curtain, { yPercent: html.classList.contains("curtain-in") ? 0 : 100, y: 0 });
    html.classList.remove("curtain-in");
    if (gsap.getProperty(curtain, "yPercent") === 0) {
      gsap.to(curtain, { yPercent: -100, duration: 0.9, ease: "expo.inOut", delay: 0.05 });
    }
    document.addEventListener("click", (e) => {
      const a = e.target.closest("a");
      if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || a.target === "_blank" || a.hasAttribute("download") || /^(mailto|tel|javascript|https?):/i.test(href)) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
      e.preventDefault();
      try { sessionStorage.setItem("upvc-curtain", "1"); } catch (err) { /* ignore */ }
      gsap.fromTo(curtain, { yPercent: 100 }, { yPercent: 0, duration: 0.6, ease: "expo.inOut", onComplete: () => (location.href = a.href) });
    });
    window.addEventListener("pageshow", (e) => { if (e.persisted) gsap.set(curtain, { yPercent: 100 }); });
  }

  /* ---------------- Text splitting ---------------- */
  function splitLines(el) {
    if (window.SplitText) {
      const st = new window.SplitText(el, { type: "lines", linesClass: "split-line-inner", mask: "lines" });
      return st.lines;
    }
    return [el];
  }

  function wrapWords(el) {
    if (el.dataset.wrapped) return $$(".w", el);
    const walk = (node) => {
      Array.from(node.childNodes).forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) frag.appendChild(document.createTextNode(part));
            else { const s = document.createElement("span"); s.className = "w"; s.textContent = part; frag.appendChild(s); }
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(el);
    el.dataset.wrapped = "1";
    return $$(".w", el);
  }

  /* ---------------- Animations ---------------- */
  function animate(root) {
    root = root || document;
    if (!hasGSAP || reduced) {
      $$("[data-count]", root).forEach(setCountFinal);
      return;
    }

    $$("[data-split]:not([data-anim])", root).forEach((el) => {
      el.setAttribute("data-anim", "1");
      const lines = splitLines(el);
      gsap.set(el, { visibility: "visible" });
      const immediate = el.hasAttribute("data-split-now");
      gsap.from(lines, {
        yPercent: 110, rotate: 2, duration: 1.2, ease: "expo.out", stagger: 0.09,
        delay: parseFloat(el.dataset.delay || 0),
        scrollTrigger: immediate ? null : { trigger: el, start: "top 88%", once: true },
      });
    });

    $$("[data-reveal-stagger]:not([data-anim])", root).forEach((parent) => {
      parent.setAttribute("data-anim", "1");
      const kids = $$(":scope > [data-reveal]", parent);
      kids.forEach((k) => k.setAttribute("data-anim", "1"));
      if (!kids.length) return;
      gsap.fromTo(kids, { opacity: 0, y: 60 }, {
        opacity: 1, y: 0, duration: 1.1, ease: "expo.out", stagger: 0.08,
        scrollTrigger: { trigger: parent, start: "top 85%", once: true },
      });
    });

    $$("[data-reveal]:not([data-anim])", root).forEach((el) => {
      el.setAttribute("data-anim", "1");
      const dir = el.dataset.reveal;
      const from = { opacity: 0, y: dir === "left" || dir === "right" ? 0 : 50, x: dir === "left" ? -60 : dir === "right" ? 60 : 0, scale: dir === "scale" ? 0.92 : 1 };
      gsap.fromTo(el, from, {
        opacity: 1, y: 0, x: 0, scale: 1, duration: 1.1, ease: "expo.out", delay: parseFloat(el.dataset.delay || 0),
        scrollTrigger: el.hasAttribute("data-reveal-now") ? null : { trigger: el, start: "top 90%", once: true },
      });
    });

    $$("[data-img-reveal]:not([data-anim])", root).forEach((el) => {
      el.setAttribute("data-anim", "1");
      const img = $("img", el);
      const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: "top 85%", once: true } });
      tl.fromTo(el, { clipPath: "inset(100% 0% 0% 0% round 32px)" }, { clipPath: "inset(0% 0% 0% 0% round 32px)", duration: 1.4, ease: "expo.inOut" });
      if (img) tl.fromTo(img, { scale: 1.35 }, { scale: 1, duration: 1.8, ease: "expo.out" }, 0.1);
    });

    $$("[data-parallax]:not([data-anim])", root).forEach((el) => {
      el.setAttribute("data-anim", "1");
      const amt = parseFloat(el.dataset.parallax) || 0.15;
      gsap.fromTo(el, { yPercent: -amt * 50 }, {
        yPercent: amt * 50, ease: "none",
        scrollTrigger: { trigger: el.parentElement, start: "top bottom", end: "bottom top", scrub: true },
      });
    });

    $$("[data-fill]:not([data-anim])", root).forEach((el) => {
      el.setAttribute("data-anim", "1");
      el.classList.add("fill-words");
      const words = wrapWords(el);
      gsap.to(words, {
        color: getComputedStyle(el).color, stagger: 0.1, ease: "none",
        scrollTrigger: { trigger: el, start: "top 80%", end: "bottom 45%", scrub: 0.6 },
      });
    });

    $$("[data-count]:not([data-anim])", root).forEach((el) => {
      el.setAttribute("data-anim", "1");
      ScrollTrigger.create({ trigger: el, start: "top 90%", once: true, onEnter: () => countUp(el) });
    });
  }

  function parseNum(text) {
    const m = String(text).match(/^(\D*)([\d.,]+)(.*)$/);
    if (!m) return null;
    const raw = m[2].replace(/,/g, "");
    return { pre: m[1], n: parseFloat(raw), dec: (raw.split(".")[1] || "").length, post: m[3] };
  }
  function setCountFinal(el) { /* text is already final */ el.dataset.done = "1"; }
  function countUp(el) {
    const p = parseNum(el.textContent.trim());
    if (!p || isNaN(p.n)) return;
    el.dataset.done = "1";
    const o = { v: 0 };
    gsap.to(o, {
      v: p.n, duration: 2, ease: "power3.out",
      onUpdate: () => { el.textContent = p.pre + o.v.toLocaleString("en-IN", { minimumFractionDigits: p.dec, maximumFractionDigits: p.dec }) + p.post; },
    });
  }
  UPVC.countUp = (el) => { if (hasGSAP && !reduced) countUp(el); };

  /* Hero: framed image expands to full-bleed while scrolling */
  function initHero() {
    const wrap = $(".hero-media-wrap");
    if (!wrap || !hasGSAP || reduced) return;
    const media = $(".hero-media", wrap);
    const img = $("img", media);
    const cap = $(".hero-media-caption", media);
    const tl = gsap.timeline({ scrollTrigger: { trigger: wrap, start: "top 85%", end: "bottom bottom", scrub: 0.8 } });
    tl.fromTo(media, { clipPath: "inset(10% 6% 10% 6% round 32px)" }, { clipPath: "inset(0% 0% 0% 0% round 0px)", ease: "none" }, 0)
      .fromTo(img, { scale: 1.25 }, { scale: 1, ease: "none" }, 0);
    if (cap) gsap.from(cap.children, { y: 60, opacity: 0, stagger: 0.1, duration: 1, ease: "expo.out", scrollTrigger: { trigger: wrap, start: "center 70%", once: true } });
  }

  /* Pinned horizontal scrolling section */
  function initHScroll() {
    if (!hasGSAP || reduced) return;
    const mm = gsap.matchMedia();
    $$("[data-hscroll]").forEach((section) => {
      mm.add("(min-width: 1024px)", () => {
        const track = $(".hscroll-track", section);
        const bar = $(".hscroll-progress i", section);
        section.classList.add("hs-pinned");
        const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
        const tween = gsap.to(track, {
          x: () => -dist(), ease: "none",
          scrollTrigger: {
            trigger: section, start: "top top", end: () => "+=" + dist(), pin: true, scrub: 0.8, invalidateOnRefresh: true, anticipatePin: 1,
            onUpdate: (st) => { if (bar) bar.style.transform = `scaleX(${st.progress})`; },
          },
        });
        // cards tilt in as they enter horizontally
        $$(".hcard", track).forEach((card) => {
          gsap.fromTo(card, { rotate: 4, y: 40 }, { rotate: 0, y: 0, ease: "none", scrollTrigger: { trigger: card, containerAnimation: tween, start: "left right", end: "left 55%", scrub: true } });
        });
        return () => { section.classList.remove("hs-pinned"); gsap.set(track, { clearProps: "transform" }); };
      });
    });
  }
  UPVC.refreshHScroll = () => hasGSAP && ScrollTrigger.refresh();

  /* Dark theme sections */
  function initThemeSections() {
    if (!hasGSAP) return;
    $$("[data-theme='dark']").forEach((sec) => {
      ScrollTrigger.create({
        trigger: sec, start: "top 55%", end: "bottom 45%",
        onToggle: (st) => document.body.classList.toggle("theme-dark", st.isActive),
      });
    });
    // header colour over dark hero
    const darkTop = $("[data-header-dark]");
    const header = $(".site-header");
    if (darkTop && header) {
      ScrollTrigger.create({ trigger: darkTop, start: "top top", end: "bottom top+=80", onToggle: (st) => header.classList.toggle("on-dark", st.isActive) });
    }
  }

  /* Velocity-reactive marquee */
  function initMarquees() {
    $$(".marquee").forEach((m) => {
      const track = $(".marquee-track", m);
      if (!track || track.dataset.ready) return;
      track.dataset.ready = "1";
      const item = track.firstElementChild;
      // duplicate to fill
      for (let i = 0; i < 3; i++) track.appendChild(item.cloneNode(true));
      if (!hasGSAP || reduced) return;
      const reverse = m.dataset.direction === "right";
      let x = 0, dir = reverse ? 1 : -1, speed = parseFloat(m.dataset.speed || 1);
      const width = () => item.getBoundingClientRect().width;
      let w = width();
      window.addEventListener("resize", () => (w = width()));
      let boost = 0;
      if (lenis) lenis.on("scroll", (e) => {
        boost = Math.min(12, Math.abs(e.velocity) * 0.6);
        if (e.direction) dir = (reverse ? 1 : -1) * (e.direction < 0 ? -1 : 1);
      });
      gsap.ticker.add((t, dt) => {
        const v = (1 + boost) * speed * (dt / 16.67) * 1.1;
        boost *= 0.92;
        x += dir * v;
        if (x <= -w) x += w;
        if (x > 0) x -= w;
        track.style.transform = `translate3d(${x}px,0,0)`;
      });
    });
  }

  /* Sticky stack cards scale back as next arrives */
  function initStack() {
    if (!hasGSAP || reduced) return;
    const cards = $$(".stack-card");
    cards.forEach((card, i) => {
      if (i === cards.length - 1) return;
      gsap.to(card, {
        scale: 0.9, ease: "none",
        scrollTrigger: { trigger: cards[i + 1], start: "top bottom", end: "top 30%", scrub: true },
      });
    });
  }

  /* Magnetic buttons */
  function initMagnetic() {
    if (!hasGSAP || reduced || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    $$(".magnetic").forEach((el) => {
      const xTo = gsap.quickTo(el, "x", { duration: 0.6, ease: "elastic.out(1, 0.4)" });
      const yTo = gsap.quickTo(el, "y", { duration: 0.6, ease: "elastic.out(1, 0.4)" });
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - r.left - r.width / 2) * 0.35);
        yTo((e.clientY - r.top - r.height / 2) * 0.35);
      });
      el.addEventListener("mouseleave", () => { xTo(0); yTo(0); });
    });
  }

  /* Custom cursor */
  function initCursor() {
    if (!hasGSAP || reduced || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const c = document.createElement("div");
    c.className = "cursor";
    c.innerHTML = '<div class="cursor-dot"></div>';
    document.body.appendChild(c);
    html.classList.add("has-cursor");
    const dot = c.firstChild;
    const xTo = gsap.quickTo(c, "x", { duration: 0.35, ease: "power3" });
    const yTo = gsap.quickTo(c, "y", { duration: 0.35, ease: "power3" });
    window.addEventListener("mousemove", (e) => { xTo(e.clientX); yTo(e.clientY); }, { passive: true });
    document.addEventListener("mouseover", (e) => {
      const lbl = e.target.closest("[data-cursor]");
      const link = e.target.closest("a, button, input, textarea, select, label");
      c.classList.toggle("is-label", !!lbl);
      c.classList.toggle("is-link", !lbl && !!link);
      dot.textContent = lbl ? lbl.dataset.cursor : "";
    });
    document.addEventListener("mouseleave", () => gsap.to(c, { opacity: 0 }));
    document.addEventListener("mouseenter", () => gsap.to(c, { opacity: 1 }));
  }

  /* Hero intro (after preloader) */
  function heroIntro() {
    if (!hasGSAP || reduced) return;
    /* [data-intro] elements are animated in CSS */
  }

  /* Phone demo on homepage: animated swatches + scan line */
  function initPhoneDemo() {
    const phone = $(".phone[data-demo]");
    if (!phone || !window.UPVCFrames) return;
    const win = $(".phone-win", phone);
    const sw = $$(".phone-swatches i", phone);
    const finishes = ["white", "anthracite", "golden-oak", "black", "walnut"];
    let i = 0;
    const paint = () => {
      win.innerHTML = UPVCFrames.svg("sliding-window", { finish: finishes[i % finishes.length], glass: "clear" });
      sw.forEach((s, k) => s.classList.toggle("on", k === i % finishes.length));
      i++;
    };
    paint();
    let timer = null;
    const start = () => { if (!timer) timer = setInterval(paint, 1600); };
    const stop = () => { clearInterval(timer); timer = null; };
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((ents) => ents.forEach((e) => (e.isIntersecting ? start() : stop()))).observe(phone);
    } else start();
    if (hasGSAP && !reduced) {
      gsap.fromTo($(".phone-scan", phone), { top: "8%" }, { top: "92%", duration: 2.4, ease: "sine.inOut", repeat: -1, yoyo: true });
      gsap.fromTo(phone, { rotate: -8, y: 120 }, { rotate: 4, y: -40, ease: "none", scrollTrigger: { trigger: phone, start: "top bottom", end: "bottom top", scrub: true } });
    }
  }

  /* Product artwork. The product photos currently stored in the backend are
     generic stock images that often don't match the product, so cards show an
     accurate rendering instead. Set USE_PRODUCT_PHOTOS to true once real
     photos of each product have been uploaded in the admin. */
  const USE_PRODUCT_PHOTOS = false;
  UPVC.usePhotos = USE_PRODUCT_PHOTOS;
  UPVC.productType = (product) => (window.UPVCFrames ? UPVCFrames.guessType(product) : "sliding-window");
  UPVC.productArt = function (product, opts) {
    if (!window.UPVCFrames) return "";
    const type = UPVCFrames.guessType(product);
    return UPVCFrames.svg(type, Object.assign({ finish: UPVCFrames.SHOWCASE_FINISH[type] || "white", glass: "clear" }, opts || {}));
  };
  UPVC.productScene = function (product, opts) {
    return `<div class="scene" data-type="${UPVC.productType(product)}"><div class="scene-art">${UPVC.productArt(product, opts)}</div></div>`;
  };
  /* Free Pexels photos (pexels.com/license) matched by hand to each product
     type, stored in assets/img/stock/. Types without a fitting photo
     (e.g. picture window, french door) keep the rendering. */
  const STOCK_BY_SLUG = { "tilt-turn-window": "tilt-turn-window" };
  const STOCK_BY_TYPE = {
    "sliding-window": "sliding-window", "casement-window": "casement-window", "sliding-door": "sliding-door",
    "bifold-door": "bifold-door", balcony: "balcony", shower: "shower", louvers: "louvers",
    partition: "partition", "jali-door": "jali-door",
  };
  UPVC.stockPhoto = function (product) {
    const key = STOCK_BY_SLUG[product.slug] || STOCK_BY_TYPE[UPVC.productType(product)];
    return key ? `assets/img/stock/${key}` : null;
  };
  /* <img> markup for a product photo: uploaded photo, or a responsive stock WebP */
  UPVC.photoTag = function (product, opts) {
    opts = opts || {};
    const alt = UPVC.esc(product.name);
    const lazy = opts.eager ? 'fetchpriority="high"' : 'loading="lazy"';
    if (USE_PRODUCT_PHOTOS && product.image) return `<img src="${UPVC.esc(product.image)}" alt="${alt}" ${lazy} decoding="async">`;
    const base = UPVC.stockPhoto(product);
    if (!base) return "";
    if (!opts.big) return `<img src="${base}-640.webp" width="640" height="800" alt="${alt}" ${lazy} decoding="async">`;
    return `<img src="${base}-640.webp" srcset="${base}-640.webp 640w, ${base}-1200.webp 1200w" sizes="${opts.sizes || "100vw"}" width="640" height="800" alt="${alt}" ${lazy} decoding="async">`;
  };
  UPVC.productPhoto = (product) => (USE_PRODUCT_PHOTOS && product.image) || UPVC.stockPhoto(product);
  UPVC.productMedia = (product) => UPVC.photoTag(product) || UPVC.productScene(product);
  UPVC.quoteUrl = (product, extra) => "contact.html?product=" + encodeURIComponent(product.name) + (extra ? "&config=" + encodeURIComponent(extra) : "");
  UPVC.esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* Products known at build time have a static, crawlable page */
  UPVC.productUrl = (p) => ((window.UPVC_STATIC || []).indexOf(p.slug) !== -1 ? `product-${p.slug}.html` : "product-detail.html?slug=" + encodeURIComponent(p.slug));
  UPVC.productCard = function (p) {
    const e = UPVC.esc;
    const url = UPVC.productUrl(p);
    const blurb = (p.description || "").split(/[.\n]/)[0];
    return `<article class="pcard" data-reveal>
        <div class="pcard-media">
          <a href="${url}" class="pcard-link" data-cursor="View" aria-label="${e(p.name)}">${UPVC.productMedia(p)}</a>
          ${p.category ? `<span class="pcard-tag">${e(p.category.name)}</span>` : ""}
          <a class="pcard-try" href="visualizer.html?product=${encodeURIComponent(p.slug)}"><span class="material-icons-outlined">view_in_ar</span>Try at home</a>
        </div>
        <div class="pcard-row">
          <a href="${url}" class="pcard-text"><h3 class="pcard-title">${e(p.name)}</h3>${blurb ? `<p class="pcard-blurb">${e(blurb)}</p>` : ""}</a>
          <a href="${url}" class="pcard-arrow" aria-label="View ${e(p.name)}"><span class="material-icons-outlined">arrow_forward</span></a>
        </div>
        <a class="pcard-quote" href="${UPVC.quoteUrl(p)}"><span class="material-icons-outlined">request_quote</span>Price on request · <b>Get a quote</b></a>
      </article>`;
  };

  /* Images marked data-src load when they come near the viewport */
  function initDeferredImages() {
    const imgs = $$("img[data-src]");
    if (!imgs.length) return;
    const load = (img) => {
      if (img.dataset.srcset) img.srcset = img.dataset.srcset;
      img.src = img.dataset.src;
      img.removeAttribute("data-src");
    };
    if (!("IntersectionObserver" in window)) { imgs.forEach(load); return; }
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { load(e.target); io.unobserve(e.target); }
    }), { rootMargin: "600px 600px" });
    imgs.forEach((img) => io.observe(img));
  }

  /* Public: animate newly injected nodes */
  UPVC.animate = function (root) {
    animate(root);
    if (hasGSAP) ScrollTrigger.refresh();
  };

  /* ---------------- Boot ---------------- */
  function boot() {
    if (hasGSAP) {
      gsap.registerPlugin(ScrollTrigger);
      if (window.SplitText) gsap.registerPlugin(window.SplitText);
      ScrollTrigger.config({ ignoreMobileResize: true });
    }
    initLenis();
    initChrome();
    initDeferredImages();
    initTransitions();
    initMarquees();
    initPhoneDemo();
    initMagnetic();
    initCursor();
    const go = () => {
      initHero();
      initHScroll();
      initStack();
      initThemeSections();
      animate(document);
      heroIntro();
      if (hasGSAP) ScrollTrigger.refresh();
    };
    const fontsReady = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]) : Promise.resolve();
    Promise.all([runPreloader(), fontsReady]).then(go);
    window.addEventListener("load", () => hasGSAP && ScrollTrigger.refresh());
    // fail-safe: never leave content hidden
    setTimeout(() => {
      $$("[data-reveal]").forEach((el) => { if (getComputedStyle(el).opacity === "0" && !el.hasAttribute("data-anim")) el.style.opacity = 1; });
      $$("[data-split]").forEach((el) => { if (!el.hasAttribute("data-anim")) el.style.visibility = "visible"; });
    }, 5000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
