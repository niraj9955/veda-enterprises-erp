#!/usr/bin/env python3
"""Clean up the indentation of the normalize-date patch — handle extra blank lines."""
import os
import re

BASE = '/home/z/my-project/src/app/api'
ROUTES = [
    'production/route.ts', 'production/[id]/route.ts',
    'stock/route.ts', 'stock/[id]/route.ts',
    'orders/route.ts', 'orders/[id]/route.ts',
    'dispatch/route.ts', 'dispatch/[id]/route.ts',
    'payments/route.ts', 'payments/[id]/route.ts',
    'expenses/route.ts', 'expenses/[id]/route.ts',
    'daily-sell/route.ts', 'daily-sell/[id]/route.ts',
    'customer-payment/route.ts', 'customer-payment/[id]/route.ts',
    'labour-payment/route.ts', 'labour-payment/[id]/route.ts',
    'tractor-payment/route.ts', 'tractor-payment/[id]/route.ts',
    'dust-purchase/route.ts', 'dust-purchase/[id]/route.ts',
    'cement-purchase/route.ts', 'cement-purchase/[id]/route.ts',
    'hardner/route.ts', 'hardner/[id]/route.ts',
    'electricity/route.ts', 'electricity/[id]/route.ts',
    'factory-stuff/route.ts', 'factory-stuff/[id]/route.ts',
    'bills/route.ts', 'bills/[id]/route.ts',
]

# Pattern matches: const body = await request.json()  + a "Normalize date" block
# (with arbitrary whitespace/blank lines between). Captures indent + field name.
# Non-greedy so we don't span across multiple blocks.
PATTERN = re.compile(
    r'(?P<indent>[ \t]*)const body = await request\.json\(\)\n'
    r'(?:[ \t]*\n)*'  # any blank lines
    r'[ \t]*// Normalize date to canonical YYYY-MM-DD\n'
    r'(?:[ \t]*\n)*'
    r'[ \t]*// \(handles dd-mm-yyyy, dd/mm/yyyy, Excel serials, Date objects, etc\.\)\n'
    r'(?:[ \t]*\n)*'
    r'[ \t]*if \(body\.(?P<field>[a-zA-Z]+)\) body\.\2 = normalizeDate\(body\.\2\)\n',
    re.MULTILINE
)

# Second pattern: standalone "Normalize date" block (no const body before it)
# — used to clean up SECOND date field normalization (e.g. dueDate in bills).
PATTERN2 = re.compile(
    r'(?P<indent>[ \t]*)// Normalize date to canonical YYYY-MM-DD\n'
    r'(?:[ \t]*\n)*'
    r'[ \t]*// \(handles dd-mm-yyyy, dd/mm/yyyy, Excel serials, Date objects, etc\.\)\n'
    r'(?:[ \t]*\n)*'
    r'[ \t]*if \(body\.(?P<field>[a-zA-Z]+)\) body\.\2 = normalizeDate\(body\.\2\)\n',
    re.MULTILINE
)

count = 0
for route in ROUTES:
    fp = os.path.join(BASE, route)
    if not os.path.exists(fp):
        continue
    with open(fp) as f:
        content = f.read()
    original = content

    def fix(m):
        indent = m.group('indent')
        field = m.group('field')
        return (
            f'{indent}const body = await request.json()\n'
            f'{indent}// Normalize date to canonical YYYY-MM-DD\n'
            f'{indent}// (handles dd-mm-yyyy, dd/mm/yyyy, Excel serials, Date objects, etc.)\n'
            f'{indent}if (body.{field}) body.{field} = normalizeDate(body.{field})\n'
        )

    def fix2(m):
        indent = m.group('indent')
        field = m.group('field')
        return (
            f'{indent}// Normalize date to canonical YYYY-MM-DD\n'
            f'{indent}// (handles dd-mm-yyyy, dd/mm/yyyy, Excel serials, Date objects, etc.)\n'
            f'{indent}if (body.{field}) body.{field} = normalizeDate(body.{field})\n'
        )

    content = PATTERN.sub(fix, content)
    content = PATTERN2.sub(fix2, content)

    if content != original:
        with open(fp, 'w') as f:
            f.write(content)
        count += 1
        print(f'  cleaned: {fp}')

print(f'\n{count} files cleaned')
