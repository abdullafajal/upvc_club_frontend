import os
import glob
import re

html_files = glob.glob("/Users/aqib/work/upvc_club_frontend/*.html")

seo_data = {
    "index.html": {
        "title": "UPVC Club - Premium UPVC & Aluminium Fabrication in Noida",
        "desc": "UPVC Club offers premium UPVC and Aluminium windows, doors, and partitions. Expert fabrication and professional installation in Noida & NCR."
    },
    "about.html": {
        "title": "About UPVC Club - Our Manufacturing Excellence",
        "desc": "Learn about UPVC Club, the leading manufacturer of UPVC, aluminium windows, and premium balcony coverings in Greater Noida."
    },
    "products.html": {
        "title": "Our Products - UPVC Windows, Doors & Glass Solutions | UPVC Club",
        "desc": "Explore UPVC Club's extensive catalog of UPVC windows, aluminium doors, glass partitions, jali doors, and premium hardware."
    },
    "portfolio.html": {
        "title": "Our Portfolio - Premium UPVC & Glass Installations | UPVC Club",
        "desc": "View our recent installations of premium UPVC windows, balcony coverings, and modern glass partitions in homes and offices across Noida."
    },
    "contact.html": {
        "title": "Contact UPVC Club - Get a Free Quote",
        "desc": "Contact UPVC Club for custom manufacturing and installation of UPVC and aluminium solutions in Noida and NCR. Request a free quote today."
    },
    "track-order.html": {
        "title": "Track Your Order - UPVC Club",
        "desc": "Track the live manufacturing and installation status of your custom UPVC and aluminium orders."
    }
}

default_seo = {
    "title": "UPVC Club - Premium UPVC & Aluminium Fabrication",
    "desc": "UPVC Club offers premium UPVC and Aluminium windows, doors, and partitions. Expert fabrication and professional installation in Noida & NCR."
}

json_ld_schema = """
    <!-- Structured Data -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "HomeAndConstructionBusiness",
      "name": "UPVC Club",
      "image": "https://upvcclub.com/assets/icons/icon-512x512.png",
      "url": "https://upvcclub.com/",
      "telephone": "+919582010747",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "Greater Noida",
        "addressRegion": "Uttar Pradesh",
        "addressCountry": "IN"
      },
      "description": "Premium UPVC and Aluminium Fabrication, Windows, Doors, and Balcony Coverings in Noida & NCR."
    }
    </script>
"""

for file_path in html_files:
    filename = os.path.basename(file_path)
    
    with open(file_path, "r") as f:
        html = f.read()

    # Determine SEO data
    data = seo_data.get(filename, default_seo)
    
    # URL for canonical and og:url
    page_url = f"https://upvcclub.com/{filename}"
    if filename == "index.html":
        page_url = "https://upvcclub.com/"

    # Replace Title
    html = re.sub(r'<title>.*?</title>', f'<title>{data["title"]}</title>', html, flags=re.IGNORECASE)
    
    # Replace description meta tag
    html = re.sub(r'<meta name="description" content=".*?">', f'<meta name="description" content="{data["desc"]}">', html, flags=re.IGNORECASE)
    
    # Replace og:title
    html = re.sub(r'<meta property="og:title" content=".*?">', f'<meta property="og:title" content="{data["title"]}">', html, flags=re.IGNORECASE)
    
    # Replace og:description
    html = re.sub(r'<meta property="og:description" content=".*?">', f'<meta property="og:description" content="{data["desc"]}">', html, flags=re.IGNORECASE)
    
    # Replace twitter:title
    html = re.sub(r'<meta property="twitter:title" content=".*?">', f'<meta property="twitter:title" content="{data["title"]}">', html, flags=re.IGNORECASE)
    
    # Replace twitter:description
    html = re.sub(r'<meta property="twitter:description" content=".*?">', f'<meta property="twitter:description" content="{data["desc"]}">', html, flags=re.IGNORECASE)

    # Fix canonical URL
    html = re.sub(r'<link rel="canonical" href=".*?">', f'<link rel="canonical" href="{page_url}">', html, flags=re.IGNORECASE)
    
    # Fix og:url
    html = re.sub(r'<meta property="og:url" content=".*?">', f'<meta property="og:url" content="{page_url}">', html, flags=re.IGNORECASE)
    
    # Fix twitter:url
    html = re.sub(r'<meta property="twitter:url" content=".*?">', f'<meta property="twitter:url" content="{page_url}">', html, flags=re.IGNORECASE)

    # Fix og:image
    html = re.sub(r'<meta property="og:image" content=".*?">', f'<meta property="og:image" content="https://upvcclub.com/assets/icons/icon-512x512.png">', html, flags=re.IGNORECASE)
    
    # Fix twitter:image
    html = re.sub(r'<meta property="twitter:image" content=".*?">', f'<meta property="twitter:image" content="https://upvcclub.com/assets/icons/icon-512x512.png">', html, flags=re.IGNORECASE)

    # Add JSON-LD schema if not present
    if "application/ld+json" not in html:
        # Insert before </head>
        html = re.sub(r'</head>', f'{json_ld_schema}\n</head>', html, flags=re.IGNORECASE)

    with open(file_path, "w") as f:
        f.write(html)
