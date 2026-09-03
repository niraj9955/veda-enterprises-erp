#!/usr/bin/env python3
"""
Patch all unauthenticated module CRUD routes to add session checks.

For each /api/<module>/route.ts and /api/<module>/[id]/route.ts:
  - Add `import { requireSession, requireRole } from '@/lib/auth'` (if missing)
  - Insert `const session = await requireSession(); if (session instanceof NextResponse) return session;`
    at the start of every GET/POST/PUT/DELETE handler that doesn't already have it.

Module role mappings:
  - accountant-restricted (production, stock, orders, dispatch, customers)
      → admin + operator (accountant can't write)
  - finance-only (payments, expenses)
      → admin + accountant (operator can't write)
  - shared (dailySell, customerPayment, labourPayment, tractorPayment, dustPurchase, cementPurchase, hardner, electricity, factoryStuff, bills)
      → admin + operator + accountant (all roles can read/write)

Reads (GET) are allowed for all logged-in users.
Writes (POST/PUT/DELETE) are restricted by the role matrix.

For simplicity we apply requireSession() to GET and requireRole([admin, ...]) to writes.
"""
import re
from pathlib import Path

# Module → allowed write roles (besides admin)
MODULE_WRITE_ROLES = {
    'customers':          ['admin', 'operator'],
    'production':         ['admin', 'operator'],
    'stock':              ['admin', 'operator'],
    'orders':             ['admin', 'operator'],
    'dispatch':           ['admin', 'operator'],
    'payments':           ['admin', 'accountant'],
    'expenses':           ['admin', 'accountant'],
    'customer-payment':   ['admin', 'operator', 'accountant'],
    'labour-payment':     ['admin', 'operator', 'accountant'],
    'tractor-payment':    ['admin', 'operator', 'accountant'],
    'dust-purchase':      ['admin', 'operator', 'accountant'],
    'cement-purchase':    ['admin', 'operator', 'accountant'],
    'hardner':            ['admin', 'operator', 'accountant'],
    'electricity':        ['admin', 'operator', 'accountant'],
    'factory-stuff':      ['admin', 'operator', 'accountant'],
}

API_ROOT = Path('/home/z/my-project/src/app/api')

def patch_file(path: Path, write_roles: list[str]) -> tuple[bool, str]:
    """Patch a single route.ts file. Returns (changed, summary)."""
    src = path.read_text()
    orig = src

    # 1. Add import if missing
    if "requireSession" not in src:
        # Find the last import line and add after it
        import_match = re.search(r"^(import[^\n]+\n)+", src, re.MULTILINE)
        if import_match:
            insert_pos = import_match.end()
            new_import = "import { requireSession, requireRole } from '@/lib/auth'\n"
            src = src[:insert_pos] + new_import + src[insert_pos:]
        else:
            # No imports — prepend
            src = "import { requireSession, requireRole } from '@/lib/auth'\n" + src

    # 2. For each handler, find the try { and insert session check after it
    # Handlers we care about: GET, POST, PUT, DELETE (top-level exports)
    role_list_str = "['" + "', '".join(write_roles) + "']"

    def patch_handler(match):
        http_method = match.group(1)  # GET, POST, PUT, DELETE
        full_sig = match.group(0)
        # Check if already patched
        # Look for requireSession or getSession in the next ~600 chars
        rest_start = match.end()
        window = src[rest_start:rest_start + 800]
        if 'requireSession' in window or 'getSession' in window:
            return full_sig  # already has auth

        # Choose helper
        if http_method == 'GET':
            helper = "requireSession"
            session_line = (
                "    const session = await requireSession()\n"
                "    if (session instanceof NextResponse) return session\n\n"
            )
        else:
            # Write — use requireRole with the module's allowed roles
            helper = "requireRole"
            session_line = (
                f"    const session = await requireRole({role_list_str})\n"
                "    if (session instanceof NextResponse) return session\n\n"
            )

        # Find "try {" after the signature
        try_match = re.search(r'\n  try \{\n', src[match.start():])
        if not try_match:
            return full_sig
        try_abs_pos = match.start() + try_match.end()
        # Insert session line right after "try {"
        nonlocal_src = patch_handler.src_ref
        patch_handler.src_ref = nonlocal_src[:try_abs_pos] + session_line + nonlocal_src[try_abs_pos:]
        return full_sig

    # We need a mutable reference — use a list
    patch_handler.src_ref = src

    # Match: export async function GET(...) ... up to "try {\n"
    pattern = re.compile(
        r'export async function (GET|POST|PUT|DELETE)\s*\([^)]*\)\s*(?:\{[^}]*?)?\{',
        re.MULTILINE
    )

    # Use a simpler approach: find each handler signature line, then find "try {" within 5 lines, then insert
    lines = src.split('\n')
    out_lines = []
    i = 0
    while i < len(lines):
        line = lines[i]
        # Detect "export async function GET(..."
        m = re.match(r'^(export async function (GET|POST|PUT|DELETE)\b.*)$', line)
        if m:
            http_method = m.group(2)
            out_lines.append(line)
            # Scan ahead up to 15 lines for "  try {" (the function body opener)
            inserted = False
            for j in range(i + 1, min(i + 25, len(lines))):
                if re.match(r'^  try \{\s*$', lines[j]):
                    # Check if already patched (next 5 lines)
                    window = '\n'.join(lines[j:min(j+8, len(lines))])
                    if 'requireSession' in window or 'getSession' in window:
                        inserted = True
                        break
                    # Insert session check after the "try {" line
                    if http_method == 'GET':
                        out_lines.append(lines[j])  # "  try {"
                        out_lines.append("    const session = await requireSession()")
                        out_lines.append("    if (session instanceof NextResponse) return session")
                        out_lines.append("")
                    else:
                        out_lines.append(lines[j])  # "  try {"
                        out_lines.append(f"    const session = await requireRole({role_list_str})")
                        out_lines.append("    if (session instanceof NextResponse) return session")
                        out_lines.append("")
                    inserted = True
                    i = j
                    break
                out_lines.append(lines[j])
            if not inserted:
                pass  # no try block found, just leave as-is
            i += 1
            continue
        out_lines.append(line)
        i += 1

    new_src = '\n'.join(out_lines)

    # Also: if the file already has `import { getSession } from '@/lib/auth'`
    # but doesn't use getSession anymore (we replaced it), we keep it — it's harmless.
    # But we should NOT double-add requireSession import — check.
    if "import { requireSession, requireRole } from '@/lib/auth'" not in new_src and "requireSession" in new_src:
        # Add the import after the last import line
        last_import_match = None
        for im in re.finditer(r'^import[^\n]+\n', new_src, re.MULTILINE):
            last_import_match = im
        if last_import_match:
            new_src = (new_src[:last_import_match.end()]
                       + "import { requireSession, requireRole } from '@/lib/auth'\n"
                       + new_src[last_import_match.end():])

    if new_src != orig:
        path.write_text(new_src)
        return True, f"patched {path.relative_to(API_ROOT)}"
    return False, f"unchanged {path.relative_to(API_ROOT)}"


def main():
    changed = 0
    unchanged = 0
    for module, roles in MODULE_WRITE_ROLES.items():
        module_dir = API_ROOT / module
        if not module_dir.exists():
            print(f"  SKIP {module} (dir not found)")
            continue
        for route_path in [module_dir / 'route.ts', module_dir / '[id]' / 'route.ts']:
            if not route_path.exists():
                continue
            ok, msg = patch_file(route_path, roles)
            if ok:
                changed += 1
                print(f"  ✓ {msg}")
            else:
                unchanged += 1
                print(f"  - {msg}")
    print(f"\nDone: {changed} patched, {unchanged} unchanged")


if __name__ == '__main__':
    main()
