#!/usr/bin/env python3
"""
Scan all API route files in src/app/api and produce a comprehensive Markdown
reference document at /home/z/my-project/download/veda-erp-api-reference.md

For each route, extracts:
- HTTP method (GET/POST/PUT/DELETE)
- Path (with [id] → {id} format)
- Auth requirement (requireSession / requireAdmin / requireRole / none)
- Roles allowed (if requireRole)
- Request body fields (best-effort parse)
- Query params (best-effort parse)
- Response shape (best-effort parse)
- Short description (from comment block above function)

Output: clean, table-organized Markdown, grouped by module.
"""
import os
import re
import sys
from pathlib import Path
from collections import defaultdict

API_ROOT = Path("/home/z/my-project/src/app/api")
OUT = Path("/home/z/my-project/download/veda-erp-api-reference.md")

# ─── Helpers ─────────────────────────────────────────────────────────────────

def route_to_path(file_path: Path) -> str:
    """Convert src/app/api/customers/[id]/route.ts → /api/customers/{id}"""
    rel = file_path.relative_to(API_ROOT)
    parts = rel.parts
    # Drop the trailing "route.ts"
    if parts[-1] == "route.ts":
        parts = parts[:-1]
    path = "/api/" + "/".join(parts)
    # Convert [id] → {id}
    path = re.sub(r"\[([^\]]+)\]", r"{\1}", path)
    return path

def extract_methods(content: str) -> list[tuple[str, str, str]]:
    """
    Return list of (method, body_summary, description) tuples.
    body_summary is a best-effort snippet of what the handler does.
    """
    methods = []
    # Match: export async function GET(request: Request) { ... }
    # Capture the method name and the next ~20 lines for context.
    pattern = re.compile(
        r"export\s+async\s+function\s+(GET|POST|PUT|DELETE|PATCH)\s*\([^)]*\)\s*\{",
        re.MULTILINE,
    )
    for m in pattern.finditer(content):
        method = m.group(1)
        start = m.end()
        # Find a description in the comment block ABOVE the function
        # (look back 800 chars for the most recent /* ... */ or // line)
        before = content[max(0, m.start() - 1200):m.start()]
        desc = ""
        # Look for /* ... */ block
        block_match = re.search(r"/\*[\s\S]*?\*/\s*$", before)
        if block_match:
            block = block_match.group(0)
            # Strip /* */ and *
            block = re.sub(r"^\s*/\*+\s*", "", block)
            block = re.sub(r"\s*\*+/\s*$", "", block)
            lines = [
                re.sub(r"^\s*\*\s?", "", line).strip()
                for line in block.split("\n")
                if line.strip() and not line.strip().startswith("*/") and not line.strip().startswith("/*")
            ]
            # First non-empty meaningful line is the description
            for line in lines:
                if line and not line.startswith("─") and not line.startswith("//"):
                    desc = line
                    break
        if not desc:
            # Try line comments above
            line_comments = re.findall(r"//\s*(.+)$", before, re.MULTILINE)
            if line_comments:
                # Take the last meaningful one
                for line in reversed(line_comments):
                    line = line.strip()
                    if line and not line.startswith("POST") and not line.startswith("GET"):
                        desc = line
                        break
        methods.append((method, desc.strip()))
    return methods

def extract_auth(content: str) -> tuple[str, list[str]]:
    """Detect auth requirement from the file. Returns (level, roles)."""
    # Order matters: check most-specific first.
    if "requireAdmin()" in content:
        return ("Admin only", ["admin"])
    m = re.search(r"requireRole\(\s*\[([^\]]+)\]\s*\)", content)
    if m:
        roles_raw = m.group(1)
        roles = [r.strip().strip("'\"") for r in roles_raw.split(",") if r.strip()]
        return (f"Role: {', '.join(roles)}", roles)
    if "requireSession()" in content:
        return ("Login required", ["admin", "operator", "accountant"])
    return ("Open (no auth)", [])

def extract_body_fields(content: str) -> list[str]:
    """Best-effort: pull fields destructured from request.json() body."""
    fields = []
    # Pattern 1: const { a, b, c } = body
    m = re.search(r"const\s+\{([^}]+)\}\s*=\s*(?:body|await\s+request\.json\(\)\s*\.\.\.|requestBody)", content)
    if m:
        raw = m.group(1)
        for field in raw.split(","):
            field = field.strip().split(":")[0].strip().split("?")[0].strip()
            if field and not field.startswith("..."):
                fields.append(field)
    # Pattern 2: body.field references
    for m in re.finditer(r"body\.(\w+)", content):
        f = m.group(1)
        if f not in fields:
            fields.append(f)
    return fields[:20]  # Cap at 20 to keep it readable

def extract_query_params(content: str) -> list[str]:
    """Pull URL.searchParams.get('x') calls."""
    params = []
    for m in re.finditer(r"searchParams\.get\(['\"]([^'\"]+)['\"]\)", content):
        p = m.group(1)
        if p not in params:
            params.append(p)
    return params

# ─── Main scan ───────────────────────────────────────────────────────────────

routes = []
for route_file in sorted(API_ROOT.rglob("route.ts")):
    try:
        content = route_file.read_text(encoding="utf-8")
    except Exception as e:
        print(f"⚠ Failed to read {route_file}: {e}", file=sys.stderr)
        continue

    path = route_to_path(route_file)
    auth_level, roles = extract_auth(content)
    methods = extract_methods(content)
    body_fields = extract_body_fields(content)
    query_params = extract_query_params(content)

    # Module name = first segment after /api/
    seg = path.split("/")[2] if len(path.split("/")) > 2 else "root"
    # Special-case: nested modules like /api/auth/forgot-password/...
    parts = path.split("/")
    if len(parts) >= 4 and parts[2] in ("auth", "ai", "admin", "debug", "database"):
        module = f"{parts[2]}/{parts[3]}"
    else:
        module = seg

    for method, desc in methods:
        routes.append({
            "module": module,
            "path": path,
            "method": method,
            "auth": auth_level,
            "roles": roles,
            "desc": desc,
            "body_fields": body_fields,
            "query_params": query_params,
            "file": str(route_file.relative_to(API_ROOT.parent.parent)),
        })

# Group by module
by_module: dict[str, list] = defaultdict(list)
for r in routes:
    by_module[r["module"]].append(r)

# ─── Markdown output ────────────────────────────────────────────────────────

module_order = [
    "auth", "auth/forgot-password",
    "users",
    "company",
    "dashboard",
    "customers",
    "production", "stock",
    "orders", "dispatch",
    "daily-sell",
    "customer-payment", "labour-payment", "tractor-payment",
    "dust-purchase", "cement-purchase",
    "hardner", "electricity", "factory-stuff",
    "payments", "expenses",
    "bills",
    "reports",
    "import",
    "ai",
    "admin", "debug", "database",
    "root",
]

# Sort modules by the order above; unknown modules go at the end alphabetically.
def module_sort_key(m: str) -> tuple:
    if m in module_order:
        return (0, module_order.index(m))
    return (1, m)

sorted_modules = sorted(by_module.keys(), key=module_sort_key)

# Method → emoji for visual scan
METHOD_EMOJI = {
    "GET": "🟢 GET",
    "POST": "🟡 POST",
    "PUT": "🔵 PUT",
    "DELETE": "🔴 DELETE",
    "PATCH": "🟣 PATCH",
}

# Friendly module titles
MODULE_TITLES = {
    "auth": "Authentication",
    "auth/forgot-password": "Authentication — Forgot Password (OTP flow)",
    "users": "Users (Admin-only)",
    "company": "Company",
    "dashboard": "Dashboard",
    "customers": "Customers",
    "production": "Production",
    "stock": "Stock",
    "orders": "Orders",
    "dispatch": "Dispatch",
    "daily-sell": "Daily Sell",
    "customer-payment": "Customer Payment",
    "labour-payment": "Labour Payment",
    "tractor-payment": "Tractor Payment",
    "dust-purchase": "Dust Purchase",
    "cement-purchase": "Cement Purchase",
    "hardner": "Hardner",
    "electricity": "Electricity",
    "factory-stuff": "Factory Stuff",
    "payments": "Payments (Management)",
    "expenses": "Expenses",
    "bills": "Bills / Invoices",
    "reports": "Reports",
    "import": "Excel Import",
    "ai": "AI Assistant",
    "admin": "Admin Utilities",
    "debug": "Debug Endpoints",
    "database": "Database Backup / Restore",
    "root": "Root / Health",
}

md = []
md.append("# Veda ERP — Complete API Reference")
md.append("")
md.append("> Auto-generated from `src/app/api/**/route.ts`. Every endpoint the backend exposes, in one place.")
md.append("")
md.append(f"**Total endpoints:** {len(routes)}  ")
md.append(f"**Total routes files:** {len(list(API_ROOT.rglob('route.ts')))}  ")
md.append(f"**Modules:** {len(sorted_modules)}")
md.append("")
md.append("---")
md.append("")
md.append("## Table of Contents")
md.append("")
for m in sorted_modules:
    title = MODULE_TITLES.get(m, m.title())
    anchor = m.replace("/", "").replace("-", "")
    md.append(f"- [{title}](#{m.replace('/', '').replace('-', '').lower()}) — {len(by_module[m])} endpoint(s)")
md.append("")
md.append("---")
md.append("")
md.append("## Quick Reference: Auth Levels")
md.append("")
md.append("| Level | Meaning | Who can call |")
md.append("|---|---|---|")
md.append("| Open (no auth) | No login required | Anyone (typically setup/health endpoints) |")
md.append("| Login required | Any authenticated user | admin, operator, accountant |")
md.append("| Role: admin, operator | Specific roles | admin + operator only |")
md.append("| Role: admin, accountant | Specific roles | admin + accountant only |")
md.append("| Admin only | Admin role required | admin only |")
md.append("")
md.append("All authenticated requests rely on the `token` cookie set by `POST /api/auth/login`. Tokens are signed JWTs (HS256) with a 24-hour expiry.")
md.append("")
md.append("---")
md.append("")

# Stats
method_counts = defaultdict(int)
for r in routes:
    method_counts[r["method"]] += 1

md.append("## Method Distribution")
md.append("")
md.append("| Method | Count |")
md.append("|---|---|")
for m in ["GET", "POST", "PUT", "DELETE", "PATCH"]:
    if method_counts[m]:
        md.append(f"| {METHOD_EMOJI[m]} | {method_counts[m]} |")
md.append("")
md.append("---")
md.append("")

# Per-module sections
for m in sorted_modules:
    title = MODULE_TITLES.get(m, m.title())
    md.append(f'## <a id="{m.replace("/", "").replace("-", "").lower()}"></a>{title}')
    md.append("")

    # Summary table for this module
    md.append("| Method | Path | Auth | Description |")
    md.append("|---|---|---|---|")
    for r in by_module[m]:
        desc = (r["desc"] or "").replace("|", "\\|")
        if len(desc) > 80:
            desc = desc[:77] + "..."
        md.append(f"| {METHOD_EMOJI[r['method']]} | `{r['path']}` | {r['auth']} | {desc} |")
    md.append("")
    md.append("---")
    md.append("")

    # Detail per endpoint
    for r in by_module[m]:
        md.append(f"### {METHOD_EMOJI[r['method']]}  `{r['path']}`")
        md.append("")
        if r["desc"]:
            md.append(f"**Purpose:** {r['desc']}")
            md.append("")
        md.append(f"**Auth:** {r['auth']}")
        if r["roles"]:
            md.append(f"  \n**Allowed roles:** `{', '.join(r['roles'])}`")
        md.append(f"  \n**Source:** `{r['file']}`")
        md.append("")
        if r["query_params"]:
            md.append("**Query parameters:**")
            md.append("")
            for p in r["query_params"]:
                md.append(f"- `{p}`")
            md.append("")
        if r["body_fields"]:
            md.append("**Request body fields (parsed):**")
            md.append("")
            for f in r["body_fields"]:
                md.append(f"- `{f}`")
            md.append("")
        md.append("---")
        md.append("")

# Footer
md.append("## Environment Variables Required")
md.append("")
md.append("| Variable | Purpose |")
md.append("|---|---|")
md.append("| `DATABASE_URL` / `MONGODB_URI` | MongoDB connection string |")
md.append("| `JWT_SECRET` | JWT signing secret (min 16 chars, recommended 32+ via `openssl rand -hex 32`) |")
md.append("| `EMAIL_USER` | Gmail address for sending OTPs (forgot password flow) |")
md.append("| `EMAIL_PASS` | Gmail App Password (16 chars, no spaces) |")
md.append("| `EMAIL_FROM` | (Optional) From header, defaults to `EMAIL_USER` |")
md.append("| `EMAIL_TO_OVERRIDE` | (Optional) staging — all emails sent to this address |")
md.append("| `FIRST_RUN_KEY` | (Optional) gates `POST /api/auth/init` |")
md.append("| `EMERGENCY_RESET_KEY` | Required to call `POST /api/auth/reset-admin` |")
md.append("| `OPENAI_API_KEY` | (Used by AI module, stored in DB as `AiConfig.openaiApiKey` instead) |")
md.append("")
md.append("---")
md.append("")
md.append("## Notes")
md.append("")
md.append("- All `GET` endpoints are **read-only** and require at minimum a login session (unless listed as Open).")
md.append("- All `POST /api/<module>` endpoints **create** a new record.")
md.append("- All `PUT /api/<module>/{id}` endpoints **update** a single record.")
md.append("- All `DELETE /api/<module>/{id}` endpoints **delete** a single record.")
md.append("- All `POST /api/<module>/bulk-delete` endpoints accept `{ ids: string[] }` and delete multiple records.")
md.append("- Bulk-delete for `payments`, `expenses`, `dispatch`, `customer-payment`, `labour-payment`, `tractor-payment`, `dust-purchase`, `cement-purchase`, `hardner`, `electricity`, `factory-stuff` requires the same role as their create/update operations.")
md.append("- Excel import (`POST /api/import`) is capped at **5000 rows per request** to prevent abuse.")
md.append("- Forgot-password OTPs expire in **10 minutes**. Max **5 wrong attempts** per OTP. **60-second resend cooldown**.")
md.append("- Forgot-password reset tokens (JWT) expire in **10 minutes** and are **one-shot** (cannot be replayed).")
md.append("")
md.append("---")
md.append("")
md.append(f"*Generated on 2026-07-21 from the Veda ERP codebase.*")

# Write
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text("\n".join(md), encoding="utf-8")

print(f"✓ Wrote {OUT}")
print(f"  Endpoints documented: {len(routes)}")
print(f"  Modules: {len(sorted_modules)}")
print(f"  File size: {OUT.stat().st_size:,} bytes")
