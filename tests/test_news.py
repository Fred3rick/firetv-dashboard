from datetime import datetime, timezone
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from update_news import parse_feed, clean


class NewsTests(unittest.TestCase):
    now = datetime(2026, 11, 7, 18, 0, tzinfo=timezone.utc)

    def feed(self, title="Una nuova scoperta nello spazio", date="Sat, 07 Nov 2026 18:00:00 +0100", url="https://example.com/story", category="News"):
        return f"<rss><channel><item><title><![CDATA[{title}]]></title><pubDate>{date}</pubDate><link>{url}</link><category>{category}</category></item></channel></rss>".encode()

    def test_dates_sources_and_categories_are_preserved(self):
        items = parse_feed(self.feed(), "Test source", self.now)
        self.assertEqual(items[0]["source"], "Test source")
        self.assertEqual(items[0]["category"], "Spazio")
        self.assertEqual(items[0]["publishedAt"], "2026-11-07T17:00:00+00:00")

    def test_ads_are_filtered_by_title_and_category(self):
        for options in [{"title": "Black Friday: VPN scontata"}, {"category": "Offerte"}, {"title": "Laptop a soli 399 euro"}]:
            with self.subTest(options=options):
                self.assertEqual(parse_feed(self.feed(**options), "Test", self.now), [])

    def test_stale_future_invalid_dates_and_unsafe_urls_are_rejected(self):
        for options in [
            {"date": "Tue, 30 May 2023 16:35:36 +0200"},
            {"date": "Sun, 08 Nov 2026 20:00:00 +0000"},
            {"date": "not a date"}, {"url": "javascript:alert(1)"},
        ]:
            with self.subTest(options=options):
                self.assertEqual(parse_feed(self.feed(**options), "Test", self.now), [])

    def test_decodes_entities_and_removes_markup(self):
        self.assertEqual(clean(" <b>L&amp;rsquo;IA</b>  cambia\n tutto "), "L’IA cambia tutto")
        self.assertEqual(clean("l\x92app gratuita"), "l’app gratuita")

    def test_handles_the_feeds_declared_encoding(self):
        payload = '<?xml version="1.0" encoding="ISO-8859-1"?>'.encode() + self.feed(title="Novità").decode().encode("latin1")
        self.assertEqual(parse_feed(payload, "Test", self.now)[0]["title"], "Novità")


if __name__ == "__main__":
    unittest.main()
