# UPVC Club Frontend

A modern, fast, static frontend for **UPVC Club** — premium UPVC & aluminium fabrication in Noida & NCR. It talks to the Django REST API in [`upvc_club`](https://github.com/abdullafajal/upvc_club) (`/api/...`) and is deployed to GitHub Pages.

## Features

- **Try at Home (camera visualizer)** — `visualizer.html`. Customers open their phone camera (or upload a photo / use a sample room), drag four corners onto a window or wall opening and see a window, door, balcony glazing, glass partition or jali door placed in true perspective. They can switch style, frame finish (white, anthracite, black, golden oak, walnut, silver, champagne) and glass (clear, grey, bronze, reflective, frosted), freeze the camera, capture a photo, save/share it and request a quote pre-filled with their configuration. Everything runs on the device — nothing is uploaded.
  Every product card and product page has a **Try at home** button that opens the visualizer with that product's style pre-selected.
- **Scroll-driven motion** — Lenis smooth scrolling and GSAP ScrollTrigger: line-by-line headline reveals, a hero image that expands to full-bleed, a pinned horizontal collection scroller, word-by-word statement fill, velocity-reactive marquees, sticky stacking cards, image wipe reveals, parallax, animated counters, magnetic buttons, a custom cursor and page-transition curtains. Respects `prefers-reduced-motion`.
- **Dynamic content** from the Django API: products, categories, featured products, portfolio, site settings (phone, email, address, images, stats), contact form with signed math CAPTCHA, and order/quotation tracking.
- **PWA** — installable, offline-capable service worker, app shortcuts for *Try at Home* and *Track Order*.
- **SEO** — per-page titles/descriptions, canonical + Open Graph tags, `LocalBusiness` structured data, `sitemap.xml`.

## Project structure

```
_src/
  layout.html          shared <head>, header, mobile menu, dock, scripts
  footer.html          shared footer
  pages/*.html         page bodies (JSON front-matter + content + page scripts)
  legal-*.frag         privacy / terms text
build_site.py          builds the root *.html files from _src/
assets/css/site.css            design system + components
assets/css/visualizer.css      Try-at-Home UI
assets/js/api.js               API client + site-settings hydration
assets/js/site.js              smooth scroll, scroll animations, header/menu, product cards
assets/js/frames.js            procedural SVG windows/doors (types, finishes, glass)
assets/js/visualizer.js        camera, perspective (WebGL homography), gestures, capture/share
assets/vendor/                 gsap, ScrollTrigger, SplitText (GSAP 3.13), lenis (1.3.4)
```

**Edit pages in `_src/`, then run `python3 build_site.py`.** The root `*.html` files are generated — commit them too, since GitHub Pages serves the repository as-is.

## Local development

1. Start the backend:
   ```bash
   cd ../upvc_club
   python manage.py runserver   # http://localhost:8000
   ```
2. Serve the frontend:
   ```bash
   cd upvc_club_frontend
   python3 build_site.py
   python3 -m http.server 5500
   ```
3. Open `http://localhost:5500`. When the site runs on `localhost`, `api.js` automatically uses `http://localhost:8000/api`; everywhere else it uses `https://upvc.pythonanywhere.com/api`. You can override it by setting `window.UPVC_API` before `api.js` loads.

The camera needs a secure context: it works on `https://` (GitHub Pages) and on `http://localhost`, but not on a plain-http LAN address. To test on a phone, use an https tunnel or the deployed site.

## Security

Contact form submissions are validated by the backend using a time-stamped signed math CAPTCHA. Visualizer photos never leave the device.

## Photo credits

Product and category photos in `assets/img/stock/` are free stock photos from [Pexels](https://www.pexels.com/license/) (no attribution required), chosen to illustrate each product type — they are not UPVC Club installations. Pexels photo IDs: sliding-window 1457842, casement-window 2343465, tilt-turn-window 6588581, sliding-door 1571463, bifold-door 7587880, balcony 6527069, shower 7546320, louvers 3316926, partition 6585752, jali-door 279810, windows-home 6283961. Replace them with photos of your own work when available (or upload product photos in the admin and set `USE_PRODUCT_PHOTOS = true` in `assets/js/site.js`).
