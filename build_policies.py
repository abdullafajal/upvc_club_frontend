import re

with open("/Users/aqib/work/upvc_club_frontend/index.html", "r") as f:
    index_html = f.read()

# Extract header and footer from index.html
header_match = re.search(r"(.*?)<!-- Main Content -->", index_html, re.DOTALL)
footer_match = re.search(r"(<!-- Footer -->.*)", index_html, re.DOTALL)

header = header_match.group(1) if header_match else ""
footer = footer_match.group(1) if footer_match else ""

def generate_page(django_file, output_file):
    with open(f"/Users/aqib/work/upvc_club/templates/website/{django_file}", "r") as f:
        django_html = f.read()
    
    content_match = re.search(r"{%\s*block content\s*%}(.*?){%\s*endblock\s*%}", django_html, re.DOTALL)
    content = content_match.group(1) if content_match else ""
    
    # Clean up tags
    content = re.sub(r"{%.*?%}", "", content)
    content = content.replace("{{ global_preferences.contact__email }}", "<span class=\"dynamic-email\">info@upvcclub.com</span>")
    content = content.replace("{{ global_preferences.contact__phone }}", "<span class=\"dynamic-phone\">+91 0000000000</span>")
    content = content.replace("{% url 'website:home' %}", "index.html")
    
    full_html = header + "\n<main class=\"flex-grow\">\n" + content + "\n</main>\n" + footer
    
    with open(f"/Users/aqib/work/upvc_club_frontend/{output_file}", "w") as f:
        f.write(full_html)

generate_page("privacy_policy.html", "privacy-policy.html")
generate_page("terms.html", "terms.html")
generate_page("sitemap.html", "sitemap.html")
