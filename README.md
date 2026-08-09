# UPVC Club Frontend

A modern, responsive, and blazing-fast headless frontend for **UPVC Club**, built to provide a premium user experience for clients looking for UPVC & Aluminium fabrication in Noida & NCR.

## 🚀 Features

- **Progressive Web App (PWA)**: Fully installable as a native app on iOS, Android, and Desktop, complete with intelligent Service Worker offline caching.
- **Dynamic Content Integration**: Headless architecture using Vanilla JavaScript (`api.js`) to seamlessly fetch products, portfolio images, and dynamic site settings (phone, email, WhatsApp) from the Django REST API backend.
- **Custom Math CAPTCHA**: A built-in, cryptographically secure math CAPTCHA to protect the contact forms from bots—without relying on privacy-invasive third parties.
- **SEO Optimized**: Fully integrated with rich meta tags, canonical links, Open Graph data, and Schema.org `LocalBusiness` structured data for top Google ranking.
- **Responsive Animations**: Beautiful UI enhanced with micro-interactions, CSS transitions, and AOS (Animate on Scroll) for a premium feel.

## 🛠 Tech Stack

- **HTML5 & Semantic Structure**
- **Vanilla CSS / Utility Classes** (Tailwind-inspired structure)
- **Vanilla JavaScript** (ES6+ with `async/await`)
- **Service Workers & Web App Manifest** (PWA Setup)

## 💻 Local Development

Since this frontend connects to a REST API, you need to ensure the backend is running locally.

1. **Start the Backend (Django):**
   ```bash
   cd ../upvc_club
   python manage.py runserver
   ```
   *(Ensure it is running on `http://localhost:8000`)*

2. **Run the Frontend:**
   Use any local server to serve the HTML files. If you have Python installed, you can easily start an HTTP server:
   ```bash
   cd upvc_club_frontend
   python -m http.server 5500
   ```
3. Open `http://localhost:5500` in your web browser.

## 📁 Repository Structure

- `/assets/js/api.js` - The core file handling all asynchronous API calls and dynamic DOM updates.
- `/manifest.json` & `/sw.js` - Service Worker and PWA configuration for caching and offline support.
- `/*.html` - Statically generated and meticulously SEO-optimized pages (`index.html`, `products.html`, `contact.html`, etc.).
- `/*.py` - Automation scripts (e.g., `build_pwa.py`, `update_seo.py`) used to rapidly inject code updates across all HTML files.

## 🔒 Security
Form submissions are validated directly by the backend using a time-stamped signature for the custom Math CAPTCHA, ensuring no data can be spoofed or submitted by automated scripts.
