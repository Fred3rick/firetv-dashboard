#!/usr/bin/env python3
"""Download the curated gallery with source and license metadata. Run manually."""

import html
import json
from pathlib import Path
import re
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
HEADERS = {"User-Agent": "FireTVDashboard/2.0 (+https://github.com/Fred3rick/firetv-dashboard)"}


def read(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=40) as response:
        return response.read()


def plain(value):
    return html.unescape(re.sub(r"<[^>]*>", "", value)).strip()


def commons(slug, title, caption, filename, group="nature"):
    params = {
        "action": "query", "format": "json", "titles": "File:" + filename,
        "prop": "imageinfo", "iiprop": "url|extmetadata", "iiurlwidth": 1920,
    }
    response = json.loads(read("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params)))
    item = next(iter(response["query"]["pages"].values()))["imageinfo"][0]
    meta = item["extmetadata"]
    credit = plain(meta.get("Artist", {"value": "Wikimedia Commons"})["value"])
    return {
        "id": slug, "group": group, "title": title, "caption": caption,
        "remote": item.get("thumburl", item["url"]), "source": item["descriptionurl"],
        "credit": credit, "license": meta["LicenseShortName"]["value"],
        "licenseUrl": meta.get("LicenseUrl", {"value": item["descriptionurl"]})["value"],
    }


def nasa(slug, title, caption, nasa_id, credit):
    response = json.loads(read("https://images-api.nasa.gov/search?" + urllib.parse.urlencode({"nasa_id": nasa_id})))
    item = response["collection"]["items"][0]
    candidates = [x for x in item["links"] if x.get("render") == "image" and x.get("width", 0) <= 2000 and x["href"].endswith(".jpg")]
    image = max(candidates, key=lambda x: x.get("width", 0))
    return {
        "id": slug, "group": "space", "title": title, "caption": caption,
        "remote": image["href"], "source": "https://images.nasa.gov/details/" + nasa_id,
        "credit": credit, "license": "NASA Media Usage Guidelines",
        "licenseUrl": "https://www.nasa.gov/nasa-brand-center/images-and-media/",
    }


def main():
    items = [
        commons("braies", "Il silenzio delle Dolomiti.", "Lago di Braies · Alto Adige, Italia", "Pragser Wildsee - Flickr - Marek Heise Photography.jpg"),
        commons("aurora", "La notte si accende.", "Aurora boreale sul Kirkjufell · Islanda", "Aurora Borealis activity on top of the Kirkjufell mountain in September 2018.jpg"),
        commons("carezza", "Un altro ritmo.", "Lago di Carezza · Dolomiti, Italia", "Karersee HDR.jpg"),
        commons("raja-ampat", "Tutte le sfumature del blu.", "Le isole di Wayag · Raja Ampat, Indonesia", "The Other Side of Wayag Island.jpg"),
        commons("waterfall", "Il tempo dell’acqua.", "La cascata di Seljalandsfoss · Islanda", "Seljalandsfoss, Suðurland, Islandia, 2014-08-16, DD 201-203 HDR.JPG"),
        commons("palermo", "Casa, da un altro punto di vista.", "Palermo · Panorama dai tetti della Cattedrale", "Panorama from Palermo cathedral roof - North.jpg", "palermo"),
        nasa("carina", "Dove nascono le stelle.", "Le Scogliere Cosmiche nella Nebulosa della Carena · James Webb", "carina_nebula", "NASA / ESA / CSA / STScI"),
        nasa("helix", "Un occhio nell’infinito.", "NGC 7293 · La Nebulosa Elica", "PIA15658", "NASA / JPL-Caltech"),
        nasa("earth", "La nostra casa, vista da lontano.", "La Terra · Composito satellitare d’archivio NASA", "PIA18033", "NASA / JPL-Caltech"),
    ]
    folder = ROOT / "assets/gallery"
    folder.mkdir(parents=True, exist_ok=True)
    for item in items:
        path = folder / (item["id"] + ".jpg")
        payload = path.read_bytes() if path.exists() else read(item["remote"])
        if not payload.startswith(b"\xff\xd8"):
            raise ValueError("Expected JPEG: " + item["remote"])
        path.write_bytes(payload)
        item["image"] = "assets/gallery/" + path.name
        item["note"] = "Fotografia d’archivio · ritaglio per lo schermo"
        print(item["id"], len(payload), item["credit"], item["license"])
    (ROOT / "data/gallery.json").write_text(json.dumps(items, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
