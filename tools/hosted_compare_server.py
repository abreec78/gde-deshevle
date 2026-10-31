#!/usr/bin/env python3
"""Optional hosted Kupiora backend. Serves the storefront and safe, opt-in price APIs.

No paid requests run by default. The Parser.market key stays exclusively server-side.
This app is intended to be deployed on Railway/Render at its own HTTPS origin.
"""
import json
import os
import re
import threading
import time
from collections import defaultdict
from datetime import datetime, timezone
from http.client import HTTPException
from http.server import ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urljoin, urlparse
from urllib.request import Request, build_opener, HTTPRedirectHandler

os.environ["KUPIORA_HOSTED_MODE"] = "yes"
if not os.environ.get("KUPIORA_PUBLIC_ORIGIN") and os.environ.get("RAILWAY_PUBLIC_DOMAIN"):
    os.environ["KUPIORA_PUBLIC_ORIGIN"] = "https://" + os.environ["RAILWAY_PUBLIC_DOMAIN"].strip("/")

import private_compare_server as private

PORT = int(os.environ.get("PORT", os.environ.get("KUPIORA_PORT", "8872")))
SHORT_PATTERN = re.compile(r"^/t/[A-Za-z0-9_-]{3,64}/?$")
ALLOWED_ASSETS = (
    "/assets/", "/data/", "/images/",
)
ALLOWED_FILES = {
    "/","/index.html","/results.html","/compare-any.html","/core.js",
    "/app.js","/catalog-loader.js","/results.js","/styles.css",
    "/inline-results.css","/results.css","/sw.js","/manifest.webmanifest",
    "/favicon.ico","/CNAME","/robots.txt",
}
lock = threading.Lock()
counts = defaultdict(int)
short_resolves = defaultdict(list)
resolution_cache = {}


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def canonical_ozon(url):
    """Only https://ozon.ru/t/* and https://ozon.ru/product/* are accepted."""
    if not isinstance(url, str) or len(url) > 500:
        return None
    try:
        parsed = urlparse(url)
        if parsed.scheme != "https" or parsed.hostname not in ("ozon.ru", "www.ozon.ru"):
            return None
        if parsed.username or parsed.password or parsed.port is not None:
            return None
        if not SHORT_PATTERN.fullmatch(parsed.path):
            return None
        return "https://ozon.ru" + parsed.path.rstrip("/")
    except ValueError:
        return None


def follow_ozon_shortlink(short_url):
    """Resolve only Ozon-owned redirects or canonical URLs, never guess a product."""
    canonical = canonical_ozon(short_url)
    if not canonical:
        return None
    opener = build_opener(NoRedirect())
    for method in ("HEAD", "GET"):
        current = canonical
        for _ in range(6):
            req = Request(current, headers={
                "User-Agent": "Mozilla/5.0 (compatible; KupioraLinkResolver/1.0)",
                "Accept": "text/html,*/*",
            }, method=method)
            try:
                with opener.open(req, timeout=7) as resp:
                    status = resp.status
                    location = resp.headers.get("Location")
                    body = resp.read(80_000) if method == "GET" and status == 200 else b""
            except HTTPError as ex:
                status = ex.code
                location = ex.headers.get("Location")
                body = b""
            except (URLError, TimeoutError, OSError, HTTPException):
                break
            if status in (301, 302, 303, 307, 308) and location:
                target = urljoin(current, location)
                p = urlparse(target)
                if p.scheme != "https" or p.hostname not in ("ozon.ru", "www.ozon.ru") or p.username or p.password:
                    return None
                product = private.ozon_product_link(target)
                if product:
                    return product
                if not SHORT_PATTERN.fullmatch(p.path):
                    break
                current = target
                continue
            if body:
                # Some storefronts expose a canonical product link without a redirect.
                text = body.decode("utf-8", "replace")
                links = re.findall(r'https://(?:www\.)?ozon\.ru/product/[^\s\x22\x27<>]+', text)
                for link in links[:30]:
                    target = private.ozon_product_link(link.replace("&amp;", "&"))
                    if target:
                        return target
            break
    return None

def allowed_static(path):
    if path in ALLOWED_FILES:
        return True
    if not path.startswith(ALLOWED_ASSETS):
        return False
    if ".." in path or "\\" in path or "/." in path:
        return False
    if path.endswith((".py", ".env", ".yml", ".yaml", ".toml", ".md", ".map")):
        return False
    return True


def consume_budget():
    """Conservative in-memory budget; deliberate default of zero requests.

    Not a billing guard across deployments; leave paid mode disabled unless the
    owner explicitly configures both the daily cap and provider paid opt-in.
    """
    day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    try:
        cap = min(50, max(0, int(os.environ.get("KUPIORA_DAILY_SEARCH_LIMIT", "0"))))
    except ValueError:
        cap = 0
    with lock:
        if cap == 0 or counts[day] >= cap:
            return False
        counts[day] += 1
    return True


class Handler(private.Handler):
    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/resolve":
            params = parse_qs(urlparse(self.path).query)
            source = params.get("url", [""])[0]
            canonical = canonical_ozon(source)
            if not canonical:
                self.reply(400, {"error": "Only Ozon /t/ HTTPS share links are accepted"})
                return
            now = time.time()
            key = self.client_address[0]
            with lock:
                short_resolves[key] = [t for t in short_resolves[key] if now - t < 3600]
                if len(short_resolves[key]) >= 20:
                    self.reply(429, {"error": "Too many short-link lookups"})
                    return
                short_resolves[key].append(now)
                cached = resolution_cache.get(canonical)
            if cached and cached[0] > now:
                target = cached[1]
            else:
                target = follow_ozon_shortlink(canonical)
                if target:
                    with lock:
                        resolution_cache[canonical] = (now + 3600, target)
            self.reply(200, {"resolved": bool(target), "url": target,
                             "reason": None if target else "Ozon did not return a usable product redirect"})
            return
        if path.startswith("/api/"):
            return super().do_GET()
        if not allowed_static(path):
            self.send_error(404, "Not Found")
            return
        return super().do_GET()

    def do_POST(self):
        if urlparse(self.path).path in ("/api/search", "/api/compare"):
            if not private.KEY or not private.ALLOW_CHARGES:
                self.reply(503, {"error": "Provider API key and paid-search opt-in are required"})
                return
            if not consume_budget():
                self.reply(429, {"error": "Public price-search quota exhausted or not enabled"})
                return
        return super().do_POST()


if __name__ == "__main__":
    print("Kupiora hosted comparison on 0.0.0.0:%d" % PORT)
    print("Price API enabled:", bool(private.KEY and private.ALLOW_CHARGES))
    print("Daily cap:", os.environ.get("KUPIORA_DAILY_SEARCH_LIMIT", "0"),
          "(default zero; no paid traffic)")
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
