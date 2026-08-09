import requests
import time
import json
import os
import sys
import random
from datetime import datetime, timezone

try:
    from tenacity import (
        retry,
        stop_after_attempt,
        wait_exponential,
        retry_if_exception_type,
        RetryError
    )
except ImportError:
    print("!!! Brak biblioteki 'tenacity'. Zainstaluj ją: pip install tenacity")
    sys.exit(1)

from requests.exceptions import RequestException

APP_ID = 730
CURRENCY = 6          # PLN
COUNTRY = "PL"
BASE_URL = "https://steamcommunity.com/market/search/render/"
OUTPUT_PATH = "docs/data/items.json"
PROGRESS_FILE = "scraper/progress.json"
MAX_PAGES = 300
DELAY_MIN = 5.0        # minimalny odstęp między stronami
DELAY_MAX = 9.0        # maksymalny odstęp
START_DELAY = 10       # dłuższa przerwa przed rozpoczęciem

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
}

class SteamMarketScraper:
    def __init__(self):
        self.items = []
        self.total_count = None
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
        self._init_session()

    def _init_session(self):
        print("Inicjalizacja sesji (pobieranie ciasteczek ze strony głównej rynku)...")
        try:
            resp = self.session.get(
                "https://steamcommunity.com/market/",
                timeout=30
            )
            resp.raise_for_status()
            print("  Ciasteczka pobrane pomyślnie.")
        except Exception as e:
            print(f"  Ostrzeżenie: nie udało się pobrać ciasteczek: {e}")

    @retry(
        stop=stop_after_attempt(5),
        wait=wait_exponential(multiplier=8, min=15, max=180),
        retry=retry_if_exception_type((RequestException, ValueError, KeyError)),
        reraise=True
    )
    def fetch_page(self, start):
        params = {
            "appid": APP_ID,
            "currency": CURRENCY,
            "country": COUNTRY,
            "start": start,
            "count": 100,
            "norender": 1
        }
        resp = self.session.get(BASE_URL, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        if not data.get("success"):
            raise ValueError(f"API zwróciło błąd: {data}")
        return data

    def parse_page(self, data):
        results = data.get("results", [])
        for r in results:
            try:
                sell_volume = int(str(r.get("sell_volume", "0")).replace(",", ""))
                self.items.append({
                    "name": r.get("name", ""),
                    "type": r.get("type", ""),
                    "sell_listings": int(r.get("sell_listings", 0)),
                    "sell_volume": sell_volume,
                    "sell_price_grosz": int(r.get("sell_price", 0)),
                    "icon_url": r.get("icon_url", ""),
                    "market_hash_name": r.get("market_hash_name", "")
                })
            except (ValueError, TypeError):
                continue

    def scrape(self, resume_from=0):
        start = resume_from
        if start == 0:
            print(f"Czekam {START_DELAY} s przed rozpoczęciem scrapowania...")
            time.sleep(START_DELAY)

        for page in range(MAX_PAGES):
            try:
                print(f"Pobieranie strony start={start}...")
                data = self.fetch_page(start)

                if self.total_count is None:
                    self.total_count = data.get("total_count", 0)
                    print(f"  Łączna liczba przedmiotów: {self.total_count}")

                if not data.get("results"):
                    print("  Brak wyników – prawdopodobnie koniec listy.")
                    break

                self.parse_page(data)
                print(f"  Pobrano {len(data['results'])} rekordów (łącznie zebrano {len(self.items)})")

                next_start = start + len(data["results"])
                self._save_progress(next_start)
                start = next_start

                if start >= self.total_count:
                    break

                # Losowa przerwa między stronami
                delay = random.uniform(DELAY_MIN, DELAY_MAX)
                print(f"  Czekam {delay:.1f} s...")
                time.sleep(delay)

            except RetryError as e:
                print(f"\n!! Strona start={start} NIE pobrana po 5 próbach. Błąd: {e.last_attempt.exception()}")
                print("Zapisuję dotychczas zebrane dane i kończę pracę (można wznowić później).")
                self._save_final()
                sys.exit(1)
            except Exception as e:
                print(f"  Niespodziewany błąd: {e}")
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
    scraper = SteamMarketScraper()
    resume = 0
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE, "r") as f:
            progress = json.load(f)
            resume = progress.get("last_start", 0)
            print(f"Znaleziono zapis postępu. Wznawiam od start={resume}\n")
    scraper.scrape(resume_from=resume)

if __name__ == "__main__":
    main()
