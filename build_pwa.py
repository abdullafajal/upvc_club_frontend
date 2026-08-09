import glob
import re

html_files = glob.glob("/Users/aqib/work/upvc_club_frontend/*.html")

pwa_head_tags = """
    <!-- PWA Tags -->
    <link rel="manifest" href="./manifest.json">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <link rel="apple-touch-icon" href="./assets/icons/icon-512x512.png">
"""

sw_registration_script = """
    <!-- PWA Service Worker Registration -->
    <script>
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('./sw.js').then(registration => {
            console.log('ServiceWorker registration successful');
          }).catch(err => {
            console.log('ServiceWorker registration failed: ', err);
          });
        });
      }
    </script>
"""

for file_path in html_files:
    with open(file_path, "r") as f:
        html = f.read()

    # Inject into head if not already there
    if "rel=\"manifest\"" not in html:
        html = re.sub(r'</head>', f'{pwa_head_tags}\n</head>', html, flags=re.IGNORECASE)

    # Inject into body if not already there
    if "serviceWorker.register" not in html:
        html = re.sub(r'</body>', f'{sw_registration_script}\n</body>', html, flags=re.IGNORECASE)

    with open(file_path, "w") as f:
        f.write(html)
