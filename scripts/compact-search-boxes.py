#!/usr/bin/env python3
"""
Compact search boxes + cards across all ERP modules.

For each module that has a search box, this script:
  1. Reduces the wrapping <CardContent className="pt-6"> → <CardContent className="px-3 py-2">
     (and "pt-6 space-y-3" → "px-3 py-2 space-y-2" for daily-sell which has multiple rows)
  2. Reduces search Input height: className="pl-9" → className="pl-8 h-8 text-sm"
     (only the search Input — not form Inputs inside dialogs)
  3. Tightens Search icon: size-4 left-3 → size-3.5 left-2.5

Targets ONLY search boxes — recognized by the <Search ... /> icon followed
shortly by an <Input ... className="pl-9" />. Form Inputs (IndianRupee icon,
etc.) are left untouched.

Also handles the inline search variants in bill-module and expense-module
where the search lives in a flex row instead of a Card.
"""

import re
import sys
from pathlib import Path

MODULES_DIR = Path('/home/z/my-project/src/components/erp')

# Modules to process (all modules that have a search box)
TARGET_FILES = [
    'stock-module.tsx',
    'production-module.tsx',
    'daily-sell-module.tsx',
    'dispatch-module.tsx',
    'order-module.tsx',
    'payment-module.tsx',
    'expense-module.tsx',
    'customer-payment-module.tsx',
    'labour-payment-module.tsx',
    'tractor-payment-module.tsx',
    'cement-purchase-module.tsx',
    'dust-purchase-module.tsx',
    'hardner-module.tsx',
    'electricity-module.tsx',
    'factory-stuff-module.tsx',
    'bill-module.tsx',
    'customer-module.tsx',
]

# Counters for reporting
stats = {'files_changed': 0, 'pt6_replaced': 0, 'search_input_resized': 0, 'search_icon_tightened': 0, 'inline_search_resized': 0}

# Patterns ----------------------------------------------------------------

# Pattern 1: <CardContent className="pt-6"> (search card padding)
# We replace pt-6 with px-3 py-2 (compact)
PT6_PATTERN = re.compile(r'<CardContent className="pt-6">')
PT6_REPLACEMENT = '<CardContent className="px-3 py-2">'

# Pattern 1b: <CardContent className="pt-6 space-y-3"> (daily-sell has extra rows)
PT6_SPACING_PATTERN = re.compile(r'<CardContent className="pt-6 space-y-3">')
PT6_SPACING_REPLACEMENT = '<CardContent className="px-3 py-2 space-y-2">'

# Pattern 2: Search icon followed by Input with className="pl-9"
# We tighten: size-4 left-3 → size-3.5 left-2.5
# Then pl-9 → pl-8 h-8 text-sm (but ONLY for search Input, not form Input)
SEARCH_ICON_PATTERN = re.compile(
    r'(<Search className="absolute )left-3( top-1/2 -translate-y-1/2 )size-4( text-muted-foreground"\s*/>)'
)
SEARCH_ICON_REPLACEMENT = r'\1left-2.5\2size-3.5\3'

# This is the tricky one — we need to find the Input that follows a Search icon
# and replace its className="pl-9" with className="pl-8 h-8 text-sm".
# IMPORTANT: We can't use [^>]*? here because the onChange handler contains
# an arrow function `(e) =>` whose `>` would break the negated class. So we
# use [\s\S]*? which matches any char (including newlines) non-greedily.
SEARCH_INPUT_PATTERN = re.compile(
    r'(<Search\b[\s\S]*?/>\s*<Input\b[\s\S]*?className=")pl-9(")'
)
SEARCH_INPUT_REPLACEMENT = r'\1pl-8 h-8 text-sm\2'

# Also handle the inline variant where Search and Input are on the same logic
# but the placeholder attr comes before className (e.g. expense-module, bill-module).
# Pattern: <Search ... /><Input ... className="pl-9" />
# Already covered by the regex above if we make it flexible enough.

# Fallback: any Input that has className="pl-9" and is preceded (within 200 chars)
# by a Search icon — already handled above.

# Variant: when className="pl-9" is the only attribute (single-line Input)
# e.g. <Input className="pl-9" ...> — handled by the regex above since it matches
# className="pl-9" inside any <Input ...> that follows a <Search/> tag.


def process_file(filepath: Path) -> None:
    """Apply all replacements to one file."""
    content = filepath.read_text(encoding='utf-8')
    original = content
    file_changes = []

    # 1b. Replace "pt-6 space-y-3" first (more specific)
    new_content, n = PT6_SPACING_PATTERN.subn(PT6_SPACING_REPLACEMENT, content)
    if n:
        stats['pt6_replaced'] += n
        file_changes.append(f'pt-6 space-y-3 → px-3 py-2 space-y-2 (×{n})')
    content = new_content

    # 1. Replace pt-6 → px-3 py-2 (generic search card)
    new_content, n = PT6_PATTERN.subn(PT6_REPLACEMENT, content)
    if n:
        stats['pt6_replaced'] += n
        file_changes.append(f'pt-6 → px-3 py-2 (×{n})')
    content = new_content

    # 2. Tighten Search icon position/size (left-3 size-4 → left-2.5 size-3.5)
    new_content, n = SEARCH_ICON_PATTERN.subn(SEARCH_ICON_REPLACEMENT, content)
    if n:
        stats['search_icon_tightened'] += n
        file_changes.append(f'Search icon tightened (×{n})')
    content = new_content

    # 3. Resize search Input: pl-9 → pl-8 h-8 text-sm (only Inputs right after Search)
    new_content, n = SEARCH_INPUT_PATTERN.subn(SEARCH_INPUT_REPLACEMENT, content)
    if n:
        stats['search_input_resized'] += n
        file_changes.append(f'search Input resized pl-9 → pl-8 h-8 text-sm (×{n})')
    content = new_content

    if content != original:
        filepath.write_text(content, encoding='utf-8')
        stats['files_changed'] += 1
        print(f'  ✓ {filepath.name}: ' + '; '.join(file_changes))
    else:
        print(f'  · {filepath.name}: no changes (no matching search pattern)')


def main():
    print('Compacting search boxes across ERP modules...\n')
    for name in TARGET_FILES:
        f = MODULES_DIR / name
        if not f.exists():
            print(f'  ✗ {name}: file not found, skipping', file=sys.stderr)
            continue
        process_file(f)

    print('\n--- Summary ---')
    print(f"Files changed:              {stats['files_changed']}")
    print(f"Card padding tightened:     {stats['pt6_replaced']}")
    print(f"Search Input height cut:    {stats['search_input_resized']}")
    print(f"Search icon tightened:      {stats['search_icon_tightened']}")


if __name__ == '__main__':
    main()
