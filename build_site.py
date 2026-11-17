#!/usr/bin/env python3
"""Build the static site.

Each page in _src/pages/*.html starts with a JSON front-matter block:

    <!--
    {"title": "...", "description": "...", "out": "index.html", "preloader": true}
    -->
    <section>...</section>
    <!-- @scripts -->
    <script>...</script>

The page body is wrapped with _src/layout.html (head, header, menus, dock)
and _src/footer.html, then written to the repository root.

Usage:  python3 build_site.py
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "_src"
VERSION = "2.0.1"

PRELOADER = """<div class="preloader" aria-hidden="true">
    <div class="preloader-brand"><span>UPVC Club</span><span>Windows &amp; Doors</span></div>
    <div>
        <div class="preloader-count">0</div>
        <div class="preloader-bar"><i></i></div>
    </div>
</div>"""


def render(page_path: Path) -> tuple[str, str]:
    raw = page_path.read_text()
    m = re.match(r"\s*<!--\s*(\{.*?\})\s*-->\s*", raw, re.S)
    if not m:
        raise SystemExit(f"{page_path.name}: missing JSON front-matter")
    meta = json.loads(m.group(1))
    body = raw[m.end():]
    head, scripts = "", ""
    if "<!-- @scripts -->" in body:
        body, scripts = body.split("<!-- @scripts -->", 1)
    if "<!-- @head -->" in body:
        head, body = body.split("<!-- @head -->", 1)

    for name, frag in re.findall(r"(\{\{include:([\w.-]+)\}\})", body):
        body = body.replace(name, (SRC / frag).read_text())

    layout = (SRC / "layout.html").read_text()
    footer = "" if meta.get("no_footer") else (SRC / "footer.html").read_text()
    values = {
        "title": meta["title"],
        "description": meta["description"],
        "path": "" if meta["out"] == "index.html" else meta["out"],
        "body_class": meta.get("body_class", ""),
        "preloader": PRELOADER if meta.get("preloader") else "",
        "content": body.strip("\n"),
        "footer": footer,
        "head": head.strip("\n"),
        "scripts": scripts.strip("\n"),
        "version": VERSION,
    }
    out = re.sub(r"\{\{(\w+)\}\}", lambda mm: values.get(mm.group(1), mm.group(0)), layout)
    return meta["out"], out


def main() -> None:
    for page in sorted((SRC / "pages").glob("*.html")):
        out_name, html = render(page)
        (ROOT / out_name).write_text(html)
        print(f"built {out_name}")


if __name__ == "__main__":
    main()
