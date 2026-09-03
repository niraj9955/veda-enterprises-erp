#!/usr/bin/env python3
"""
Compact ALL cards & search boxes across every ERP module.

Strategy:
  1. Search Input height: h-8 -> h-7  (so all search boxes are tighter)
  2. Search icon stays at size-3.5 (already compact from earlier pass)
  3. Search Card padding: px-3 py-2 -> px-3 py-1.5
  4. Stat card padding p-2.5 -> p-2 (used widely in summaries)
  5. Card wrappers that are bare <Card> used for search get className="py-1"

Operates on every file under src/components/erp/ ending in -module.tsx
plus stock/daily-sell/etc. Skips the global card.tsx (already done).
"""
import re
import sys
from pathlib import Path

ERP_DIR = Path("/home/z/my-project/src/components/erp")
if not ERP_DIR.exists():
    print(f"ERROR: {ERP_DIR} does not exist", file=sys.stderr)
    sys.exit(1)

# Patterns: (description, regex, replacement, count_function)
# Use [\s\S]*? for non-greedy multi-line matching; never use [^>]*? (breaks on =>)
PATTERNS = [
    # 1. Search Input height: h-8 -> h-7 (only when on Input with pl-8 for search)
    ("search input h-8 -> h-7",
     re.compile(r'(<Input[^>]*?className="pl-8\s+h-)(8)(")'),
     r'\g<1>7\g<3>'),

    # 2. Search icon size already at size-3.5; also keep on size-3.5
    # (no change needed - left for clarity)

    # 3. Search Card padding px-3 py-2 -> px-3 py-1.5
    ("CardContent px-3 py-2 -> px-3 py-1.5",
     re.compile(r'<CardContent className="(px-3 py-)(2)(")'),
     r'<CardContent className="\g<1>1.5\g<3>'),

    # 4. Stat card padding p-2.5 -> p-2
    ("CardContent p-2.5 -> p-2",
     re.compile(r'<CardContent className="p-2\.5(")'),
     r'<CardContent className="p-2\g<1>'),

    # 5. Search card wrappers: <Card> used directly above CardContent px-3 py-2
    #    Replace <Card> with <Card className="py-1"> ONLY if next 2 lines contain px-3 py-1.5 or px-3 py-2
    #    We'll do this carefully after the padding edits
]

# Files explicitly excluded from bulk edits (already hand-tuned or special)
EXCLUDE_FILES = {"card.tsx", "daily-sell-module.tsx"}

def process_file(path: Path) -> int:
    """Returns number of substitutions made."""
    text = path.read_text(encoding="utf-8")
    original = text
    total_subs = 0

    for desc, pat, repl in PATTERNS:
        new_text, n = pat.subn(repl, text)
        if n > 0:
            print(f"  [{path.name}] {desc}: {n} matches")
            text = new_text
            total_subs += n

    # Step 5: Make bare <Card> wrappers compact when they wrap a search CardContent
    # Match: <Card>\n        <CardContent className="px-3 py-1.5">  OR px-3 py-2
    # Replace with: <Card className="py-1">
    card_wrap_pat = re.compile(
        r'<Card>\s*\n(\s*)<CardContent className="(px-3 py-[12](?:\.5)?)">',
    )
    def _wrap_repl(m):
        indent = m.group(1)
        pad = m.group(2)
        return f'<Card className="py-1">\n{indent}<CardContent className="{pad}">'
    new_text, n = card_wrap_pat.subn(_wrap_repl, text)
    if n > 0:
        print(f"  [{path.name}] wrap <Card> with py-1: {n} matches")
        text = new_text
        total_subs += n

    if text != original:
        path.write_text(text, encoding="utf-8")
    return total_subs


def main():
    files = sorted(ERP_DIR.glob("*.tsx"))
    files = [f for f in files if f.name not in EXCLUDE_FILES]
    grand_total = 0
    for f in files:
        subs = process_file(f)
        grand_total += subs
        if subs == 0:
            print(f"[{f.name}] no changes")
    print(f"\n=== DONE. Total substitutions: {grand_total} across {len(files)} files ===")


if __name__ == "__main__":
    main()
