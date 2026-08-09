import os
import re

DJANGO_DIR = "../upvc_club/templates/website"
FRONTEND_DIR = "."

def read_file(path):
    with open(path, 'r') as f:
        return f.read()

def write_file(path, content):
    with open(path, 'w') as f:
        f.write(content)

def clean_django_tags(html):
    # Replace {% static 'path' %} with ./path
    html = re.sub(r"{%\s*static\s*'([^']+)'\s*%}", r"./\1", html)
    html = re.sub(r'{%\s*static\s*"([^"]+)"\s*%}', r"./\1", html)
    
    # Replace {% url 'something' %} with corresponding .html
    # This is a naive replacement just to get the links working
    html = re.sub(r"{%\s*url\s*'website:home'\s*%}", r"index.html", html)
    html = re.sub(r"{%\s*url\s*'website:products'\s*%}", r"products.html", html)
    html = re.sub(r"{%\s*url\s*'website:portfolio'\s*%}", r"portfolio.html", html)
    html = re.sub(r"{%\s*url\s*'website:contact'\s*%}", r"contact.html", html)
    html = re.sub(r"{%\s*url\s*'website:about'\s*%}", r"about.html", html)
    html = re.sub(r"{%\s*url\s*'website:privacy_policy'\s*%}", r"privacy-policy.html", html)
    html = re.sub(r"{%\s*url\s*'website:terms'\s*%}", r"terms.html", html)
    html = re.sub(r"{%\s*url\s*'website:sitemap'\s*%}", r"sitemap.html", html)
    html = re.sub(r"{%\s*url\s*'orders:track'\s*%}", r"#", html)
    html = re.sub(r"{%\s*url\s*'dashboard:index'\s*%}", r"https://upvc.pythonanywhere.com/dashboard/", html)
    
    # Replace dynamic preference variables with span classes that api.js will populate
    html = re.sub(r"\{\{\s*global_preferences\.contact__phone\s*\}\}", r'<span class="dynamic-phone">+91 0000000000</span>', html)
    html = re.sub(r"\{\{\s*global_preferences\.contact__email\s*\}\}", r'<span class="dynamic-email">info@upvcclub.com</span>', html)
    html = re.sub(r"\{\{\s*global_preferences\.contact__address\s*\|linebreaksbr\s*\}\}", r'<span class="dynamic-address">Address Loading...</span>', html)
    
    # Remove if/endif blocks (basic cleanup)
    html = re.sub(r"{%.*?%}", "", html)
    html = re.sub(r"\{\{.*?\}\}", "", html)
    
    return html

def build_pages():
    base_html = read_file(os.path.join(DJANGO_DIR, "base_website.html"))
    
    # We will split base_html at {% block content %}{% endblock %}
    parts = base_html.split('{% block content %}{% endblock %}')
    header = parts[0]
    footer = parts[1] if len(parts) > 1 else ""
    
    # Add our custom api.js to the header
    header = header.replace('</head>', '    <script src="./assets/js/api.js"></script>\n</head>')
    
    pages = {
        'home.html': 'index.html',
        'about.html': 'about.html',
        'contact.html': 'contact.html',
        'products.html': 'products.html',
        'portfolio.html': 'portfolio.html'
    }
    
    for django_file, static_file in pages.items():
        try:
            content_html = read_file(os.path.join(DJANGO_DIR, django_file))
            # Extract content between block content
            match = re.search(r"{%\s*block content\s*%}(.*?){%\s*endblock\s*%}", content_html, re.DOTALL)
            if match:
                content = match.group(1)
            else:
                content = content_html # fallback
                
            full_page = header + content + footer
            cleaned_page = clean_django_tags(full_page)
            write_file(os.path.join(FRONTEND_DIR, static_file), cleaned_page)
            print(f"Built {static_file}")
        except FileNotFoundError:
            print(f"Could not find {django_file}")

if __name__ == "__main__":
    build_pages()
