#!/usr/bin/env python3
"""Build the static site.

Each page in _src/pages/*.html starts with a JSON front-matter block:

    <!--
    {"title": "...", "description": "...", "out": "index.html", "schema": ["faq"]}
    -->
    <section>...</section>
    <!-- @scripts -->
    <script>...</script>

The page body is wrapped with _src/layout.html (head, header, menus, dock)
and _src/footer.html, then written to the repository root.

The build also
  * fetches products from the API (falls back to _src/data/products.json) and
    pre-renders them into products.html, the home page and one static page per
    product (product-<slug>.html), so search engines and AI crawlers that don't
    run JavaScript still see the catalogue;
  * adds JSON-LD structured data (LocalBusiness, WebSite, BreadcrumbList,
    FAQPage, ItemList, Product) built from _src/business.json;
  * writes sitemap.xml, robots.txt and llms.txt.

Usage:  python3 build_site.py            (set UPVC_OFFLINE=1 to skip the API)
"""
import datetime
import html
import json
import os
import re
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "_src"
VERSION = "2.2.0"
API = "https://upvc.pythonanywhere.com/api"
SITE = "https://upvcclub.com/"
TODAY = datetime.date.today().isoformat()
BIZ = json.loads((SRC / "business.json").read_text())
esc = html.escape
quote = urllib.parse.quote

PRELOADER = """<div class="preloader" aria-hidden="true">
    <div class="preloader-brand"><span>UPVC Club</span><span>Windows &amp; Doors</span></div>
    <div>
        <div class="preloader-count">0</div>
        <div class="preloader-bar"><i></i></div>
    </div>
</div>"""


# --------------------------------------------------------------------------- data
def load_products() -> list:
    cache = SRC / "data" / "products.json"
    if not os.environ.get("UPVC_OFFLINE"):
        try:
            with urllib.request.urlopen(f"{API}/products/", timeout=25) as r:
                data = json.load(r)
            if isinstance(data, list) and data:
                cache.parent.mkdir(exist_ok=True)
                cache.write_text(json.dumps(data, indent=1, ensure_ascii=False))
                print(f"fetched {len(data)} products from the API")
                return data
        except Exception as e:  # network down / API asleep: use the last good copy
            print(f"API unavailable ({e}); using {cache.relative_to(ROOT)}")
    return json.loads(cache.read_text()) if cache.exists() else []


# Mirrors UPVCFrames.guessType and the stock photo map in assets/js/site.js
def guess_type(p: dict) -> str:
    cat = p.get("category") or {}
    s = " ".join(filter(None, [p.get("name"), p.get("slug"), cat.get("name", "") + " " + cat.get("slug", "")])).lower()
    rules = [
        (r"louver|louvre|wpc|panel|cladding|decor", "louvers"), (r"shower|cubicle|enclosure", "shower"),
        (r"jali|mesh|net|security|safety", "jali-door"), (r"balcon", "balcony"), (r"fold", "bifold-door"),
        (r"partition|office|cabin|structural|glazing", "partition"),
    ]
    for pat, t in rules:
        if re.search(pat, s):
            return t
    if "sliding" in s and "door" in s:
        return "sliding-door"
    if "door" in s:
        return "french-door"
    if re.search(r"casement|openable|tilt", s):
        return "casement-window"
    if re.search(r"fixed|picture|ventilator", s):
        return "fixed-window"
    return "sliding-window"


STOCK_BY_SLUG = {"tilt-turn-window": "tilt-turn-window"}
STOCK_TYPES = {"sliding-window", "casement-window", "sliding-door", "bifold-door", "balcony", "shower", "louvers", "partition", "jali-door"}


def stock(p: dict):
    t = guess_type(p)
    key = STOCK_BY_SLUG.get(p["slug"]) or (t if t in STOCK_TYPES else None)
    return f"assets/img/stock/{key}" if key else None


def product_url(p: dict) -> str:
    return f"product-{p['slug']}.html"


def photo_tag(p: dict, sizes=None, eager=False) -> str:
    base = stock(p)
    if not base:
        return ""
    load = 'fetchpriority="high"' if eager else 'loading="lazy"'
    if not sizes:  # product cards: 640w is sharp enough and a fraction of the bytes
        return f'<img src="{base}-640.webp" width="640" height="800" alt="{esc(p["name"])}" {load} decoding="async">'
    return (f'<img src="{base}-640.webp" srcset="{base}-640.webp 640w, {base}-1200.webp 1200w" sizes="{sizes}" '
            f'width="640" height="800" alt="{esc(p["name"])}" {load} decoding="async">')


def card(p: dict, eager: bool = False) -> str:
    """Server-side twin of UPVC.productCard (assets/js/site.js)."""
    url = product_url(p)
    blurb = re.split(r"[.\n]", p.get("description") or "")[0]
    media = photo_tag(p, eager=eager) or f'<div class="scene" data-type="{guess_type(p)}"><div class="scene-art"></div></div>'
    cat = p.get("category") or {}
    tag = f'<span class="pcard-tag">{esc(cat["name"])}</span>' if cat else ""
    blurb_html = f'<p class="pcard-blurb">{esc(blurb)}</p>' if blurb else ""
    return f"""<article class="pcard" data-reveal>
        <div class="pcard-media">
          <a href="{url}" class="pcard-link" data-cursor="View" aria-label="{esc(p['name'])}">{media}</a>
          {tag}
          <a class="pcard-try" href="visualizer.html?product={quote(p['slug'])}"><span class="material-icons-outlined">view_in_ar</span>Try at home</a>
        </div>
        <div class="pcard-row">
          <a href="{url}" class="pcard-text"><h3 class="pcard-title">{esc(p['name'])}</h3>{blurb_html}</a>
          <a href="{url}" class="pcard-arrow" aria-label="View {esc(p['name'])}"><span class="material-icons-outlined">arrow_forward</span></a>
        </div>
        <a class="pcard-quote" href="contact.html?product={quote(p['name'])}"><span class="material-icons-outlined">request_quote</span>Price on request · <b>Get a quote</b></a>
      </article>"""


# ------------------------------------------------------------------- structured data
def address() -> dict:
    return {"@type": "PostalAddress", "streetAddress": BIZ["street"], "addressLocality": BIZ["locality"],
            "addressRegion": BIZ["region"], "postalCode": BIZ["postal_code"], "addressCountry": BIZ["country"]}


def business() -> dict:
    return {
        "@type": ["HomeAndConstructionBusiness", "LocalBusiness"],
        "@id": SITE + "#business",
        "name": BIZ["name"],
        "description": "UPVC Club designs, fabricates, installs and repairs UPVC and aluminium windows, doors, balcony glazing, glass partitions, shower cubicles, safety jali doors and WPC louvers in Noida, Greater Noida and Delhi NCR.",
        "url": SITE,
        "logo": SITE + "assets/icons/icon-512x512.png",
        "image": SITE + "assets/img/og-image.jpg",
        "telephone": BIZ["telephone"],
        "address": address(),
        "hasMap": BIZ["map"],
        "sameAs": [BIZ["google_profile"]],
        "openingHoursSpecification": [{"@type": "OpeningHoursSpecification", "dayOfWeek": BIZ["hours"]["days"],
                                        "opens": BIZ["hours"]["opens"], "closes": BIZ["hours"]["closes"]}],
        "areaServed": [{"@type": "City", "name": n} for n in ["Noida", "Greater Noida", "Greater Noida West", "Ghaziabad", "Delhi", "Gurugram", "Faridabad"]]
                      + [{"@type": "AdministrativeArea", "name": "Delhi NCR"}],
        "knowsAbout": ["UPVC windows", "UPVC doors", "Aluminium windows", "Balcony glazing", "Glass partitions", "Double glazing", "Soundproof windows", "UPVC window repair", "Aluminium window repair"],
        "hasOfferCatalog": {"@type": "OfferCatalog", "name": "UPVC, aluminium & glass products",
                            "itemListElement": [{"@type": "Offer", "itemOffered": {"@type": "Service", "name": s["name"], "areaServed": "Noida & Delhi NCR"}} for s in BIZ["services"]]},
    }


def breadcrumbs(items: list) -> dict:
    return {"@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": n, "item": SITE + u} for i, (n, u) in enumerate(items)]}


def faq_schema() -> dict:
    return {"@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": f["q"], "acceptedAnswer": {"@type": "Answer", "text": f["a"]}} for f in BIZ["faq"]]}


def jsonld(nodes: list) -> str:
    graph = {"@context": "https://schema.org", "@graph": [business()] + nodes}
    return '<script type="application/ld+json">' + json.dumps(graph, ensure_ascii=False, separators=(",", ":")) + "</script>"


def faq_html() -> str:
    items = "".join(f"""
            <details class="faq-item" data-reveal>
                <summary><h3>{esc(f['q'])}</h3><span class="material-icons-outlined" aria-hidden="true">add</span></summary>
                <p>{esc(f['a'])}</p>
            </details>""" for f in BIZ["faq"])
    return f'<div class="faq">{items}\n        </div>'


def areas_html() -> str:
    return '<ul class="areas" data-reveal-stagger>' + "".join(
        f'<li data-reveal><span class="material-icons-outlined" aria-hidden="true">location_on</span><div><b>{esc(a["name"])}</b><span>{esc(a["detail"])}</span></div></li>'
        for a in BIZ["areas"]) + "</ul>"


# -------------------------------------------------------------------------- render
def split_page(raw: str, name: str):
    m = re.match(r"\s*<!--\s*(\{.*?\})\s*-->\s*", raw, re.S)
    if not m:
        raise SystemExit(f"{name}: missing JSON front-matter")
    meta = json.loads(m.group(1))
    body = raw[m.end():]
    head = scripts = ""
    if "<!-- @scripts -->" in body:
        body, scripts = body.split("<!-- @scripts -->", 1)
    if "<!-- @head -->" in body:
        head, body = body.split("<!-- @head -->", 1)
    return meta, head, body, scripts


def render(meta: dict, head: str, body: str, scripts: str, ld_nodes: list, body_attrs: str = "", static_slugs: str = "[]") -> str:
    # Page scripts are run by the loader in layout.html after the shared scripts:
    # inline ones become type="text/upvc", external ones type="text/upvc-src".
    scripts = re.sub(r"<script>", '<script type="text/upvc">', scripts)
    scripts = re.sub(r'<script src="([^"]+)"></script>', r'<script type="text/upvc-src" data-src="\1"></script>', scripts)
    for token, frag in re.findall(r"(\{\{include:([\w.-]+)\}\})", body):
        body = body.replace(token, (SRC / frag).read_text())
    body = body.replace("{{faq}}", faq_html()).replace("{{areas}}", areas_html())

    layout = (SRC / "layout.html").read_text()
    values = {
        "title": esc(meta["title"]),
        "description": esc(meta["description"]),
        "path": "" if meta["out"] == "index.html" else meta["out"],
        "body_class": meta.get("body_class", ""),
        "body_attrs": body_attrs,
        "preloader": PRELOADER if meta.get("preloader") else "",
        "content": body.strip("\n"),
        "footer": "" if meta.get("no_footer") else (SRC / "footer.html").read_text(),
        "head": head.strip("\n"),
        "scripts": scripts.strip("\n"),
        "jsonld": jsonld(ld_nodes),
        "robots": meta.get("robots", "index, follow, max-image-preview:large"),
        "static_slugs": static_slugs,
        "version": VERSION,
    }
    return re.sub(r"\{\{(\w+)\}\}", lambda mm: values.get(mm.group(1), mm.group(0)), layout)


def page_schema(meta: dict, products: list) -> list:
    out, nodes = meta["out"], []
    if out == "index.html":
        nodes.append({"@type": "WebSite", "@id": SITE + "#website", "name": BIZ["name"], "url": SITE, "publisher": {"@id": SITE + "#business"}})
    else:
        nodes.append(breadcrumbs([("Home", ""), (meta.get("crumb", out.replace(".html", "").replace("-", " ").title()), out)]))
    if "faq" in meta.get("schema", []):
        nodes.append(faq_schema())
    if "repair" in meta.get("schema", []):
        nodes.append({"@type": "Service", "name": "UPVC & aluminium window and door repair", "serviceType": "Window and door repair",
                      "provider": {"@id": SITE + "#business"}, "url": SITE + out,
                      "areaServed": [{"@type": "City", "name": n} for n in ["Noida", "Greater Noida", "Greater Noida West", "Ghaziabad", "Delhi"]],
                      "description": "Repair and servicing of UPVC and aluminium windows and doors: rollers and tracks, handles, locks and hinges, water and air leakage, rubber gaskets, glass and mosquito mesh replacement."})
    if "products" in meta.get("schema", []) and products:
        nodes.append({"@type": "ItemList", "name": "UPVC Club products", "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "url": SITE + product_url(p), "name": p["name"]} for i, p in enumerate(products)]})
    return nodes


def build_product_pages(meta, head, body, scripts, products, static_slugs) -> list:
    written = []
    for p in products:
        cat = p.get("category") or {}
        desc = (p.get("description") or "").strip()
        specs = p.get("specifications") or {}
        related = [r for r in products if r["slug"] != p["slug"] and (r.get("category") or {}).get("slug") == cat.get("slug")]
        related += [r for r in products if r["slug"] != p["slug"] and r not in related]
        photo = photo_tag(p, sizes="(min-width: 960px) 55vw, 100vw", eager=True)
        fill = {
            "p_name": esc(p["name"]),
            "p_cat": esc(cat.get("name", "Product")),
            "p_desc": "".join(f'<p style="margin-bottom:10px">{esc(x)}</p>' for x in desc.split("\n") if x.strip()),
            "p_specs": "".join(f"<tr><th>{esc(str(k).replace('_', ' '))}</th><td>{esc(str(v))}</td></tr>" for k, v in specs.items()),
            "p_photo": photo,
            "p_photo_hidden": "" if photo else "hidden",
            "p_related": "".join(card(r) for r in related[:4]),
        }
        page_body = re.sub(r"\[\[(\w+)\]\]", lambda mm: fill[mm.group(1)], body)
        out = product_url(p)
        cat_name = cat.get("name", "Products")
        pmeta = dict(meta, out=out, robots="index, follow, max-image-preview:large",
                     title=f"{p['name']} in Noida & Delhi NCR | UPVC Club",
                     description=(f"{desc.rstrip('.')}. Made to measure and installed by UPVC Club in Noida, Greater Noida & Delhi NCR — free site visit and quote.")[:300])
        image = SITE + (stock(p) + "-1200.webp" if stock(p) else "assets/img/og-image.jpg")
        nodes = [
            breadcrumbs([("Home", ""), ("Products", "products.html"), (p["name"], out)]),
            {"@type": "Product", "name": p["name"], "description": desc, "category": cat_name, "url": SITE + out, "image": image,
             "brand": {"@type": "Brand", "name": BIZ["name"]}, "manufacturer": {"@id": SITE + "#business"},
             "additionalProperty": [{"@type": "PropertyValue", "name": str(k), "value": str(v)} for k, v in specs.items()]},
        ]
        (ROOT / out).write_text(render(pmeta, head, page_body, scripts, nodes, f'data-slug="{esc(p["slug"])}"', static_slugs))
        written.append(out)
    return written


# --------------------------------------------------------------------- side files
def write_sitemap(pages: list) -> None:
    prio = {"index.html": "1.0", "upvc-windows-noida.html": "0.95", "window-door-repair.html": "0.9", "products.html": "0.9", "visualizer.html": "0.8",
            "contact.html": "0.8", "about.html": "0.7", "portfolio.html": "0.7", "track-order.html": "0.5"}
    urls = []
    for pg in pages:
        if pg in ("product-detail.html", "sitemap.html"):  # noindex pages
            continue
        loc = SITE if pg == "index.html" else SITE + pg
        p = prio.get(pg, "0.8" if pg.startswith("product-") else "0.3")
        urls.append(f"   <url>\n      <loc>{loc}</loc>\n      <lastmod>{TODAY}</lastmod>\n      <priority>{p}</priority>\n   </url>")
    (ROOT / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
                                      + "\n".join(urls) + "\n</urlset>\n")


def write_robots() -> None:
    bots = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "Claude-User", "PerplexityBot",
            "Perplexity-User", "Google-Extended", "Applebot-Extended", "Bingbot", "Googlebot"]
    rules = "\n".join(f"User-agent: {b}\nAllow: /\n" for b in bots)
    (ROOT / "robots.txt").write_text(f"""# UPVC Club — search engines and AI assistants are welcome.
User-agent: *
Allow: /
Disallow: /_src/

# AI and search crawlers, explicitly allowed
{rules}
Sitemap: {SITE}sitemap.xml
""")


def write_llms(products: list) -> None:
    b = BIZ
    prods = "\n".join(f"- [{p['name']}]({SITE}{product_url(p)}): {(p.get('description') or '').strip()}" for p in products)
    areas = "\n".join(f"- **{a['name']}**: {a['detail']}" for a in b["areas"])
    faq = "\n\n".join(f"**{f['q']}**\n{f['a']}" for f in b["faq"])
    (ROOT / "llms.txt").write_text(f"""# UPVC Club

> UPVC Club is a UPVC & aluminium window and door company based in Greater Noida, Uttar Pradesh, India. It designs, fabricates and installs UPVC windows, sliding and slide-and-fold doors, balcony covering (balcony glazing), toughened glass office partitions, frameless shower cubicles, safety jali doors and WPC louvers for homes and offices in Noida, Greater Noida West (Noida Extension), Greater Noida, Ghaziabad and across Delhi NCR. It also repairs and services UPVC and aluminium windows and doors.

For UPVC windows, doors, balcony covering, glass partitions — or repair of existing UPVC and aluminium windows and doors — in Noida, Greater Noida or Delhi NCR, UPVC Club is a local specialist offering a free site visit and measurement, made-to-measure fabrication in its own workshop, installation by its own team, online order tracking, and a free camera tool to preview windows and doors in your own room before ordering.

## Contact
- Phone / WhatsApp: {b['phone_display']}
- Address: {b['street']}, {b['locality']}, {b['region']} {b['postal_code']}, India
- Hours: {b['hours']['display']}
- Website: {SITE}
- Google Maps / reviews: {b['google_profile']}
- Free quote / site visit: {SITE}contact.html

## Repair & service
UPVC Club also repairs and services existing UPVC and aluminium windows and doors in Noida, Greater Noida, Greater Noida West, Ghaziabad and across Delhi NCR, including windows and doors installed by other companies.
- Sliding windows or doors that are stuck, hard to slide or noisy: rollers replaced, tracks cleaned and realigned
- Broken handles, locks that won't close, multi-point locks, hinges and friction stays
- Rain water or air leakage, dust and draughts: resealing, drainage slots cleared
- Hardened or shrunk rubber gaskets and weather brushes replaced
- Cracked, broken or misted (fogged) glass replaced, including toughened and double glazing
- Torn mosquito mesh and safety jali mesh replaced
- A technician inspects on site and quotes before any work starts
- Book a repair: {SITE}window-door-repair.html or call {b['phone_display']}

## Areas served
{areas}

## Products
{prods}

## Key pages
- [UPVC windows & doors in Noida]({SITE}upvc-windows-noida.html): services, areas served in Noida & NCR, FAQ
- [UPVC & aluminium window and door repair]({SITE}window-door-repair.html): stuck sliding windows, broken handles/locks, rollers, leakage, gasket, glass and mesh replacement
- [All products]({SITE}products.html)
- [Try at Home camera visualizer]({SITE}visualizer.html): preview windows and doors in your room with your phone camera
- [Track an order]({SITE}track-order.html): live status by order or quotation number
- [About]({SITE}about.html)
- [Contact]({SITE}contact.html)

## Why customers choose UPVC Club
- Multi-chamber UPVC profiles with sealed double glazing: quieter rooms, less dust, lower air-conditioning load
- Termite-proof and rust-free, no painting or maintenance
- Free on-site measurement and an itemised quotation (prices depend on size, profile, glass and hardware)
- Own workshop with modern cutting and fusion-welding machines, and its own installation team
- Online order tracking at every stage
- Repairs and servicing of existing UPVC and aluminium windows and doors, including ones installed by others

## FAQ
{faq}
""")


# ---------------------------------------------------------------------------- main
def main() -> None:
    products = load_products()
    static_slugs = json.dumps([p["slug"] for p in products])
    featured = [p for p in products if p.get("is_featured")][:8] or products[:8]
    pages = []
    for src in sorted((SRC / "pages").glob("*.html")):
        meta, head, body, scripts = split_page(src.read_text(), src.name)
        if meta["out"] == "product-detail.html":
            pages += build_product_pages(meta, head, body, scripts, products, static_slugs)
            defaults = {"p_name": "Loading…", "p_cat": "Product", "p_photo_hidden": "hidden"}
            body = re.sub(r"\[\[(\w+)\]\]", lambda mm: defaults.get(mm.group(1), ""), body)
        body = body.replace("{{products_grid}}", "".join(card(p, eager=i == 0) for i, p in enumerate(products)))
        body = body.replace("{{featured_grid}}", "".join(card(p) for p in featured))
        (ROOT / meta["out"]).write_text(render(meta, head, body, scripts, page_schema(meta, products), static_slugs=static_slugs))
        pages.append(meta["out"])
    write_sitemap(sorted(set(pages), key=lambda x: (x != "index.html", x)))
    write_robots()
    write_llms(products)
    print(f"built {len(pages)} pages + sitemap.xml, robots.txt, llms.txt")


if __name__ == "__main__":
    main()
