#!/usr/bin/env python3
"""
=============================================================================
 THE PUSH - INDEXNOW SUBMITTER
=============================================================================
 Why this matters here:
   Bing (and DuckDuckGo, Yahoo and Ecosia, which use its index) learns about new
   pages in minutes: each night's answers pages and the /grid guide. Google
   doesn't use IndexNow; submit the sitemap in Search Console for that.

 USAGE
 -----
   # Submit everything in your sitemap:
   python scripts/indexnow.py --sitemap

   # Submit one or more specific URLs:
   python scripts/indexnow.py https://playthepush.com/ring/answers/12

   # Dry run - show what would be sent:
   python scripts/indexnow.py --sitemap --dry-run

 NOTES
 -----
   * Uses the POST/JSON endpoint so thousands of URLs can be sent in one shot.
   * Assumes your key file lives at the domain root:
       https://playthepush.com/42852ffc3ae747a6a782c18ad4afbcae.txt (public/)
   * A 200 or 202 response means accepted.
=============================================================================
"""

import json
import sys
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET

HOST = "playthepush.com"
KEY = "42852ffc3ae747a6a782c18ad4afbcae"
SITEMAP = "https://playthepush.com/sitemap.xml"
ENDPOINT = "https://api.indexnow.org/indexnow"
UA = "Mozilla/5.0 (compatible; ThePush-IndexNow/1.0)"


def get_sitemap_urls(sitemap_url=SITEMAP):
    """Pull every <loc> out of the sitemap."""
    req = urllib.request.Request(sitemap_url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as response:
        xml = response.read()
    root = ET.fromstring(xml)
    namespace = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    urls = [loc.text.strip() for loc in root.findall(".//s:loc", namespace)]
    if not urls:
        urls = [loc.text.strip() for loc in root.iter("loc")]
    return urls


def clean(urls):
    """Drop anything that is not a valid URL on our host."""
    good, bad = [], []
    for url in urls:
        url = url.strip()
        if url.endswith("/"):
            # Keep the homepage slash but normalize mistaken trailing slashes elsewhere.
            if url != f"https://{HOST}/":
                url = url.rstrip("/")
        if not (url == f"https://{HOST}" or url.startswith(f"https://{HOST}/")):
            bad.append(url)
            continue
        if url == f"https://{HOST}":
            url = f"https://{HOST}/"
        good.append(url)
    return good, bad


def submit(urls, dry_run=False):
    """POST a batch of URLs to IndexNow."""
    payload = {
        "host": HOST,
        "key": KEY,
        "urlList": urls,
    }
    body = json.dumps(payload).encode("utf-8")

    print(f"\n  Endpoint : {ENDPOINT}")
    print(f"  Host     : {HOST}")
    print(f"  Key      : {KEY}")
    print(f"  URLs     : {len(urls)}")

    if dry_run:
        print("\n  DRY RUN - nothing sent. URLs that would be submitted:")
        for url in urls:
            print("    " + url)
        return

    req = urllib.request.Request(
        ENDPOINT,
        data=body,
        headers={
            "Content-Type": "application/json; charset=utf-8",
            "User-Agent": UA,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            code = response.status
            print(f"\n  HTTP {code}")
            if code in (200, 202):
                print("  ACCEPTED. URLs are queued for the Bing index.")
                print("  There is no per-URL feedback, which is normal.")
            else:
                print(f"  Unexpected status {code}")
    except urllib.error.HTTPError as err:
        print(f"\n  HTTP {err.code}")
        explain(err.code)
        print(f"  Body: {err.read().decode('utf-8', 'replace')[:400]}")
    except Exception as err:  # noqa: BLE001 - simple CLI script
        print(f"\n  {type(err).__name__}: {err}")


def explain(code):
    tips = {
        400: "Bad request - malformed JSON or invalid URL in the list.",
        403: (
            "Key not valid. Check that "
            f"https://{HOST}/{KEY}.txt loads and contains only the key."
        ),
        422: "URLs do not belong to this host, or the key does not match.",
        429: "Too many requests - you are rate limited. Slow down.",
    }
    if code in tips:
        print("  " + tips[code])


def preflight():
    """Check the key file is live and correct before submitting."""
    key_url = f"https://{HOST}/{KEY}.txt"
    print("=" * 74)
    print("PREFLIGHT: checking your key file")
    print("=" * 74)
    print(f"  Fetching {key_url}")
    try:
        req = urllib.request.Request(key_url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=20) as response:
            body = response.read().decode("utf-8", "replace").strip()
            print(f"  HTTP {response.status}")
            print(f"  Content-Type: {response.headers.get('Content-Type', '')}")
            print(f"  Body: {body!r}")
            if body == KEY:
                print("  Key file is correct.")
                return True
            print("  Body does not match the key.")
            print(f"  Expected exactly: {KEY}")
            return False
    except urllib.error.HTTPError as err:
        print(f"  HTTP {err.code} - key file not reachable.")
        print(f"  Make sure public/{KEY}.txt is deployed (push to main).")
        return False
    except Exception as err:  # noqa: BLE001 - simple CLI script
        print(f"  {type(err).__name__}: {err}")
        return False


def main():
    args = sys.argv[1:]
    dry_run = "--dry-run" in args
    args = [arg for arg in args if arg != "--dry-run"]

    if not preflight():
        print("\n  Fix the key file first - submissions will fail without it.\n")
        if not dry_run:
            sys.exit(1)

    if "--sitemap" in args:
        print("\n" + "=" * 74)
        print("Reading sitemap")
        print("=" * 74)
        urls = get_sitemap_urls()
        print(f"  Found {len(urls)} URLs in sitemap")
    elif args:
        urls = args
    else:
        print(__doc__)
        sys.exit(0)

    good, bad = clean(urls)
    if bad:
        print(f"\n  Skipped {len(bad)} URL(s) not on https://{HOST}/:")
        for url in bad[:10]:
            print("    " + url)

    if not good:
        print("\n  Nothing valid to submit.")
        sys.exit(1)

    print("\n" + "=" * 74)
    print("SUBMITTING")
    print("=" * 74)
    submit(good, dry_run=dry_run)
    print()


if __name__ == "__main__":
    main()
