import re

with open("/Users/aqib/work/upvc_club_frontend/index.html", "r") as f:
    index_html = f.read()

# Extract header and footer from index.html
header_match = re.search(r"(.*?)<!-- Main Content -->", index_html, re.DOTALL)
footer_match = re.search(r"(<!-- Footer -->.*)", index_html, re.DOTALL)

header = header_match.group(1) if header_match else ""
footer = footer_match.group(1) if footer_match else ""

# Read django product_detail.html
with open("/Users/aqib/work/upvc_club/templates/website/product_detail.html", "r") as f:
    django_html = f.read()

# Extract just the block content
content_match = re.search(r"{%\s*block content\s*%}(.*?){%\s*endblock\s*%}", django_html, re.DOTALL)
content = content_match.group(1) if content_match else ""

# Remove Django tags and setup IDs for JS
content = re.sub(r"{%.*?%}", "", content) # removes if/endif, for/empty/endfor
content = content.replace("{{ product.name }}", "<span class=\"prod-name\">Loading...</span>")
content = content.replace("{{ product.category.name }}", "<span id=\"prod-cat\"></span>")
content = content.replace("{{ product.base_price|floatformat:0 }}", "<span id=\"prod-price\"></span>")
content = content.replace("{{ product.unit }}", "<span id=\"prod-unit\"></span>")
content = content.replace("{{ product.description|linebreaks }}", "<div id=\"prod-desc\"></div>")
content = content.replace("{{ product.image.url }}", "")
content = content.replace("{% url 'website:home' %}", "index.html")
content = content.replace("{% url 'website:products' %}", "products.html")
content = content.replace("{% url 'website:contact' %}", "contact.html")
content = content.replace("{{ global_preferences.contact__phone }}", "<span class=\"dynamic-phone\">+91 0000000000</span>")
content = content.replace("{{ product.name|urlencode }}", "")

# Replace specifications table with an emptytbody
spec_table_regex = re.compile(r"<tbody class=\"divide-y divide-gray-100\">.*?</tbody>", re.DOTALL)
content = spec_table_regex.sub("<tbody class=\"divide-y divide-gray-100\" id=\"prod-specs\"></tbody>", content)

# Replace thumbnails div with empty div
thumbnails_regex = re.compile(r"<div class=\"grid grid-cols-4 gap-4\">.*?</div>", re.DOTALL)
content = thumbnails_regex.sub("<div class=\"grid grid-cols-4 gap-4\" id=\"prod-thumbnails\"></div>", content)

# Fix related products section
content = content.replace("{{ related_products }}", "")
related_regex = re.compile(r"<div class=\"grid grid-cols-2 lg:grid-cols-4 gap-6\">.*?</div>", re.DOTALL)
content = related_regex.sub("<div class=\"grid grid-cols-2 lg:grid-cols-4 gap-6\" id=\"prod-related\"></div>", content)

# Add custom script for product fetching
script = """
<script>
document.addEventListener("DOMContentLoaded", async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const slug = urlParams.get("slug");
    
    if (!slug) {
        document.querySelectorAll(".prod-name").forEach(el => el.textContent = "Product Not Found");
        return;
    }
    
    const product = await fetchProductDetail(slug);
    if (!product) {
        document.querySelectorAll(".prod-name").forEach(el => el.textContent = "Product Not Found");
        return;
    }
    
    // Update basic info
    document.querySelectorAll(".prod-name").forEach(el => el.textContent = product.name);
    document.getElementById("prod-cat").textContent = product.category ? product.category.name : "";
    document.getElementById("prod-price").textContent = product.base_price;
    document.getElementById("prod-unit").textContent = product.unit;
    document.getElementById("prod-desc").innerHTML = `<p class="mb-4">${product.description.replace(/\\n/g, "<br>")}</p>`;
    
    // Update Main Image
    const mainImg = document.getElementById("main-product-image");
    if (product.image) {
        mainImg.src = product.image;
    }
    
    // Specifications
    const specTbody = document.getElementById("prod-specs");
    if (product.specifications && Object.keys(product.specifications).length > 0) {
        let rows = "";
        for (const [key, value] of Object.entries(product.specifications)) {
            rows += `
                <tr class="hover:bg-gray-50/50">
                    <td class="py-4 px-6 font-medium text-gray-500 w-1/3">${key}</td>
                    <td class="py-4 px-6 text-gray-900">${value}</td>
                </tr>
            `;
        }
        specTbody.innerHTML = rows;
    } else {
        specTbody.innerHTML = `<tr><td class="py-6 px-6 text-center text-gray-500 italic" colspan="2">No specific technical details available.</td></tr>`;
    }
    
    // Document title
    document.title = `${product.name} | UPVC Club`;
});
</script>
"""

full_html = header + "\n<main class=\"flex-grow\">\n" + content + "\n</main>\n" + script + "\n" + footer

with open("/Users/aqib/work/upvc_club_frontend/product-detail.html", "w") as f:
    f.write(full_html)
