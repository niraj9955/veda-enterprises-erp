#!/usr/bin/env python3
"""
Patch ERP module files: ensure every <TableHeader> inside a scrollable
container has `sticky top-0 bg-background z-10` so the column headers
stay visible while the user scrolls through long lists.

Only patches TableHeaders that are NOT already sticky (idempotent).
"""

import re
from pathlib import Path

BASE = Path("/home/z/my-project/src/components/erp")

FILES = [
    "customer-payment-module.tsx",
    "labour-payment-module.tsx",
    "tractor-payment-module.tsx",
    "dust-purchase-module.tsx",
    "cement-purchase-module.tsx",
    "hardner-module.tsx",
    "electricity-module.tsx",
    "factory-stuff-module.tsx",
]

# Pattern: <TableHeader> without className= OR with className that doesn't include "sticky top-0"
PATTERN_NO_CLASS = re.compile(r'<TableHeader>(\s*<TableRow>)')
PATTERN_OTHER_CLASS = re.compile(r'<TableHeader className="(?!.*sticky top-0)([^"]*)">(\s*<TableRow>)')

for fname in FILES:
    path = BASE / fname
    if not path.exists():
        print(f"[SKIP] {fname} — not found")
        continue
    text = path.read_text()
    orig = text

    # Case 1: <TableHeader> with no className
    text = PATTERN_NO_CLASS.sub(
        r'<TableHeader className="sticky top-0 bg-background z-10">\1',
        text,
    )
    # Case 2: <TableHeader className="..."> without sticky
    def _patch_other(m):
        cls = m.group(1)
        rest = m.group(2)
        return f'<TableHeader className="sticky top-0 bg-background z-10 {cls}">{rest}'
    text = PATTERN_OTHER_CLASS.sub(_patch_other, text)

    if text != orig:
        path.write_text(text)
        print(f"[PATCHED] {fname}")
    else:
        print(f"[OK]      {fname} — already sticky or no match")

print("\nDone.")
