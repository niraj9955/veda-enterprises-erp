#!/usr/bin/env python3
"""
Clean up the doubled/tripled "of {filteredX.length} of" patterns in badge text.
Replaces any chain of repeated `{filteredX.length} of ` prefixes with a single one.
"""
import re
from pathlib import Path

BASE = Path("/home/z/my-project/src/components/erp")

# Pattern: `{filteredX.length} of ` repeated 1+ times, followed by `{items.length} word`
# Replace with: single `{filteredX.length} of {items.length} word`
PATTERN = re.compile(
    r"(?:\{filtered\w+\.length\}\s+of\s+)+(\{\w+\.length\}\s+\w+)"
)

def clean_file(fp: Path) -> bool:
    src = fp.read_text(encoding="utf-8")
    new_src = PATTERN.sub(r"{filtered\g<1>}", src, count=5)
    # Actually use a smarter sub
    def repl(m):
        # m.group(0) is the full match like `{filteredItems.length} of {filteredItems.length} of {items.length} record`
        # m.group(1) is the last part like `{items.length} record`
        # We need the filtered name from the FIRST match in the chain
        full = m.group(0)
        # Extract filtered name from first occurrence
        fm = re.match(r"\{(filtered\w+)\.length\}", full)
        if fm:
            return "{" + fm.group(1) + ".length} of " + m.group(1)
        return full
    new_src = PATTERN.sub(repl, src)
    if new_src != src:
        fp.write_text(new_src, encoding="utf-8")
        return True
    return False

def main():
    fixed = 0
    for fp in BASE.glob("*-module.tsx"):
        if clean_file(fp):
            print(f"  CLEANED {fp.name}")
            fixed += 1
    print(f"\nDone. Cleaned {fixed} files.")

if __name__ == "__main__":
    main()
