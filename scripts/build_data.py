"""Build all of the tool's data from public sources, in order: one command for the whole pipeline.

  1. fetch_data.py      download the parcel and zoning layers
  2. clean_parcels.py   repair parcels, one row per TMK
  3. clean_zoning.py    repair the zoning layers, use the code's district names
  4. join_zoning.py     give each parcel its district
  5. export_parcels.py  write data/parcels_statewide.csv
  6. run-parcels.mjs    run it through the engine (Node; builds the engine first)
  7. export_map.py      write the map files in web/public/data/

Run from the repo root, with the feasim-data environment active (see scripts/README.md):
  python scripts/build_data.py              every step
  python scripts/build_data.py --from 4     start at step 4, reusing earlier steps' files
"""
import argparse
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NPM = shutil.which("npm") or "npm"
STEPS = [
    [sys.executable, "scripts/fetch_data.py"],
    [sys.executable, "scripts/clean_parcels.py"],
    [sys.executable, "scripts/clean_zoning.py"],
    [sys.executable, "scripts/join_zoning.py"],
    [sys.executable, "scripts/export_parcels.py"],
    [NPM, "run", "build"],
    ["node", "scripts/run-parcels.mjs", "data/parcels_statewide.csv"],
    [sys.executable, "scripts/export_map.py"],
]
# the step numbers in the docstring; step 6 is the engine build and the run together
NUMBER = [1, 2, 3, 4, 5, 6, 6, 7]


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--from", dest="start", type=int, default=1, help="first step to run (1-7)")
    start = ap.parse_args().start
    for number, cmd in zip(NUMBER, STEPS):
        if number < start:
            continue
        shown = cmd[1:] if cmd[0] == sys.executable else cmd
        print(f"\n== step {number}: {' '.join(shown)}", flush=True)
        result = subprocess.run(cmd, cwd=ROOT)
        if result.returncode != 0:
            sys.exit(f"step {number} failed; fix it and rerun with --from {number}")
    print("\ndone: data/parcels_statewide.csv and web/public/data/ are up to date")


if __name__ == "__main__":
    main()
