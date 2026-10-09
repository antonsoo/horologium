"""Parse every pinned HKO row, then compare the installed/built calendar library."""

import argparse
import calendar
import hashlib
import json
import re
import subprocess
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent.parent
# The pinned text file has 29 December followed by 31 December. Preserve
# this missing record as a gap; never synthesize the missing lunar date.
SOURCE_GAPS = {date(2069, 12, 30)}
HISTORICAL_STARTS = {"1914-11-17", "1916-02-03", "1920-11-10"}
ROW = re.compile(
    r"^(\d{4})/(\d{1,2})/(\d{1,2})\s+(\d+(?:(?:st|nd|rd|th) Lunar [Mm]onth)?)"
    r"\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)(?:\s+(.*?))?\s*$"
)


def read_days(cache):
    sources = json.loads((ROOT / "sources.json").read_text())
    if [s["year"] for s in sources] != list(range(1901, 2101)):
        raise ValueError(
            "Manifest must contain all 200 years, exactly once and in order"
        )
    raw = []
    for source in sources:
        data = (cache / source["file"]).read_bytes()
        if (
            hashlib.sha256(data).hexdigest() != source["sha256"]
            or len(data) != source["bytes"]
        ):
            raise ValueError(f"{source['file']}: source hash/length mismatch")
        lines = data.decode("ascii", errors="replace").splitlines()
        expected_date = date(source["year"], 1, 1)
        for line_no, line in enumerate(lines[2:], start=3):
            match = ROW.fullmatch(line)
            if not match:
                if not line.strip():
                    continue
                if expected_date == date(source["year"] + 1, 1, 1) and (
                    line.strip().startswith(
                        f"In {source['year']}, summer time was enforced"
                    )
                    or line.strip()
                    == "(Hong Kong Summer Time = Hong Kong Standard Time +1 hour)"
                ):
                    continue
                raise ValueError(
                    f"{source['file']}:{line_no}: unrecognized record {line!r}"
                )
            y, m, d = map(int, match.group(1, 2, 3))
            actual = date(y, m, d)
            if expected_date in SOURCE_GAPS:
                expected_date += timedelta(days=1)
            if actual != expected_date or match[5] != actual.strftime("%A"):
                raise ValueError(
                    f"{source['file']}:{line_no}: missing, out-of-order, or invalid day"
                )
            raw.append((actual, match[4], source["file"], line_no, match[6] or ""))
            expected_date += timedelta(days=1)
        if expected_date != date(source["year"] + 1, 1, 1):
            raise ValueError(f"{source['file']}: incomplete year")

    # The text files label the month on day 1 only. Do not invent a month for
    # the first 19 days, whose preceding month-start row is outside the source.
    month = None
    lunar_year = 1900
    is_leap = False
    previous_day = None
    previous_civil = None
    days = []
    boundaries = []
    for civil, lunar, filename, line_no, term in raw:
        if "Lunar" in lunar:
            number = int(re.match(r"\d+", lunar)[0])
            if not 1 <= number <= 12:
                raise ValueError(f"{filename}:{line_no}: invalid month number")
            if month is not None and number not in (month, month % 12 + 1):
                raise ValueError(f"{filename}:{line_no}: impossible month progression")
            if previous_day is not None and previous_day not in (29, 30):
                raise ValueError(f"{filename}:{line_no}: month length not 29 or 30")
            leap = number == month
            if leap and is_leap:
                raise ValueError(f"{filename}:{line_no}: consecutive leap months")
            month, is_leap, day = number, leap, 1
            if month == 1 and not is_leap:
                lunar_year = civil.year
            boundaries.append([civil.isoformat(), lunar_year, month, is_leap])
        else:
            day = int(lunar)
            elapsed_days = (
                (civil - previous_civil).days if previous_civil is not None else 1
            )
            if not 1 <= day <= 30 or (
                previous_day is not None and day != previous_day + elapsed_days
            ):
                raise ValueError(f"{filename}:{line_no}: invalid lunar day progression")
        previous_day = day
        previous_civil = civil
        if month is not None:
            # Sexagenary epoch independently expressed as a civil-date delta,
            # not the library's Julian Day formula. Y. T. Liu gives this anchor:
            # https://ytliu0.github.io/ChineseCalendar/sexagenary.html (eq. 1).
            ganzhi = (civil - date(2019, 1, 27)).days % 60
            days.append(
                [
                    civil.isoformat(),
                    lunar_year,
                    month,
                    is_leap,
                    day,
                    ganzhi,
                    filename,
                    line_no,
                    term,
                ]
            )
    expected = sum(366 if calendar.isleap(y) else 365 for y in range(1901, 2101))
    if len(raw) != expected - len(SOURCE_GAPS):
        raise ValueError("Incomplete daily corpus")
    return days, boundaries, len(raw)


def known_historical_start(row):
    expected, actual = row.get("expected"), row["actual"]
    return bool(
        expected
        and expected[0] in HISTORICAL_STARTS
        and date.fromisoformat(actual[0])
        == date.fromisoformat(expected[0]) + timedelta(days=1)
        and actual[1:] == expected[1:]
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, default=ROOT / ".cache")
    parser.add_argument("--module", type=Path, default=REPO / "dist/lib/index.js")
    parser.add_argument("--output", type=Path, default=ROOT / "results.json")
    parser.add_argument("--allow-mismatches", action="store_true")
    args = parser.parse_args()
    days, boundaries, total = read_days(args.cache)
    inputs = args.cache / "days.json"
    inputs.write_text(
        json.dumps(
            {
                "days": days,
                "boundaries": boundaries,
                "sourceRows": total,
                "sourceGaps": [d.isoformat() for d in sorted(SOURCE_GAPS)],
            }
        )
    )
    run = subprocess.run(
        ["node", str(ROOT / "verify.mjs"), str(inputs), str(args.module.resolve())],
        check=True,
        capture_output=True,
        text=True,
    )
    result = json.loads(run.stdout)
    args.output.write_text(json.dumps(result, indent=2) + "\n")
    print(
        json.dumps(
            {
                k: v
                for k, v in result.items()
                if k not in ("mismatches", "inspection", "dayBoundaryMismatches")
            },
            indent=2,
        )
    )
    inspection = result["inspection"]
    print(
        f"Inspection: {inspection['years']} years, {inspection['months']} months; "
        f"{len(inspection['solarTermDateDifferences'])} solar-term civil-date differences"
    )
    if not args.allow_mismatches and (
        result["unexpectedMismatchedDays"]
        or result["dayBoundaryMismatches"]
        or not inspection["available"]
        or inspection["inconsistentBoundaries"]
        or inspection["uncheckedSolarTerms"]
        or any(
            not known_historical_start(row)
            for row in inspection["monthStartDifferences"]
        )
        or any(
            abs(
                (
                    date.fromisoformat(row["actual"])
                    - date.fromisoformat(row["expected"])
                ).days
            )
            > 1
            or (row["actual"] >= "1929-01-01" and not row["flaggedNearMidnight"])
            for row in inspection["solarTermDateDifferences"]
        )
    ):
        raise SystemExit(
            "Unexpected discrepancies: inspect the explicit differences in the report"
        )


if __name__ == "__main__":
    main()
