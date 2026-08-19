"""Empirical resolution of Food Compass 2.0 discrepancy-ledger items 1, 3 and 5.

Run BEFORE writing engine code. Method: recompute the published FCS 2.0 for a
"clean subset" of Table S5 foods -- foods whose D4 (food-based ingredients) and D5
(additives) contributions are provably zero and whose D6 inputs are fully
determined -- so the recomputed total can be compared against the published total
with no missing-domain bias. Each ledger option is then A/B'd on that subset,
holding every other choice fixed.

Clean subset rules (checked against the FC 2.0 supplement's D4/D5 attribute lists):
  * plain cheese and plain milk: neither appears in any D4 attribute (among dairy
    only *yogurt* does), no added sugar, no additives -> D4 = D5 = 0
  * plain poultry and plain egg: poultry is not "red/processed meat" and appears in
    no D4 attribute; no added sugar, no additives -> D4 = D5 = 0
  * nothing fried / breaded / sweetened / flavoured (those re-introduce D4/D6 terms)
  * flavonoids ~ 0 and trans fat excluded, matching how Table S5 was produced
"""

import json
import math
import re
import statistics
import sys

FCS = json.load(open("src/data/food-compass/fcs2-foods.json", encoding="utf-8"))
NUT = json.load(open("src/data/food-compass/fndds-nutrients.json", encoding="utf-8"))


def scale(v, lo, hi, pmin, pmax):
    v = max(lo, min(hi, v))
    return pmin + (pmax - pmin) * (v - lo) / (hi - lo)


def ln_ratio(num, den, lo, hi):
    if num is None or den is None:
        return None
    if den <= 0:
        return None if num <= 0 else 10.0
    if num <= 0:
        return -10.0
    return scale(math.log(num / den), lo, hi, -10.0, 10.0)


VIT = {"vitA": 225, "vitB1": 0.3, "vitB2": 0.325, "vitB3": 4, "vitB6": 0.325, "folate": 100,
       "vitB12": 0.6, "vitC": 22.5, "vitD": 3.75, "vitE": 3.75, "vitK": 30, "choline": 137.5}
MIN_POS = {"ca": 250, "p": 175, "mg": 105, "fe": 4.5, "zn": 2.75, "cu": 0.225, "se": 13.75, "k": 1175}


def top_mean(scores, n):
    if not scores:
        return 0.0
    picked = sorted(scores, key=lambda s: -abs(s))[:n]
    return sum(picked) / len(picked)


def domains(n, nova, ferment_pct, fried, dairy, ledger3, ledger5):
    kcal = n["kcal"]
    f = 100.0 / kcal  # per-100g -> per-100kcal

    # --- D1 nutrient ratios ---
    fat, sfa, mufa, pufa = n["fat"], n["sfa"], n["mufa"], n["pufa"]
    if mufa is not None or pufa is not None:
        unsat = (mufa or 0) + (pufa or 0)
    elif fat is not None and sfa is not None:
        unsat = max(0.0, fat - sfa)
    else:
        unsat = None
    ratios = []
    if fat is not None and fat * 9 / kcal >= 0.10:
        s = ln_ratio(unsat, sfa, -0.66, 1.77)
        if s is not None:
            ratios.append((s, 0.5 if dairy else 1.0))
    if n["carb"] is not None and n["carb"] * 4 / kcal >= 0.10:
        s = ln_ratio(n["fiber"], n["carb"], -7.02, -0.78)
        if s is not None:
            ratios.append((s, 1.0))
    kp, nap = (n["k"] or 0) * f, (n["na"] or 0) * f
    if kp >= 10 and nap >= 10:
        s = ln_ratio(n["k"], n["na"], -2.02, 3.30)
        if s is not None:
            ratios.append((s, 1.0))
    if not ratios:
        d1 = 0.0
    elif ledger3 == "halve_then_plain_mean":
        d1 = sum(s * w for s, w in ratios) / len(ratios)
    else:
        d1 = sum(s * w for s, w in ratios) / sum(w for _, w in ratios)

    # --- D2 vitamins / D3 minerals ---
    d2 = top_mean([scale((n[k] or 0) * f, 0, t, 0, 10) for k, t in VIT.items() if n[k] is not None], 5)
    mins = [scale((n[k] or 0) * f, 0, t, 0, 10) for k, t in MIN_POS.items() if n[k] is not None]
    if n["na"] is not None:
        mins.append(scale(nap, 0, 575, 0, -10))
    d3 = top_mean(mins, 5)

    # --- D6 processing ---
    s_nova = {1: 10.0, 2: 7.5, 3: 5.0, 4: -10.0}[nova]
    s_ferm = scale(ferment_pct, 0, 50, 0, 10)
    s_fry = -10.0 if fried else 0.0
    d6 = (s_nova + 0.5 * s_ferm + 0.5 * s_fry) / 2.0

    # --- D7 specific lipids (trans excluded: publication parity) ---
    lipids = [
        (scale(((n["epa"] or 0) + (n["dha"] or 0)) * 1000.0 * f, 0, 62.5, 0, 10), 1.0),
        (scale((n["c183"] or 0) * f, 0, 0.4, 0, 10), 0.5),
        (scale(((n["c8"] or 0) + (n["c10"] or 0) + (n["c12"] or 0)) * f, 0, 0.32, 0, 10), 0.5),
    ]
    if n["chol"] is not None:
        lipids.append((scale(n["chol"] * f, 0, 75, 0, -10), 0.5))
    top3 = sorted(lipids, key=lambda x: -abs(x[0]))[:3]
    agg = sum(s * w for s, w in top3)
    if ledger5 == "weighted_mean":
        agg /= sum(w for _, w in top3)
    d7 = 0.5 * agg

    # --- D8 fibre and protein ---
    d8 = (scale((n["fiber"] or 0) * f, 0, 9.5, 0, 10) + 0.5 * scale((n["protein"] or 0) * f, 0, 14, 0, 10)) / 1.5

    # --- D9 phytochemicals (flavonoids = 0 for parity; carotenoids = summed proxy) ---
    d9 = 0.5 * ((0.0 + scale((n["carotenoidProxy"] or 0) * f, 0, 8746.81, 0, 10)) / 2.0)

    raw = d1 + d2 + d3 + 0.0 + 0.0 + d6 + d7 + d8 + d9
    fcs = round(100 - ((35.0 - max(-12.1, min(35.0, raw))) / 47.1) * 99)
    return max(1, min(100, fcs)), raw


BAD = re.compile(
    r"fried|batter|breaded|coated|floured|chocolate|flavor|sweeten|sugar|with fruit|honey|"
    r"syrup|dessert|shake|smoothie|eggnog|condensed|malted|sauce|soup|salad|sandwich|"
    r"casserole|creamed|dip|spread|substitute|imitation|nondairy|non-dairy|analog|and |with |"
    # processed/cured poultry is "processed meat": it carries the D5 nitrite term and the D4
    # red/processed-meat penalty, neither of which is computable here -> not a clean row.
    r"deli|luncheon|smoked|cured|canned|nugget|patty|patties|loaf|roll,|sausage|frank|"
    r"strips|tenders|salted|brined|marinated|seasoned|barbecue|rotisserie",
    re.I,
)
CHEESE = re.compile(r"^Cheese, (?!sauce|spread|dip|food|product)", re.I)
MILK = re.compile(r"^Milk, (whole|reduced fat|low fat|lowfat|fat free|nonfat|skim|NFS|buttermilk)", re.I)
POULTRY = re.compile(r"^(Chicken|Turkey|Duck|Goose|Cornish game hen|Quail|Pheasant), ", re.I)
EGG = re.compile(r"^Egg, (whole|white|yolk)", re.I)


def clean_subset():
    seen, out = set(), []
    dup = set(r["code"] for r in FCS if r["ambiguous"])
    for r in FCS:
        code = r["code"]
        if code in dup or code in seen or code not in NUT:
            continue
        n = NUT[code]
        if not n["kcal"] or n["kcal"] < 5 or (n["alcohol"] or 0) > 0:
            continue
        d = r["description"]
        if BAD.search(d):
            continue
        kind = None
        if r["group"] == "6000_Dairy" and CHEESE.match(d):
            kind = "cheese"
        elif r["group"] == "6000_Dairy" and MILK.match(d):
            kind = "milk"
        elif r["group"] == "5000_MPE" and POULTRY.match(d):
            kind = "poultry"
        elif r["group"] == "5000_MPE" and EGG.match(d):
            kind = "egg"
        if kind is None:
            continue
        seen.add(code)
        out.append((r, n, kind))
    return out


def evaluate(subset, ledger3, ledger5):
    res = []
    for r, n, kind in subset:
        dairy = kind in ("cheese", "milk")
        ferment = 100.0 if kind == "cheese" else 0.0
        got, raw = domains(n, r["nova"], ferment, False, dairy, ledger3, ledger5)
        res.append((r, kind, got, r["fcs2"], got - r["fcs2"]))
    return res


def report(label, res, keep=None):
    rows = [x for x in res if keep is None or x[1] in keep]
    if not rows:
        return None
    errs = [x[4] for x in rows]
    bias = statistics.mean(errs)
    mae = statistics.mean(abs(e) for e in errs)
    cmae = statistics.mean(abs(e - bias) for e in errs)
    pub = [x[3] for x in rows]
    got = [x[2] for x in rows]
    try:
        r = statistics.correlation(pub, got)
    except statistics.StatisticsError:
        r = float("nan")
    print("  %-44s n=%4d  bias=%+6.2f  MAE=%5.2f  bcMAE=%5.2f  r=%.4f" % (label, len(rows), bias, mae, cmae, r))
    return cmae


def main():
    subset = clean_subset()
    kinds = {}
    for _, _, k in subset:
        kinds[k] = kinds.get(k, 0) + 1
    print("clean subset: %d foods  %s\n" % (len(subset), kinds))

    print("LEDGER 3 - dairy half-weight semantics (D1). Held fixed: ledger5=weighted_mean")
    a = evaluate(subset, "halve_then_plain_mean", "weighted_mean")
    b = evaluate(subset, "weighted_mean", "weighted_mean")
    print("  option (a) halve the UFA:SFA score, then plain-average over passing ratios:")
    report("all clean foods", a)
    a_d = report("dairy only", a, {"cheese", "milk"})
    print("  option (b) weight 0.5 inside a weighted domain mean (denominator 2.5):")
    report("all clean foods", b)
    b_d = report("dairy only", b, {"cheese", "milk"})
    win3 = "halve_then_plain_mean" if a_d < b_d else "weighted_mean"
    print("  -> LEDGER 3 WINNER: %s  (dairy bcMAE %.2f vs %.2f)\n" % (win3, min(a_d, b_d), max(a_d, b_d)))

    print("LEDGER 5 - D7 top-3 aggregation. Held fixed: ledger3=%s" % win3)
    m = evaluate(subset, win3, "weighted_mean")
    s = evaluate(subset, win3, "weighted_sum")
    print("  weighted mean = sum(w*s)/sum(w):")
    m_all = report("all clean foods", m)
    report("egg + poultry (cholesterol-dominant)", m, {"egg", "poultry"})
    print("  weighted sum  = sum(w*s):")
    s_all = report("all clean foods", s)
    report("egg + poultry (cholesterol-dominant)", s, {"egg", "poultry"})
    win5 = "weighted_mean" if m_all < s_all else "weighted_sum"
    print("  -> LEDGER 5 WINNER: %s  (clean-subset bcMAE %.2f vs %.2f)\n" % (win5, min(m_all, s_all), max(m_all, s_all)))

    print("LEDGER 1 - nitrite limit 25%% vs 50%% of calories from processed meat")
    cured = re.compile(r"bacon|^ham,|frankfurter|hot dog|sausage|salami|bologna|pepperoni|"
                       r"pastrami|corned beef|prosciutto|chorizo|jerky", re.I)
    hits = [r for r in FCS if not r["ambiguous"] and cured.search(r["description"]) and r["group"] == "5000_MPE"]
    print("  D5's nitrite term needs FPED processed-meat energy shares, which appear in neither")
    print("  source file, so it is not computable for any row here.")
    print("  near-pure cured-meat rows in S5 group 5000_MPE: %d" % len(hits))
    print("  at ~100%% of calories from processed meat BOTH slopes clip to -10, so all %d" % len(hits))
    print("  produce an identical score. The slopes differ only on 25-50%% mixtures, whose")
    print("  processed-meat energy share is exactly the missing input.")
    print("  -> LEDGER 1: NOT EMPIRICALLY DISCRIMINABLE with the available data (recorded, not guessed).\n")

    print("final resolution: ledger3=%s  ledger5=%s" % (win3, win5))
    best = evaluate(subset, win3, win5)
    report("FINAL clean-subset agreement", best)
    for k in ("cheese", "milk", "poultry", "egg"):
        report("  " + k, best, {k})
    print("\n  largest residuals:")
    for r, kind, got, pub, err in sorted(best, key=lambda x: -abs(x[4]))[:10]:
        print("    %s %+4d  pub=%3d got=%3d  %-8s %s" % (r["code"], err, pub, got, kind, r["description"][:54]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
