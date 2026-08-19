"""Extract Table S5 (published Food Compass 2.0 per-food scores) from the FC 2.0 supplement PDF.

Usage:
  python scripts/data/extract_fcs2.py "<path to Food Compass 2.0 Supplement.pdf>" [out.json]

Table S5 lives on pypdf physical pages 32..286 (the printed footers run one behind).
The table is detected by content, never by a trusted page offset: extraction starts at the
page whose first line is the S5 header and stops at the end of the document.

Known extraction quirks handled here (all observed in the actual PDF):
  * long descriptions wrap across lines -> buffer until the numeric tail matches
  * 14 rows put the 8-digit food code alone on its own line
  * the food group "7000_Fats Oils" contains a space
  * repeated "Foodcode ..." headers, "Page N of 286" footers and the two legend lines
    on the final page must be skipped even mid-row (a wrap can straddle a page break)
"""

import json
import re
import sys
from pypdf import PdfReader

HEADER = "Foodcode Description Food group FCS 2.0 FCS 1.0 Difference NOVA"
SKIP = (
    re.compile(r"^Page \d+ of \d+\s*$"),
    re.compile(r"^Foodcode\s+Description"),
    re.compile(r"^a\s*non-integer NOVA", re.I),
    re.compile(r"^anon-integer NOVA", re.I),
    re.compile(r"^HSR\s+Health Star Rating"),
    re.compile(r"^Table S5", re.I),
)

ROW_START = re.compile(r"^(\d{8})(?:\s|$)")
ROW = re.compile(
    r"^(\d{8})\s+(.+?)\s+(\d{3,5}_.+?)\s+(\d{1,3})\s+(\d{1,3})\s+(-?\d{1,3})\s+([1-4])\s+([\d.]+)\s+([A-E])$"
)

# pypdf renders a few smart quotes / dashes as U+FFFD; normalise the ones that occur.
FIXUPS = {"\ufffd": "'", "\u2019": "'", "\u2018": "'", "\u201c": '"', "\u201d": '"', "\u2013": "-", "\u2014": "-"}


def clean(line: str) -> str:
    for bad, good in FIXUPS.items():
        line = line.replace(bad, good)
    return re.sub(r"\s+", " ", line).strip()


def extract(pdf_path: str):
    reader = PdfReader(pdf_path)
    start = None
    for i, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        first = next((l for l in text.split("\n") if l.strip()), "")
        if clean(first).startswith(HEADER):
            start = i
            break
    if start is None:
        raise SystemExit("Table S5 header not found in the PDF")

    rows = []
    buf = ""
    for i in range(start, len(reader.pages)):
        text = reader.pages[i].extract_text() or ""
        for raw in text.split("\n"):
            line = clean(raw)
            if not line or any(p.search(line) for p in SKIP):
                continue
            if ROW_START.match(line):
                if buf:
                    rows.append(buf)
                buf = line
            elif buf:
                buf = f"{buf} {line}"
            # a line before the first row start is table chrome -> drop it
        # keep buf across the page break: wrapped rows straddle pages
    if buf:
        rows.append(buf)

    parsed, failed = [], []
    for text in rows:
        m = ROW.match(text)
        if not m:
            failed.append(text)
            continue
        code, desc, group, fcs2, fcs1, diff, nova, hsr, nutri = m.groups()
        parsed.append(
            {
                "code": code,
                "description": desc.strip(),
                "group": group.strip(),
                "fcs2": int(fcs2),
                "fcs1": int(fcs1),
                "nova": int(nova),
                "hsr": float(hsr),
                "nutriScore": nutri,
            }
        )
    return parsed, failed, len(rows)


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    pdf_path = sys.argv[1]
    out_path = sys.argv[2] if len(sys.argv) > 2 else "src/data/food-compass/fcs2-foods.json"

    parsed, failed, total = extract(pdf_path)
    codes = [r["code"] for r in parsed]
    unique = set(codes)
    dups = sorted({c for c in codes if codes.count(c) > 1})

    print(f"row candidates : {total}")
    print(f"parsed         : {len(parsed)}")
    print(f"unparsed       : {len(failed)}")
    for f in failed[:10]:
        print("   !", f[:140])
    print(f"unique codes   : {len(unique)}")
    print(f"duplicate codes: {len(dups)} -> {dups[:6]}{'...' if len(dups) > 6 else ''}")

    scores = [r["fcs2"] for r in parsed]
    print(f"FCS 2.0 range  : {min(scores)}..{max(scores)}")
    print(f"  pinned at 1  : {scores.count(1)}")
    print(f"  pinned at 100: {scores.count(100)}")

    # --- gates (F1) ---
    problems = []
    if len(parsed) != 9273:
        problems.append(f"expected 9273 data rows, got {len(parsed)}")
    if len(unique) != 9251:
        problems.append(f"expected 9251 unique codes, got {len(unique)}")
    if len(dups) != 22:
        problems.append(f"expected 22 duplicate codes, got {len(dups)}")
    if min(scores) != 1 or max(scores) != 100:
        problems.append(f"expected FCS range 1..100, got {min(scores)}..{max(scores)}")
    if scores.count(1) != 470:
        problems.append(f"expected 470 foods pinned at 1, got {scores.count(1)}")
    if scores.count(100) != 416:
        problems.append(f"expected 416 foods pinned at 100, got {scores.count(100)}")

    spot = {"63107010": 83, "56204005": 89}
    by_code = {}
    for r in parsed:
        by_code.setdefault(r["code"], []).append(r)
    for code, want in spot.items():
        got = [r["fcs2"] for r in by_code.get(code, [])]
        if want not in got:
            problems.append(f"spot check {code}: expected {want}, got {got}")

    dup_set = set(dups)
    for r in parsed:
        r["ambiguous"] = r["code"] in dup_set

    if problems:
        for p in problems:
            print("FAIL:", p)
        return 1

    import os

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(parsed, fh, separators=(",", ":"), ensure_ascii=False)
    print(f"wrote {out_path} ({os.path.getsize(out_path)} bytes)")
    print("ALL GATES PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
