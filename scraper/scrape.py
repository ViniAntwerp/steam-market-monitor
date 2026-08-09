import requests
import time
import json
import os
import sys
import random
import re
from datetime import datetime, timezone

APP_ID = 730
CURRENCY = 6
COUNTRY = "PL"
SEARCH_URL = "https://steamcommunity.com/market/search"
OUTPUT_PATH = "docs/data/items.json"
PROGRESS_FILE = "scraper/progress.json"
MAX_PAGES = 250
DELAY_MIN = 8.0
DELAY_MAX = 14.0
START_DELAY = 20  # dłuższa przerwa na początku
ITEMS_PER_PAGE = 100  # Steam daje max 100 wyników na stronę

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
}

class SteamScraper:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
        self.items = []
        self._init_cookies()

    def _init_cookies(self):
        print("Rozgrzewanie sesji (odwiedzam stronę główną rynku)...")
        try:
            r = self.session.get("https://steamcommunity.com/market/", timeout=15)
            r.raise_for_status()
            print("  Strona główna załadowana.")
        except Exception as e:
            print(f"  Ostrzeżenie: {e}")

    def fetch_page_html(self, start):
        params = {
            "q": "",
            "category_730_ItemSet[]": "any",
            "category_730_ProPlayer[]": "any",
            "category_730_StickerCapsule[]": "any",
            "category_730_TournamentTeam[]": "any",
            "category_730_Weapon[]": "any",
            "category_730_Type[]": "any",
            "appid": APP_ID,
            "currency": CURRENCY,
            "country": COUNTRY,
            "l": "polish",
            "count": ITEMS_PER_PAGE,
            "start": start,
        }
        # Losowe opóźnienie przed każdą stroną
        time.sleep(random.uniform(DELAY_MIN, DELAY_MAX))
        resp = self.session.get(SEARCH_URL, params=params, timeout=20)
        resp.raise_for_status()
        return resp.text

    def extract_items(self, html):
        # Szukamy initialListings w kodzie JavaScript strony
        match = re.search(r'var g_rgAssets\s*=\s*({.*?});', html, re.DOTALL)
        if not match:
            # alternatywny wzór – czasem dane są w initialListings
            match = re.search(r'data-initial-listings="(.*?)"', html)
            if match:
                import html as html_mod
                encoded = match.group(1)
                decoded = html_mod.unescape(encoded)
                listings = json.loads(decoded)
                return self.parse_listings(list(listings.values()))
            print("  Nie znaleziono danych w HTML, pomijam stronę.")
            return

        assets_json = match.group(1)
        try:
            data = json.loads(assets_json)
        except json.JSONDecodeError:
            print("  Błąd parsowania JSON z HTML.")
            return

        # Struktura: g_rgAssets -> { appid: { contextid: { assetid: ... } } }
        app_data = data.get(str(APP_ID), {})
        context = app_data.get("2", {})  # context 2 to najczęściej przedmioty
        listings = list(context.values())
        self.parse_listings(listings)

    def parse_listings(self, listings):
        for item in listings:
            try:
                name = item.get("name", "")
                item_type = item.get("type", "")
                sell_listings = int(item.get("sell_listings", 0))
                sell_volume = int(str(item.get("sell_volume", "0")).replace(",", ""))
                sell_price = int(item.get("sell_price", 0))
                icon_url = item.get("icon_url", "")
                market_hash_name = item.get("market_hash_name", "")
                self.items.append({
                    "name": name,
                    "type": item_type,
                    "sell_listings": sell_listings,
                    "sell_volume": sell_volume,
                    "sell_price_grosz": sell_price,
                    "icon_url": icon_url,
                    "market_hash_name": market_hash_name
                })
            except Exception:
                continue

    def scrape(self, resume_from=0):
        start = resume_from
        print(f"Start scrapowania od pozycji {start}...")
        if start == 0:
            time.sleep(START_DELAY)

        for page in range(MAX_PAGES):
            try:
                print(f"\nPobieranie strony start={start}...")
                html = self.fetch_page_html(start)
                before_count = len(self.items)
                self.extract_items(html)
                new_items = len(self.items) - before_count
                print(f"  Pobrano {new_items} przedmiotów (razem {len(self.items)})")
                if new_items == 0:
                    print("  Koniec wyników.")
                    break
                self._save_progress(start + ITEMS_PER_PAGE)
                start += ITEMS_PER_PAGE
            except requests.HTTPError as e:
                if e.response.status_code == 429:
                    print("  Otrzymano 429 – zbyt wiele żądań. Przerywam i zapisuję dotychczasowe dane.")
                    self._save_final()
                    sys.exit(1)
                else:
                    print(f"  Błąd HTTP {e.response.status_code}: {e}")
                    self._save_final()
                    sys.exit(1)
            except Exception as e:
                print(f"  Inny błąd: {e}")
                self._save_final()
                sys.exit(1)

        self._save_final()
        if os.path.exists(PROGRESS_FILE):
            os.remove(PROGRESS_FILE)

    def _save_progress(self, next_start):
        os.makedirs(os.path.dirname(PROGRESS_FILE), exist_ok=True)
        with open(PROGRESS_FILE, "w", encoding="utf-8") as f:
            json.dump({"last_start": next_start}, f)

    def _save_final(self):
        data = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "items": self.items
        }
        os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
        with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"  ✓ Zapisano {len(self.items)} przedmiotów w {OUTPUT_PATH}")

def main():
    scraper = SteamScraper()
    resume = 0
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE, "r") as f:
            progress = json.load(f)
            resume = progress.get("last_start", 0)
            print(f"Wznawianie od start={resume}")
    scraper.scrape(resume_from=resume)

if __name__ == "__main__":
    main()
