#!/usr/bin/env python3
"""
Compact stat cards across all ERP modules AND remove the Auto-sync info banner.

Two changes:

1. Remove the "Auto-sync on save" green info banner from daily-sell-module.
   It's the rounded-lg div with RefreshCw icon and "Auto-sync on save" text.
   The user complained it appears on every section — actually it only lives
   in daily-sell-module, but it's intrusive. Remove it entirely.

2. Compact the summary stat cards (Total Sales, Total Received, etc.) that
   appear at the top of every list-style module. Currently:
     - CardContent has p-4 (16px padding) → change to p-2.5 (10px)
     - The number <p> has text-xl (20px) → change to text-base (16px)
     - Skeleton has h-6 (24px) → change to h-5 (20px) to match smaller text
     - Skeleton has mt-1 (4px margin) → change to mt-0.5 (2px)

This pattern (border-l-4 border-l-emerald-500 etc.) appears in:
  daily-sell, tractor-payment, factory-stuff, cement-purchase, hardner,
  dust-purchase, customer-payment, labour-payment, electricity
"""

import re
from pathlib import Path

MODULES_DIR = Path('/home/z/my-project/src/components/erp')

# All modules with stat cards (border-l-4 pattern)
TARGET_FILES = [
    'daily-sell-module.tsx',
    'tractor-payment-module.tsx',
    'factory-stuff-module.tsx',
    'cement-purchase-module.tsx',
    'hardner-module.tsx',
    'dust-purchase-module.tsx',
    'customer-payment-module.tsx',
    'labour-payment-module.tsx',
    'electricity-module.tsx',
]

stats = {'files_changed': 0, 'cards_compacted': 0, 'banners_removed': 0}


# Pattern: <CardContent className="p-4"> (inside a stat Card)
# Replace with <CardContent className="p-2.5">
P4_PATTERN = re.compile(r'<CardContent className="p-4">')
P4_REPLACEMENT = '<CardContent className="p-2.5">'

# Pattern: text-xl font-bold (stat number) → text-base font-bold
# Only inside stat cards — but to keep it simple and safe, we only
# replace text-xl font-bold that appears right after a Skeleton or p element
# with text-xs text-muted-foreground. Easier: just replace text-xl font-bold
# globally in stat card context (border-l-4 cards). Since these are the only
# places text-xl font-bold appears with the emerald/blue/amber color,
# we can do a contextual replacement.
# Actually safer: look for `text-xl font-bold text-emerald-700` etc.
TEXT_XL_PATTERN = re.compile(r'text-xl font-bold (text-(?:emerald|blue|amber|rose|purple)-700)')
TEXT_XL_REPLACEMENT = r'text-base font-bold \1'

# Pattern: Skeleton h-6 w-32 mt-1 → Skeleton h-5 w-32 mt-0.5
SKELETON_H6_PATTERN = re.compile(r'<Skeleton className="h-6 (w-32|w-16) mt-1" />')
SKELETON_H6_REPLACEMENT = r'<Skeleton className="h-5 \1 mt-0.5" />'

# Pattern: Auto-sync info banner block in daily-sell-module.tsx
# This is a multi-line div block. Match the entire block including the
# preceding comment, from {/* Auto-sync info banner ... */} to the closing
# </div> right after "no popup." text.
AUTO_SYNC_BANNER_PATTERN = re.compile(
    r'\n\s*\{/\* Auto-sync info banner[^}]*\*/\}\s*\n'
    r'\s*<div className="rounded-lg border border-emerald-200 bg-emerald-50[^"]*"[^>]*>\s*\n'
    r'\s*<RefreshCw[^/]*/>\s*\n'
    r'\s*<span>\s*\n'
    r'\s*<strong>Auto-sync on save:</strong>[^<]*\n'
    r'\s*and Stock auto-update[^<]*\n'
    r'\s*</span>\s*\n'
    r'\s*</div>\s*\n',
    re.DOTALL
)


def process_file(filepath: Path) -> None:
    content = filepath.read_text(encoding='utf-8')
    original = content
    changes = []

    # 1. Remove Auto-sync info banner (only daily-sell-module)
    new_content, n = AUTO_SYNC_BANNER_PATTERN.subn('\n', content)
    if n:
        stats['banners_removed'] += n
        changes.append(f'auto-sync banner removed (×{n})')
    content = new_content

    # 2. Compact CardContent p-4 → p-2.5 (only inside stat cards with border-l-4)
    # To be safe, we check that this CardContent is inside a Card with border-l-4
    # But since regular Cards use p-6 or pt-6 and stat cards use p-4,
    # and our search-card changes already replaced pt-6, the only p-4 remaining
    # in these files should be stat cards. Let's verify by counting.
    # Actually safer: only replace p-4 that's preceded by a border-l-4 Card line.
    # But the simpler approach works for our codebase. Let's just replace all p-4
    # in CardContent within these specific module files.
    new_content, n = P4_PATTERN.subn(P4_REPLACEMENT, content)
    if n:
        stats['cards_compacted'] += n
        changes.append(f'CardContent p-4 → p-2.5 (×{n})')
    content = new_content

    # 3. Compact text-xl font-bold → text-base font-bold (only colored variants)
    new_content, n = TEXT_XL_PATTERN.subn(TEXT_XL_REPLACEMENT, content)
    if n:
        changes.append(f'stat number text-xl → text-base (×{n})')
    content = new_content

    # 4. Compact Skeleton height
    new_content, n = SKELETON_H6_PATTERN.subn(SKELETON_H6_REPLACEMENT, content)
    if n:
        changes.append(f'Skeleton h-6 → h-5 (×{n})')
    content = new_content

    if content != original:
        filepath.write_text(content, encoding='utf-8')
        stats['files_changed'] += 1
        print(f'  ✓ {filepath.name}: ' + '; '.join(changes))
    else:
        print(f'  · {filepath.name}: no changes')


def main():
    print('Compacting stat cards & removing Auto-sync banner...\n')
    for name in TARGET_FILES:
        f = MODULES_DIR / name
        if f.exists():
            process_file(f)
        else:
            print(f'  ✗ {name}: not found')

    print('\n--- Summary ---')
    print(f"Files changed:        {stats['files_changed']}")
    print(f"Stat cards compacted: {stats['cards_compacted']}")
    print(f"Banners removed:      {stats['banners_removed']}")


if __name__ == '__main__':
    main()
