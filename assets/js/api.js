const API_BASE_URL = "https://upvc.pythonanywhere.com/api";
// Use this for local testing:
// const API_BASE_URL = "http://localhost:8000/api";

async function fetchFeaturedProducts() {
    try {
        const response = await fetch(`${API_BASE_URL}/featured-products/`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Error fetching featured products:", error);
        return [];
    }
}

async function fetchSiteSettings() {
    try {
        const response = await fetch(`${API_BASE_URL}/site-settings/`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Error fetching site settings:", error);
        return {};
    }
}

async function fetchCaptcha() {
    try {
        const response = await fetch(`${API_BASE_URL}/captcha/`);
        return await response.json();
    } catch (error) {
        console.error("Error fetching CAPTCHA:", error);
        return null;
    }
}

async function submitContactForm(formData) {
    try {
        const response = await fetch(`${API_BASE_URL}/contact/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            return { success: true };
        } else {
            const data = await response.json();
            return { success: false, errors: data };
        }
    } catch (error) {
        console.error("Error submitting form:", error);
        return { success: false, error: "Network error" };
    }
}

// Function to populate site settings (like phone numbers) on page load
document.addEventListener('DOMContentLoaded', async () => {
    const settings = await fetchSiteSettings();

    // Update phone numbers
    const phoneElements = document.querySelectorAll('.dynamic-phone');
    phoneElements.forEach(el => {
        if (settings.phone) {
            if (el.tagName === 'A') el.href = `tel:${settings.phone}`;
            el.textContent = settings.phone;
        }
    });

    const phoneLinks = document.querySelectorAll('.dynamic-phone-link');
    phoneLinks.forEach(el => {
        if (settings.phone) {
            el.href = `tel:${settings.phone}`;
        }
    });

    // Update whatsapp link
    const whatsappLinks = document.querySelectorAll('.dynamic-whatsapp-link');
    whatsappLinks.forEach(el => {
        if (settings.show_whatsapp_button && settings.phone) {
            // strip non-numeric characters for wa.me
            const numericPhone = settings.phone.replace(/[^0-9]/g, '');
            el.href = `https://wa.me/${numericPhone}`;
            el.classList.remove('hidden');
        }
    });

    // Update emails
    const emailElements = document.querySelectorAll('.dynamic-email');
    emailElements.forEach(el => {
        if (settings.email) {
            if (el.tagName === 'A') el.href = `mailto:${settings.email}`;
            el.textContent = settings.email;
        }
    });

    const emailLinks = document.querySelectorAll('.dynamic-email-link');
    emailLinks.forEach(el => {
        if (settings.email) {
            el.href = `mailto:${settings.email}`;
        }
    });

    // Update address
    const addressElements = document.querySelectorAll('.dynamic-address');
    addressElements.forEach(el => {
        if (settings.address) {
            el.innerHTML = settings.address.replace(/\n/g, '<br>');
        }
    });

    // Update map links
    const mapLinks = document.querySelectorAll('.dynamic-map-link');
    mapLinks.forEach(el => {
        if (settings.map_link) {
            el.href = settings.map_link;
        }
    });

    // Update hero image
    const heroImages = document.querySelectorAll('.hero-image');
    heroImages.forEach(el => {
        if (settings.hero_image) {
            el.src = settings.hero_image;
        }
    });

    // Dynamic Stats Mapping
    const statMappings = {
        'projects': 'stats_projects',
        'experience': 'stats_experience',
        'warranty': 'stats_warranty',
        'delivery': 'stats_delivery',
        'google-rating': 'stats_google_rating'
    };

    for (const [cls, key] of Object.entries(statMappings)) {
        if (settings[key]) {
            document.querySelectorAll(`.dynamic-stat-${cls}`).forEach(el => {
                el.textContent = settings[key];
            });
        }
    }

    // Dynamic Images Mapping
    const imgMappings = {
        'home-stats': 'home_stats_image',
        'home-balcony': 'home_balcony_image',
        'home-jali': 'home_jali_image',
        'home-profile': 'home_profile_image',
        'home-glass': 'home_glass_image',
        'about-hero': 'about_hero_image',
        'about-approach': 'about_approach_image'
    };

    for (const [cls, key] of Object.entries(imgMappings)) {
        if (settings[key]) {
            document.querySelectorAll(`.dynamic-img-${cls}`).forEach(el => {
                el.src = settings[key];
            });
        }
    }

    // Set active navigation link
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        const linkPath = link.getAttribute('href');
        if (linkPath === currentPath) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
});

async function fetchPortfolio() {
    try {
        const response = await fetch(`${API_BASE_URL}/portfolio/`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Error fetching portfolio:", error);
        return [];
    }
}

async function fetchPortfolioCategories() {
    try {
        const response = await fetch(`${API_BASE_URL}/portfolio/categories/`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Error fetching portfolio categories:", error);
        return [];
    }
}

async function fetchProducts(category = null) {
    try {
        let url = `${API_BASE_URL}/products/`;
        if (category) url += `?category=${category}`;
        const response = await fetch(url);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Error fetching products:", error);
        return [];
    }
}

async function fetchCategories() {
    try {
        const response = await fetch(`${API_BASE_URL}/categories/`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Error fetching categories:", error);
        return [];
    }
}


async function fetchProductDetail(slug) {
    try {
        const response = await fetch(`${API_BASE_URL}/products/${slug}/`);
        if (response.ok) {
            return await response.json();
        } else {
            console.error("Error fetching product detail:", response.status);
            return null;
        }
    } catch (error) {
        console.error("Error fetching product detail:", error);
        return null;
    }
}

async function fetchTrackingData(query) {
    try {
        const response = await fetch(`${API_BASE_URL}/track/?q=${encodeURIComponent(query)}`);
        if (response.ok) {
            return await response.json();
        } else {
            const data = await response.json();
            return { error: data.error || "Order not found" };
        }
    } catch (error) {
        console.error("Error fetching track data:", error);
        return { error: "Network error. Please try again." };
    }
}
