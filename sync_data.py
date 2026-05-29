#!/usr/bin/env python3
"""
sync_data.py — Copy Tier I JSON files from Beyond GDP Project to Beyond GDP HLEG dashboard.

Run after any data pipeline update in the original project:
    python sync_data.py

Files copied: 20 Tier I indicators + countries.json + aggregate-presets.json
              + co2.json, poverty_rate.json, mpi.json (needed by aggregate.html)
"""
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC  = HERE.parent / "Beyond GDP Project" / "04_dashboard" / "data"
DST  = HERE / "04_dashboard" / "data"

TIER1_FILES = [
    # Foundational
    "ipv.json", "ghg_total.json", "bii.json",
    # Current well-being
    "household_income.json", "lu4.json", "hale.json", "lbw.json",
    "learning_outcomes.json", "homicide_rate.json", "life_satisfaction.json",
    "loneliness.json", "pm25.json", "drinking_water.json",
    # Equality & inclusion
    "gini.json", "poverty_societal.json", "gender_pay_ratio.json",
    # Sustainability & resilience
    "produced_capital.json", "neet.json", "wvs_gov_confidence.json", "wvs_trust.json",
    # Shared
    "countries.json", "aggregate-presets.json",
    # Needed by aggregate.html Option B dimensions
    "co2.json", "poverty_rate.json", "mpi.json",
]

def sync():
    DST.mkdir(parents=True, exist_ok=True)
    copied = []
    missing = []
    for fname in TIER1_FILES:
        src_file = SRC / fname
        dst_file = DST / fname
        if src_file.exists():
            shutil.copy2(src_file, dst_file)
            copied.append(fname)
        else:
            missing.append(fname)

    print(f"Synced {len(copied)} files to {DST}")
    if missing:
        print(f"WARNING: {len(missing)} source file(s) not found:")
        for f in missing:
            print(f"  - {f}")
    return len(missing) == 0

if __name__ == "__main__":
    ok = sync()
    sys.exit(0 if ok else 1)
