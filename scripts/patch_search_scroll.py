#!/usr/bin/env python3
"""
Patch all ERP module components with:
1. Search bar (debounced, client-side filter across visible text fields)
2. Scrollable table container (max-h-[60vh] overflow-auto + sticky header)
3. Result count badge that reflects filtered count

Usage:
    python3 /home/z/my-project/scripts/patch_search_scroll.py
"""

import re
import os
from pathlib import Path

BASE = Path("/home/z/my-project/src/components/erp")

# Module-specific configuration:
# - file: path to module file
# - items_var: the state variable that holds the list (e.g., 'productions', 'dailySells')
# - fetch_fn: name of fetch function (for adding 'refresh list' message)
# - search_fields: list of string fields on the item to search across
MODULES = [
    {
        "file": "production-module.tsx",
        "items_var": "productions",
        "search_fields": ["date", "customerName", "address", "remarks"],
    },
    {
        "file": "stock-module.tsx",
        "items_var": "stocks",
        "search_fields": ["date"],
    },
    {
        "file": "daily-sell-module.tsx",
        "items_var": "dailySells",
        "search_fields": ["date", "customerName", "address", "contactNumber", "remarks"],
    },
    {
        "file": "customer-payment-module.tsx",
        "items_var": "items",
        "search_fields": ["date", "name", "address", "remarks"],
    },
    {
        "file": "labour-payment-module.tsx",
        "items_var": "items",
        "search_fields": ["date", "name", "address", "remarks"],
    },
    {
        "file": "tractor-payment-module.tsx",
        "items_var": "items",
        "search_fields": ["date", "vendorName", "remarks"],
    },
    {
        "file": "dust-purchase-module.tsx",
        "items_var": "items",
        "search_fields": ["date", "vendorName", "cementName", "remarks"],
    },
    {
        "file": "cement-purchase-module.tsx",
        "items_var": "items",
        "search_fields": ["date", "vendorName", "itemName", "remarks"],
    },
    {
        "file": "hardner-module.tsx",
        "items_var": "items",
        "search_fields": ["date"],
    },
    {
        "file": "electricity-module.tsx",
        "items_var": "items",
        "search_fields": ["date", "name", "work", "remarks"],
    },
    {
        "file": "factory-stuff-module.tsx",
        "items_var": "items",
        "search_fields": ["date", "itemName", "remarks"],
    },
    {
        "file": "order-module.tsx",
        "items_var": "orders",
        "search_fields": ["orderNumber", "brickType", "status", "deliveryDate"],
    },
    {
        "file": "dispatch-module.tsx",
        "items_var": "dispatches",
        "search_fields": ["dispatchNumber", "truckNumber", "driverName", "brickType", "date"],
    },
    {
        "file": "payment-module.tsx",
        "items_var": "payments",
        "search_fields": ["date", "paymentType", "remarks"],
    },
    {
        "file": "expense-module.tsx",
        "items_var": "expenses",
        "search_fields": ["date", "category", "description"],
    },
    {
        "file": "bill-module.tsx",
        "items_var": "bills",
        "search_fields": ["billNumber", "billType", "toName", "toAddress", "toPhone", "date", "status"],
    },
]


def patch_module(mod):
    """Patch a single module file."""
    fp = BASE / mod["file"]
    if not fp.exists():
        print(f"  SKIP {mod['file']} (not found)")
        return False

    src = fp.read_text(encoding="utf-8")
    original = src
    items_var = mod["items_var"]
    fields = mod["search_fields"]

    # 1. Add Search icon to lucide-react imports if not already present
    # Find the lucide-react import line(s)
    lucide_match = re.search(r"from 'lucide-react'", src)
    if lucide_match and "Search" not in src[:lucide_match.start()].rsplit("import", 1)[-1]:
        # Find the last lucide-react import block
        lucide_imports = list(re.finditer(r"import \{([^}]+)\} from 'lucide-react'", src))
        if lucide_imports:
            last = lucide_imports[-1]
            old_import = last.group(0)
            # Add Search to the import list
            new_import = old_import.replace("}", ", Search}")
            src = src.replace(old_import, new_import, 1)

    # 2. Add search state right after the items state declaration
    # Pattern: const [items_var, setItems_var] = React.useState<...>([])
    items_state_pattern = rf"(const \[{items_var},\s*set[A-Z]\w+\]\s*=\s*React\.useState<[^>]*>\(\[\]\))"
    if not re.search(items_state_pattern, src):
        # Fallback: just look for the items state declaration
        items_state_pattern = rf"(const \[{items_var},\s*set\w+\]\s*=\s*React\.useState[^;]+;)"
    
    if re.search(items_state_pattern, src):
        if "const [search, setSearch] = React.useState('')" not in src:
            search_state = (
                f"\n  const [search, setSearch] = React.useState('')\n"
                f"  const [debouncedSearch, setDebouncedSearch] = React.useState('')"
            )
            src = re.sub(items_state_pattern, r"\1" + search_state, src, count=1)

    # 3. Add debounce useEffect after the items state declaration (find the next useEffect after items state)
    debounce_code = f"""
  // Debounced search
  React.useEffect(() => {{
    const t = setTimeout(() => setDebouncedSearch(search), 250)
    return () => clearTimeout(t)
  }}, [search])

  // Client-side filter
  const filtered{items_var[0].upper() + items_var[1:]} = React.useMemo(() => {{
    if (!debouncedSearch.trim()) return {items_var}
    const q = debouncedSearch.toLowerCase()
    return {items_var}.filter((item: any) =>
      {repr(fields)}.some((f) =>
        String((item as any)[f] ?? '').toLowerCase().includes(q)
      )
    )
  }}, [{items_var}, debouncedSearch])
"""

    # Insert debounce code BEFORE the original useEffect that calls the fetch fn
    # Find: React.useEffect(() => { fetchX() }, [fetchX])
    # We need to add it before that. Find the first React.useEffect that has fetch
    # Actually, simpler: add it just before the original useEffect
    # Use a generic match — find first `React.useEffect(` AFTER the items state we just patched
    # and insert before it.
    if "filtered" + items_var[0].upper() + items_var[1:] not in src:
        # Find the first React.useEffect after `const [search, setSearch]` was added
        idx = src.find("const [search, setSearch]")
        if idx >= 0:
            use_eff_idx = src.find("React.useEffect(", idx)
            if use_eff_idx >= 0:
                src = src[:use_eff_idx] + debounce_code.strip() + "\n\n  " + src[use_eff_idx:]

    # 4. Insert a search Card UI right before the main table Card
    # Find the FIRST <Card> that comes after the header div ends (</div> after the buttons)
    # Heuristic: find `<Card>\n        <CardHeader>` pattern (the main data card)
    search_card = """      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder=\"Search across all fields (date, name, remarks, etc.)...\"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

"""
    # Find the main Card (first occurrence of <Card> after the header)
    # Skip already-inserted search cards by checking the marker
    if "Search across all fields" not in src:
        # Find the FIRST <Card> that has <CardHeader> in it (this is the table card)
        m = re.search(r"\n      \{/\* Table \*/\}\n      <Card>", src)
        if m:
            insert_pos = m.start()
            src = src[:insert_pos] + "\n      " + search_card.strip() + "\n" + src[insert_pos:]
        else:
            # Try generic match
            m2 = re.search(r"\n      <Card>\s*\n        <CardHeader>", src)
            if m2:
                insert_pos = m2.start()
                src = src[:insert_pos] + "\n      " + search_card.strip() + "\n" + src[insert_pos:]

    # 5. Replace `overflow-x-auto` wrapper with `max-h-[60vh] overflow-auto` for scroll
    # AND make TableHeader sticky
    src = src.replace(
        '<div className="overflow-x-auto">',
        '<div className="max-h-[60vh] overflow-auto rounded-md border">'
    )
    # Add sticky header — match <TableHeader> without sticky
    src = re.sub(
        r"<TableHeader>\s*\n(\s*)<TableRow>",
        r'<TableHeader className="sticky top-0 bg-background z-10">\n\1<TableRow>',
        src
    )

    # 6. Replace references to the list in the render — use filtered version
    # Specifically:
    # - {items_var.length === 0 ? ( ... ) : ( items_var.map(
    # - {items_var.map(
    # - {items_var.length} record
    # Replace `items_var.map(` with `filtered{Items}.map(`
    filtered_name = "filtered" + items_var[0].upper() + items_var[1:]

    # Find the table body section — between `<TableBody>` and `</TableBody>`
    # Within that section, replace:
    #   {items_var}.length === 0  →  {filtered_name}.length === 0
    #   {items_var}.map(          →  {filtered_name}.map(
    #   {items_var}.length        →  {filtered_name}.length  (only for empty-state checks)
    # Outside the table body, keep using {items_var}.length for the badge total.
    
    # Find all <TableBody> ... </TableBody> blocks
    body_pattern = re.compile(r"(<TableBody>)(.*?)(</TableBody>)", re.DOTALL)
    def patch_body(m):
        body_content = m.group(2)
        # Replace items_var references inside table body
        body_content = body_content.replace(items_var + ".length === 0", filtered_name + ".length === 0")
        body_content = body_content.replace(items_var + ".map(", filtered_name + ".map(")
        # Also handle ternary-style: `? items_var.length === 0`
        return m.group(1) + body_content + m.group(3)
    src = body_pattern.sub(patch_body, src)

    # Replace badge count text to show "filtered of total"
    # Pattern: `{items_var.length} record` — note in JSX this is `{productions.length} record`
    badge_old_1 = "{" + items_var + ".length} record"
    badge_new_1 = "{" + filtered_name + ".length} of {" + items_var + ".length} record"
    src = src.replace(badge_old_1, badge_new_1)

    # Handle "N records" pluralization patterns too
    # e.g., `{orders.length} order{orders.length !== 1 ? 's' : ''}`
    badge_old_2 = "{" + items_var + ".length} " + items_var[:-1]  # e.g., "{orders.length} order"
    badge_new_2 = "{" + filtered_name + ".length} of {" + items_var + ".length} " + items_var[:-1]
    src = src.replace(badge_old_2, badge_new_2)

    # Generic catch: if badge is just `{items_var.length} <word>` and not yet replaced
    # Pattern: `{<items_var>.length} <singular_word>` where word ends with letter
    badge_pattern = re.compile(r"\{" + items_var + r"\.length\}\s+(\w+)")
    def badge_replacer(m):
        word = m.group(1)
        return "{" + filtered_name + ".length} of {" + items_var + ".length} " + word
    src = badge_pattern.sub(badge_replacer, src, count=2)  # max 2 replacements to avoid going crazy

    # 7. If the file has the new "Showing X of Y" pattern (e.g., customer module), don't double-apply
    # Already handled by the strict replace above

    if src != original:
        fp.write_text(src, encoding="utf-8")
        print(f"  PATCHED {mod['file']}")
        return True
    else:
        print(f"  NO-CHANGE {mod['file']}")
        return False


def main():
    print("Patching ERP modules with search + scroll...")
    patched = 0
    for mod in MODULES:
        if patch_module(mod):
            patched += 1
    print(f"\nDone. Patched {patched}/{len(MODULES)} modules.")


if __name__ == "__main__":
    main()
