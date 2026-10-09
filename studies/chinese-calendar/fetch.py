"""Fetch the HKO's daily conversion tables; existing pinned files are verified."""

import argparse
import hashlib
import json
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BASE = "https://www.hko.gov.hk/en/gts/time/calendar/text/files/"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, default=ROOT / ".cache")
    parser.add_argument("--record-manifest", action="store_true")
    args = parser.parse_args()
    manifest_path = ROOT / "sources.json"
    pinned = json.loads(manifest_path.read_text()) if manifest_path.exists() else []
    if not pinned and not args.record_manifest:
        parser.error(
            "sources.json is missing; use --record-manifest only when creating the study"
        )
    sources = pinned or [
        {"year": year, "file": f"T{year}e.txt", "url": f"{BASE}T{year}e.txt"}
        for year in range(1901, 2101)
    ]
    args.cache.mkdir(parents=True, exist_ok=True)

    def fetch(source):
        path = args.cache / source["file"]
        if path.exists():
            data = path.read_bytes()
        else:
            for attempt in range(3):
                try:
                    with urllib.request.urlopen(source["url"], timeout=30) as response:
                        data = response.read()
                    break
                except OSError:
                    if attempt == 2:
                        raise
                    time.sleep(attempt + 1)
        digest = hashlib.sha256(data).hexdigest()
        if "sha256" in source and source["sha256"] != digest:
            raise ValueError(
                f"{source['file']}: SHA-256 differs from the pinned source"
            )
        if "bytes" in source and source["bytes"] != len(data):
            raise ValueError(
                f"{source['file']}: byte count differs from the pinned source"
            )
        if not data.startswith(b"Gregorian-Lunar Calendar Conversion Table"):
            raise ValueError(f"{source['file']}: not a conversion table")
        if not path.exists():
            path.write_bytes(data)
        return {**source, "sha256": digest, "bytes": len(data)}

    results = []
    with ThreadPoolExecutor(max_workers=3) as pool:
        for result in pool.map(fetch, sources):
            results.append(result)
            if len(results) % 25 == 0:
                print(
                    f"Verified {len(results)}/{len(sources)} source files", flush=True
                )
    if args.record_manifest:
        manifest_path.write_text(json.dumps(results, indent=2) + "\n")
    print(
        f"Verified {len(results)} HKO tables, {sum(r['bytes'] for r in results):,} bytes"
    )


if __name__ == "__main__":
    main()
