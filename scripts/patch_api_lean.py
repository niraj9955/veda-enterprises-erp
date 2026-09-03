#!/usr/bin/env python3
"""
Add .lean() and Cache-Control headers to all list GET routes for faster queries.
Also adds force-dynamic + revalidate=0 to disable Next.js caching at the route level.
"""
import re
from pathlib import Path

BASE = Path("/home/z/my-project/src/app/api")

ROUTES = [
    "production", "stock", "daily-sell", "customer-payment", "labour-payment",
    "tractor-payment", "dust-purchase", "cement-purchase", "hardner",
    "electricity", "factory-stuff",
    "orders", "dispatch", "payments", "expenses",
]

def patch_route(route_name: str) -> bool:
    fp = BASE / route_name / "route.ts"
    if not fp.exists():
        print(f"  SKIP {route_name} (not found)")
        return False
    
    src = fp.read_text(encoding="utf-8")
    original = src
    
    # 1. Add force-dynamic + revalidate=0 at top (after imports, before GET)
    if "export const dynamic" not in src:
        # Insert before the first `export async function GET`
        m = re.search(r"(export async function GET)", src)
        if m:
            src = src[:m.start()] + "// Force dynamic — never cache list responses\nexport const dynamic = 'force-dynamic'\nexport const revalidate = 0\n\n" + src[m.start():]
    
    # 2. Replace `.find(...).sort(...)` (without .lean()) to add .lean()
    # Pattern: <Model>.find(<args>).sort(<args>) followed by either `.map(` or end-of-line
    # We need to NOT add .lean() if it's already there
    pattern = re.compile(
        r"(\w+\.find\([^)]*\)(?:\.sort\([^)]*\))?)"
        r"(?!\.lean)"
        r"(?=\s*(?:\.map|;|\n))"
    )
    src = pattern.sub(r"\1.lean()", src)
    
    # 3. Add Cache-Control headers to the GET response
    # Find: return NextResponse.json({ ... })
    # Add the headers right before the return statement
    if "Cache-Control" not in src:
        # Find the GET function's return statement
        # Pattern: return NextResponse.json({
        #   <some key>: <value>
        # })
        m = re.search(r"(export async function GET[^\n]*\n[^}]*?return NextResponse\.json\(\{)", src, re.DOTALL)
        if m:
            insert_pos = m.start(1)
            headers_code = (
                "    // Disable all caching so freshly imported rows show up immediately\n"
                "    const res = NextResponse.json({\n"
            )
            # Replace "return NextResponse.json({" with "const res = NextResponse.json({"
            # Then after the closing "})" of json(), add headers + return res
            # This is tricky because we don't know how the json call ends.
            # Simpler: just add res.headers.set calls before the return
            # Actually, let me find the matching closing }) and replace `return NextResponse.json({...})` with `const res = NextResponse.json({...}); res.headers.set(...); return res`
            
            # Use a different approach: find the entire return statement
            return_pat = re.compile(
                r"return NextResponse\.json\(\s*\{([^}]+)\}\s*\)",
                re.DOTALL
            )
            def replacer(m):
                inner = m.group(1)
                return (
                    f"const res = NextResponse.json({{{inner}}})\n"
                    f"    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')\n"
                    f"    res.headers.set('Pragma', 'no-cache')\n"
                    f"    res.headers.set('Expires', '0')\n"
                    f"    return res"
                )
            src = return_pat.sub(replacer, src, count=1)
    
    if src != original:
        fp.write_text(src, encoding="utf-8")
        print(f"  PATCHED {route_name}")
        return True
    else:
        print(f"  NO-CHANGE {route_name}")
        return False

def main():
    print("Patching API routes with .lean() + caching headers...")
    patched = 0
    for r in ROUTES:
        if patch_route(r):
            patched += 1
    print(f"\nDone. Patched {patched}/{len(ROUTES)} routes.")

if __name__ == "__main__":
    main()
