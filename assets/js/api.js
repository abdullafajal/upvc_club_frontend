/* UPVC Club — headless API client for the Django backend (website/api_urls.py). */
const API_BASE_URL = window.UPVC_API || (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)
  ? "http://localhost:8000/api"
  : "https://upvc.pythonanywhere.com/api");
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

async function apiFetch(path) {
  const res = await fetch(`${API_BASE_URL}${path}`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(res.status);
  return res.json();
}

/* The API host can be slow to wake up, so list/detail responses are kept in
   localStorage: a cached copy is returned instantly and refreshed in the
   background for the next visit. */
const API_CACHE_PREFIX = "upvc-api:";
const API_CACHE_MAX_AGE = 7 * 24 * 3600 * 1000;
function cacheRead(path) {
  try {
    const hit = JSON.parse(localStorage.getItem(API_CACHE_PREFIX + path) || "null");
    if (hit && Date.now() - hit.t < API_CACHE_MAX_AGE) return hit.d;
  } catch (e) { /* storage unavailable */ }
  return undefined;
}
function cacheWrite(path, data) {
  try { localStorage.setItem(API_CACHE_PREFIX + path, JSON.stringify({ t: Date.now(), d: data })); } catch (e) { /* full or blocked */ }
}

async function apiGet(path, fallback, useCache = true) {
  const cached = useCache ? cacheRead(path) : undefined;
  const network = apiFetch(path).then((data) => { if (useCache) cacheWrite(path, data); return data; });
  if (cached !== undefined) {
    network.catch(() => {});
    return cached;
  }
  try {
    return await network;
  } catch (error) {
    console.warn(`API ${path} failed:`, error);
    return fallback;
  }
}

const fetchFeaturedProducts = () => apiGet("/featured-products/", []);
const fetchCategories = () => apiGet("/categories/", []);
const fetchPortfolio = () => apiGet("/portfolio/", []);
const fetchPortfolioCategories = () => apiGet("/portfolio/categories/", []);
const fetchCaptcha = () => apiGet("/captcha/", null, false);
const fetchProducts = (category) => apiGet(`/products/${category ? `?category=${encodeURIComponent(category)}` : ""}`, []);
const fetchProductDetail = (slug) => apiGet(`/products/${encodeURIComponent(slug)}/`, null);

let _settingsPromise = null;
function fetchSiteSettings() {
  if (!_settingsPromise) _settingsPromise = apiGet("/site-settings/", {});
  return _settingsPromise;
}

async function submitContactForm(formData) {
  try {
    const response = await fetch(`${API_BASE_URL}/contact/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(formData),
    });
    if (response.ok) return { success: true };
    let data = {};
    try { data = await response.json(); } catch (e) { /* non-JSON */ }
    return { success: false, errors: data };
  } catch (error) {
    console.error("Error submitting form:", error);
    return { success: false, error: "Network error" };
  }
}

async function fetchTrackingData(query) {
  try {
    const response = await fetch(`${API_BASE_URL}/track/?q=${encodeURIComponent(query)}`);
    const data = await response.json().catch(() => ({}));
    if (response.ok) return data;
    return { error: data.error || "Order not found" };
  } catch (error) {
    console.error("Error fetching track data:", error);
    return { error: "Network error. Please try again." };
  }
}

/* Populate phone, email, address, images and stats from site settings. */
document.addEventListener("DOMContentLoaded", async () => {
  const settings = await fetchSiteSettings();
  if (!settings || typeof settings !== "object") return;
  const each = (sel, fn) => document.querySelectorAll(sel).forEach(fn);

  if (settings.phone) {
    const tel = settings.phone.replace(/[^\d+]/g, "");
    each(".dynamic-phone", (el) => { if (el.tagName === "A") el.href = `tel:${tel}`; el.textContent = settings.phone; });
    each(".dynamic-phone-link", (el) => { el.href = `tel:${tel}`; });
  }
  if (settings.show_whatsapp_button && settings.phone) {
    const wa = settings.phone.replace(/[^0-9]/g, "");
    each(".dynamic-whatsapp-link", (el) => {
      const text = el.dataset.waText ? `?text=${encodeURIComponent(el.dataset.waText)}` : "";
      el.href = `https://wa.me/${wa}${text}`;
      el.classList.remove("hidden");
    });
  }
  if (settings.email) {
    each(".dynamic-email", (el) => { if (el.tagName === "A") el.href = `mailto:${settings.email}`; el.textContent = settings.email; });
    each(".dynamic-email-link", (el) => { el.href = `mailto:${settings.email}`; });
  }
  if (settings.address) {
    each(".dynamic-address", (el) => {
      el.textContent = "";
      settings.address.split(/\n/).forEach((line, i) => { if (i) el.appendChild(document.createElement("br")); el.appendChild(document.createTextNode(line)); });
    });
  }
  if (settings.map_link) each(".dynamic-map-link", (el) => { el.href = settings.map_link; });
  if (settings.hero_image) each(".hero-image", (el) => { el.src = settings.hero_image; });

  const stats = { projects: "stats_projects", experience: "stats_experience", warranty: "stats_warranty", delivery: "stats_delivery", "google-rating": "stats_google_rating" };
  for (const [cls, key] of Object.entries(stats)) {
    if (!settings[key]) continue;
    each(`.dynamic-stat-${cls}`, (el) => {
      el.textContent = settings[key];
      // re-run the counter if it already played with the fallback value
      if (el.dataset.done && window.UPVC && UPVC.countUp) UPVC.countUp(el);
    });
  }

  const imgs = {
    "home-stats": "home_stats_image", "home-balcony": "home_balcony_image", "home-jali": "home_jali_image",
    "home-profile": "home_profile_image", "home-glass": "home_glass_image", "about-hero": "about_hero_image", "about-approach": "about_approach_image",
  };
  for (const [cls, key] of Object.entries(imgs)) {
    if (settings[key]) each(`.dynamic-img-${cls}`, (el) => { el.src = settings[key]; });
  }

  document.dispatchEvent(new CustomEvent("upvc:settings", { detail: settings }));
});
