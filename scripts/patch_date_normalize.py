#!/usr/bin/env python3
"""
Patch all API routes that accept `date` or `deliveryDate` in request bodies
to normalize them via the centralized normalizeDate() before saving to MongoDB.

This ensures manual form submissions, AI Fill, and any direct API call all go
through the same robust date parsing — no more dd-mm-yyyy getting stored as-is
and breaking sorts/filters.

The patch is IDEMPOTENT — safe to run multiple times. It detects whether the
normalizeDate import is already present and skips routes that have already
been patched.
"""
import os
import re
import sys

BASE = '/home/z/my-project/src/app/api'

# Map: route file → list of date field keys used in that file's POST/PUT bodies
ROUTES = {
    'production/route.ts': ['date'],
    'production/[id]/route.ts': ['date'],
    'stock/route.ts': ['date'],
    'stock/[id]/route.ts': ['date'],
    'orders/route.ts': ['deliveryDate'],
    'orders/[id]/route.ts': ['deliveryDate'],
    'dispatch/route.ts': ['date'],
    'dispatch/[id]/route.ts': ['date'],
    'payments/route.ts': ['date'],
    'payments/[id]/route.ts': ['date'],
    'expenses/route.ts': ['date'],
    'expenses/[id]/route.ts': ['date'],
    'daily-sell/route.ts': ['date'],
    'daily-sell/[id]/route.ts': ['date'],
    'customer-payment/route.ts': ['date'],
    'customer-payment/[id]/route.ts': ['date'],
    'labour-payment/route.ts': ['date'],
    'labour-payment/[id]/route.ts': ['date'],
    'tractor-payment/route.ts': ['date'],
    'tractor-payment/[id]/route.ts': ['date'],
    'dust-purchase/route.ts': ['date'],
    'dust-purchase/[id]/route.ts': ['date'],
    'cement-purchase/route.ts': ['date'],
    'cement-purchase/[id]/route.ts': ['date'],
    'hardner/route.ts': ['date'],
    'hardner/[id]/route.ts': ['date'],
    'electricity/route.ts': ['date'],
    'electricity/[id]/route.ts': ['date'],
    'factory-stuff/route.ts': ['date'],
    'factory-stuff/[id]/route.ts': ['date'],
    'bills/route.ts': ['date', 'dueDate'],
    'bills/[id]/route.ts': ['date', 'dueDate'],
}

IMPORT_LINE = "import { normalizeDate } from '@/lib/date-utils'\n"


def patch_file(filepath: str, date_fields: list) -> tuple:
    """Patch a single route file. Returns (status, message)."""
    if not os.path.exists(filepath):
        return ('skip', f'NOT FOUND: {filepath}')

    with open(filepath, 'r') as f:
        content = f.read()

    original = content

    # 1. Add the import if not present
    if IMPORT_LINE not in content:
        # Find the last import line and add ours after it
        lines = content.split('\n')
        last_import_idx = -1
        for i, line in enumerate(lines):
            if line.startswith('import '):
                last_import_idx = i
        if last_import_idx == -1:
            # No imports — put at top
            content = IMPORT_LINE + '\n' + content
        else:
            lines.insert(last_import_idx + 1, IMPORT_LINE.rstrip())
            content = '\n'.join(lines)

    # 2. Insert normalization calls after `const body = await request.json()`
    # We insert JUST BEFORE the existing validation/use of body.date.
    # Pattern: find "const body = await request.json()" line and add normalize
    # calls right after it (only if not already present).
    #
    # We do this in POST and PUT handlers — the function-level detection is
    # implicit: any `await request.json()` call gets the normalization.

    # Find all occurrences of `const body = await request.json()` and
    # add normalization after each (if not already there).
    pattern = re.compile(r'(\s+)(const body = await request\.json\(\))', re.MULTILINE)
    matches = list(pattern.finditer(content))
    if not matches:
        return ('skip', f'no body.json() call: {filepath}')

    # Process matches in reverse order so offsets don't shift
    for m in reversed(matches):
        indent = m.group(1)
        json_line = m.group(2)
        # Build the normalization lines
        norm_lines = [json_line]
        for field in date_fields:
            # Check if this normalization is already present nearby
            # (search 300 chars after the match)
            after = content[m.end():m.end() + 300]
            if f'body.{field} = normalizeDate' in after:
                continue
            norm_lines.append(f'{indent}  // Normalize date to canonical YYYY-MM-DD')
            norm_lines.append(f'{indent}  // (handles dd-mm-yyyy, dd/mm/yyyy, Excel serials, Date objects, etc.)')
            norm_lines.append(f'{indent}  if (body.{field}) body.{field} = normalizeDate(body.{field})')

        replacement = '\n'.join(norm_lines)
        content = content[:m.start()] + indent + replacement + content[m.end():]

    if content == original:
        return ('skip', f'already patched: {filepath}')

    with open(filepath, 'w') as f:
        f.write(content)
    return ('ok', f'patched: {filepath}')


def main():
    ok = 0
    skipped = 0
    for route, fields in ROUTES.items():
        filepath = os.path.join(BASE, route)
        status, msg = patch_file(filepath, fields)
        print(f'  [{status}] {msg}')
        if status == 'ok':
            ok += 1
        else:
            skipped += 1
    print(f'\nSummary: {ok} patched, {skipped} skipped')


if __name__ == '__main__':
    main()
