#!/usr/bin/env python3
"""Batch-add ExcelImport button + component to all remaining ERP modules."""

import re
from pathlib import Path

MODULES = [
    # (filename, module_key, button_label)
    ('daily-sell-module.tsx',     'dailySell',        'Add Sale'),
    ('customer-payment-module.tsx','customerPayment', 'Add Payment'),
    ('labour-payment-module.tsx',  'labourPayment',   'Add Payment'),
    ('tractor-payment-module.tsx', 'tractorPayment',  'Add Payment'),
    ('dust-purchase-module.tsx',   'dustPurchase',    'Add Purchase'),
    ('cement-purchase-module.tsx', 'cementPurchase',  'Add Purchase'),
    ('hardner-module.tsx',         'hardner',         'Add Entry'),
    ('electricity-module.tsx',     'electricity',     'Add Entry'),
    ('factory-stuff-module.tsx',   'factoryStuff',    'Add Entry'),
]

ERP_DIR = Path('/home/z/my-project/src/components/erp')

def patch_module(filename: str, module_key: str, button_label: str) -> str:
    path = ERP_DIR / filename
    src = path.read_text()
    original = src

    # 1. Add Upload to lucide-react import + add ExcelImport import line
    src = re.sub(
        r"(import \{[^}]+?)\s*\} from 'lucide-react'",
        r"\1, Upload } from 'lucide-react'\nimport ExcelImport from '@/components/erp/excel-import'",
        src,
        count=1,
    )
    # Normalize duplicates
    src = re.sub(r'\bUpload,\s*Upload\b', 'Upload', src)

    # 2. Insert importOpen state before `const openAddDialog`
    state_line = '\n  // Excel import\n  const [importOpen, setImportOpen] = React.useState(false)\n\n'
    if 'const [importOpen, setImportOpen]' not in src:
        src = re.sub(
            r'(\n)(\s+)(const openAddDialog = \(\) =>)',
            r'\1\2// Excel import\n\2const [importOpen, setImportOpen] = React.useState(false)\n\n\2\3',
            src,
            count=1,
        )

    # 3. Replace the "Add XXX" button block with a flex container containing Import + Add buttons
    old_button_pattern = re.compile(
        r'<Button onClick=\{openAddDialog\} className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto"><Plus className="size-4" />'
        + re.escape(button_label)
        + r'</Button>'
    )
    new_button_block = (
        '<div className="flex gap-2 w-full sm:w-auto">\n'
        '          <Button variant="outline" onClick={() => setImportOpen(true)} className="w-full sm:w-auto"><Upload className="size-4 mr-2" />Import Excel</Button>\n'
        '          <Button onClick={openAddDialog} className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto"><Plus className="size-4" />'
        + button_label
        + '</Button>\n'
        '        </div>'
    )
    src = old_button_pattern.sub(new_button_block, src)

    # 4. Add ExcelImport component before the final closing </div> of the return statement.
    excel_import_line = (
        '\n      <ExcelImport module="'
        + module_key
        + '" open={importOpen} onClose={() => setImportOpen(false)} onSuccess={fetchData} />\n'
    )
    closing_pattern = re.compile(
        r'(</AlertDialog>\s*\n)(\s+</div>\s*\n\s*\)\s*\n\s*\})',
        re.MULTILINE,
    )
    if 'ExcelImport module="' + module_key + '"' not in src:
        src = closing_pattern.sub(r'\1' + excel_import_line + r'\2', src)

    if src == original:
        return f'NO CHANGES: {filename}'
    path.write_text(src)
    return f'OK: {filename}'


def main():
    for filename, module_key, button_label in MODULES:
        result = patch_module(filename, module_key, button_label)
        print(result)


if __name__ == '__main__':
    main()
