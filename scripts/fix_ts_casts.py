#!/usr/bin/env python3
"""Fix `as CompanyInfo` and `as UserItem[]` TS errors by inserting `as unknown as`."""
import re
from pathlib import Path

FILES = [
    '/home/z/my-project/src/app/page.tsx',
    '/home/z/my-project/src/components/erp/admin-panel-module.tsx',
    '/home/z/my-project/src/components/erp/settings-module.tsx',
    '/home/z/my-project/src/components/erp/setup-wizard.tsx',
    '/home/z/my-project/src/components/erp/user-management-module.tsx',
]

# Patterns: `as CompanyInfo`, `as CompanyInfo[]`, `as UserItem[]`, `as User[]`
# Replace with: `as unknown as CompanyInfo`, etc.
PATTERNS = [
    (r'\bas CompanyInfo\b', 'as unknown as CompanyInfo'),
    (r'\bas CompanyInfo\[\]', 'as unknown as CompanyInfo[]'),
    (r'\bas UserItem\b', 'as unknown as UserItem'),
    (r'\bas UserItem\[\]', 'as unknown as UserItem[]'),
    (r'\bas User\b(?!\w)', 'as unknown as User'),
    (r'\bas User\[\]', 'as unknown as User[]'),
]

for fpath in FILES:
    p = Path(fpath)
    if not p.exists():
        continue
    src = p.read_text()
    orig = src
    for pat, rep in PATTERNS:
        src = re.sub(pat, rep, src)
    if src != orig:
        p.write_text(src)
        print(f"  ✓ fixed {p.name}")
    else:
        print(f"  - unchanged {p.name}")
