#!/usr/bin/env python3
"""
Generate missing /api/[module]/[id]/route.ts files for all modules that have
edit/delete buttons in the UI but no actual API endpoint.

Each generated file has:
- GET    /api/[module]/[id]   — fetch single record
- PUT    /api/[module]/[id]   — update record (whitelist of fields)
- DELETE /api/[module]/[id]   — delete record

Reads field definitions from a hardcoded map (kept in sync with src/lib/models.ts).
"""
import os

BASE = '/home/z/my-project/src/app/api'

# Module config: (api_dir, model_name, response_key, fields)
# fields: list of (fieldName, type) where type is 'string' or 'number'
MODULES = [
    # Finance
    ('customer-payment', 'CustomerPayment', 'customerPayment', [
        ('date', 'string'),
        ('name', 'string'),
        ('address', 'string'),
        ('amount', 'number'),
        ('remarks', 'string'),
    ]),
    ('labour-payment', 'LabourPayment', 'labourPayment', [
        ('date', 'string'),
        ('name', 'string'),
        ('address', 'string'),
        ('amount', 'number'),
        ('remarks', 'string'),
    ]),
    ('tractor-payment', 'TractorPayment', 'tractorPayment', [
        ('date', 'string'),
        ('vendorName', 'string'),
        ('quantityTon', 'number'),
        ('rate', 'number'),
        ('totalAmount', 'number'),
        ('paidAmount', 'number'),
        ('remainingAmount', 'number'),
        ('remarks', 'string'),
    ]),
    # Purchases & Expenses
    ('dust-purchase', 'DustPurchase', 'dustPurchase', [
        ('date', 'string'),
        ('vendorName', 'string'),
        ('cementName', 'string'),
        ('quantity', 'number'),
        ('rate', 'number'),
        ('totalAmount', 'number'),
        ('paidAmount', 'number'),
        ('transportationCharge', 'number'),
        ('gst', 'number'),
        ('remarks', 'string'),
    ]),
    ('cement-purchase', 'CementPurchase', 'cementPurchase', [
        ('date', 'string'),
        ('vendorName', 'string'),
        ('itemName', 'string'),
        ('quantity', 'number'),
        ('rate', 'number'),
        ('totalAmount', 'number'),
        ('paidAmount', 'number'),
        ('transportationCharge', 'number'),
        ('gst', 'number'),
        ('remarks', 'string'),
    ]),
    ('hardner', 'Hardner', 'hardner', [
        ('date', 'string'),
        ('amount', 'number'),
    ]),
    ('electricity', 'Electricity', 'electricity', [
        ('date', 'string'),
        ('name', 'string'),
        ('work', 'string'),
        ('amount', 'number'),
        ('remarks', 'string'),
    ]),
    ('factory-stuff', 'FactoryStuff', 'factoryStuff', [
        ('date', 'string'),
        ('itemName', 'string'),
        ('quantity', 'number'),
        ('amount', 'number'),
        ('remarks', 'string'),
    ]),
]

TEMPLATE = '''import {{ NextResponse }} from 'next/server'
import {{ connectDB, toObject }} from '@/lib/db'
import {{ {model} }} from '@/lib/models'

// Force dynamic — never cache individual responses
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Whitelist of updatable fields. Must match {model}Schema in src/lib/models.ts.
const FIELDS = {fields_array}

// GET /api/{dir}/[id] — fetch a single {dir} entry
export async function GET(
  _request: Request,
  {{ params }}: {{ params: Promise<{{ id: string }}> }}
) {{
  try {{
    await connectDB()
    const {{ id }} = await params
    const record = await {model}.findById(id).lean()
    if (!record) {{
      return NextResponse.json({{ error: '{resp_key} entry not found' }}, {{ status: 404 }})
    }}
    return NextResponse.json({{ {resp_key}: toObject(record) }})
  }} catch (error) {{
    console.error('Error fetching {dir} entry:', error)
    return NextResponse.json({{ error: 'Failed to fetch {dir} entry' }}, {{ status: 500 }})
  }}
}}

// PUT /api/{dir}/[id] — update a single {dir} entry
export async function PUT(
  request: Request,
  {{ params }}: {{ params: Promise<{{ id: string }}> }}
) {{
  try {{
    await connectDB()
    const {{ id }} = await params
    const body = await request.json()

    const updateData: Record<string, unknown> = {{}}
    for (const field of FIELDS) {{
      if (body[field] !== undefined) {{
        updateData[field] = body[field]
      }}
    }}

    const record = await {model}.findByIdAndUpdate(id, updateData, {{ new: true }})
    if (!record) {{
      return NextResponse.json({{ error: '{resp_key} entry not found' }}, {{ status: 404 }})
    }}

    return NextResponse.json({{ {resp_key}: toObject(record) }})
  }} catch (error) {{
    console.error('Error updating {dir} entry:', error)
    return NextResponse.json({{ error: 'Failed to update {dir} entry' }}, {{ status: 500 }})
  }}
}}

// DELETE /api/{dir}/[id] — delete a single {dir} entry
export async function DELETE(
  _request: Request,
  {{ params }}: {{ params: Promise<{{ id: string }}> }}
) {{
  try {{
    await connectDB()
    const {{ id }} = await params

    const record = await {model}.findByIdAndDelete(id)
    if (!record) {{
      return NextResponse.json({{ error: '{resp_key} entry not found' }}, {{ status: 404 }})
    }}

    return NextResponse.json({{ message: '{resp_key} entry deleted successfully' }})
  }} catch (error) {{
    console.error('Error deleting {dir} entry:', error)
    return NextResponse.json({{ error: 'Failed to delete {dir} entry' }}, {{ status: 500 }})
  }}
}}
'''

for module_dir, model, resp_key, fields in MODULES:
    target_dir = os.path.join(BASE, module_dir, '[id]')
    os.makedirs(target_dir, exist_ok=True)
    target_file = os.path.join(target_dir, 'route.ts')

    fields_array_str = '[\n' + ''.join(f"  '{f}',\n" for f, _ in fields) + '] as const'

    content = TEMPLATE.format(
        model=model,
        dir=module_dir,
        resp_key=resp_key,
        fields_array=fields_array_str,
    )

    with open(target_file, 'w') as f:
        f.write(content)
    print(f'Created: {target_file}')

print('Done!')
