#!/usr/bin/env python3
"""Build a small, same-origin news feed for the TV; Python standard library only."""

import concurrent.futures
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
import html
import json
from pathlib import Path
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
FEEDS = [
    ("HDblog", "https://www.hdblog.it/feed/"),
    ("Punto Informatico", "https://www.punto-informatico.it/feed/"),
]
PROMOTIONS = re.compile(
    r"offert|scont|black friday|prime day|coupon|risparmi|sponsorizz|affilia|"
    r"\bpromo\b|\ba soli\b|\bin regalo\b|\bprezzo\b|\bacquist", re.I
)


def clean(value):
    value = html.unescape(html.unescape(value or ""))
    # Some feeds contain Windows-1252 punctuation inside otherwise UTF-8 XML.
    value = re.sub(r"[\x80-\x9f]", lambda m: m[0].encode("latin1").decode("cp1252", errors="replace"), value)
    return re.sub(r"\s+", " ", re.sub(r"<[^>]*>", "", value)).strip()


def category(title):
    lower = title.lower()
    if re.search(r"\bia\b|\bai\b|intelligenza|chatgpt|claude|gemini|openai", lower):
        return "Intelligenza artificiale"
    if re.search(r"spazio|nasa|spacex|satellit|luna|razzo", lower):
        return "Spazio"
    if re.search(r"sicurezza|hacker|privacy|cyber|malware", lower):
        return "Sicurezza"
    if re.search(r"apple|iphone|android|samsung|smartphone|pixel", lower):
        return "Digitale"
    return "Tecnologia"


def parse_feed(payload, source, now=None):
    now = now or datetime.now(timezone.utc)
    root = ET.fromstring(payload)
    stories = []
    for item in root.findall(".//item"):
        title = clean(item.findtext("title"))
        url = (item.findtext("link") or "").strip()
        categories = " ".join(clean(c.text) for c in item.findall("category"))
        if not title or len(title) > 240 or PROMOTIONS.search(title + " " + categories):
            continue
        if urllib.parse.urlparse(url).scheme != "https":
            continue
        try:
            published = parsedate_to_datetime(item.findtext("pubDate")).astimezone(timezone.utc)
        except (ValueError, TypeError, AttributeError):
            continue
        if not now - timedelta(hours=72) <= published <= now + timedelta(minutes=15):
            continue
        stories.append({
            "title": title, "url": url, "source": source,
            "publishedAt": published.isoformat(), "category": category(title),
        })
    return stories[:8]


def fetch_feed(feed):
    source, url = feed
    request = urllib.request.Request(url, headers={
        "User-Agent": "FireTVDashboard/2.0 (+https://github.com/Fred3rick/firetv-dashboard)",
    })
    with urllib.request.urlopen(request, timeout=25) as response:
        return parse_feed(response.read(2_000_000), source)


def main():
    output = ROOT / "data/news.json"
    stories = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        jobs = {pool.submit(fetch_feed, feed): feed[0] for feed in FEEDS}
        for job in concurrent.futures.as_completed(jobs):
            try:
                items = job.result()
                print(f"{jobs[job]}: {len(items)} recent headlines")
                stories.extend(items)
            except Exception as error:
                print(f"Warning: {jobs[job]}: {error}")
    if not stories:
        # Do not overwrite the last usable feed with an empty response.
        if output.exists():
            print("No recent headlines; retaining the previous dated snapshot.")
            return
        stories = []
    stories.sort(key=lambda story: story["publishedAt"], reverse=True)
    seen = set()
    unique = []
    for story in stories:
        key = re.sub(r"\W", "", story["title"].lower())
        if key not in seen:
            unique.append(story)
            seen.add(key)
    data = {"updatedAt": datetime.now(timezone.utc).isoformat(), "items": unique[:18]}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
