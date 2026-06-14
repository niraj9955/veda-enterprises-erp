'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Download, Loader2, Sparkles, ArrowRight } from 'lucide-react'
import { api } from '@/lib/api'
import { toast } from '@/hooks/use-toast'

interface ExcelImportProps {
  module: 'customers' | 'production' | 'orders' | 'dispatch' | 'payments' | 'expenses'
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

// Field definitions for each module - includes all possible column name aliases
const moduleTemplates: Record<string, {
  label: string
  fields: { key: string; label: string; required: boolean; aliases: string[] }[]
}> = {
  customers: {
    label: 'Customers',
    fields: [
      { key: 'name', label: 'Customer Name', required: true, aliases: ['name', 'customer name', 'customer_name', 'customername', 'cust name', 'cust_name', 'client name', 'client_name', 'party name', 'party_name', 'नाम'] },
      { key: 'mobile', label: 'Mobile Number', required: true, aliases: ['mobile', 'mobile number', 'mobile_number', 'mobilenumber', 'phone', 'phone number', 'phone_number', 'contact', 'contact no', 'contact_no', 'contact number', 'cell', 'मोबाइल'] },
      { key: 'gstNumber', label: 'GST Number', required: false, aliases: ['gstnumber', 'gst number', 'gst_number', 'gst no', 'gst_no', 'gst', 'gstin', 'जीएसटी'] },
      { key: 'address', label: 'Address', required: false, aliases: ['address', 'addr', 'location', 'पता'] },
      { key: 'creditLimit', label: 'Credit Limit', required: false, aliases: ['creditlimit', 'credit limit', 'credit_limit', 'credit', 'limit', 'क्रेडिट लिमिट'] },
    ],
  },
  production: {
    label: 'Production',
    fields: [
      { key: 'date', label: 'Date', required: true, aliases: ['date', 'production date', 'production_date', 'date of production', 'दिनांक', 'tarikh'] },
      { key: 'brickType', label: 'Brick Type', required: true, aliases: ['bricktype', 'brick type', 'brick_type', 'type', 'brick', 'product type', 'product_type', 'item', 'item name', 'ईंट का प्रकार'] },
      { key: 'quantityProduced', label: 'Quantity Produced', required: true, aliases: ['quantityproduced', 'quantity produced', 'quantity_produced', 'quantity', 'qty', 'qty produced', 'qty_produced', 'produced', 'production qty', 'production_qty', 'output', 'मात्रा'] },
      { key: 'shift', label: 'Shift', required: false, aliases: ['shift', 'shift name', 'shift_name', 'shift time', 'शिफ्ट'] },
      { key: 'remarks', label: 'Remarks', required: false, aliases: ['remarks', 'remark', 'note', 'notes', 'comment', 'comments', 'टिप्पणी'] },
    ],
  },
  orders: {
    label: 'Orders',
    fields: [
      { key: 'customerName', label: 'Customer Name', required: true, aliases: ['customer name', 'customer_name', 'customername', 'cust name', 'cust_name', 'client name', 'client_name', 'party name', 'party_name', 'customer', 'name'] },
      { key: 'brickType', label: 'Brick Type', required: true, aliases: ['bricktype', 'brick type', 'brick_type', 'type', 'brick', 'product type', 'product_type', 'item', 'item name'] },
      { key: 'quantity', label: 'Quantity', required: true, aliases: ['quantity', 'qty', 'amount', 'count', 'order qty', 'order_qty'] },
      { key: 'rate', label: 'Rate', required: true, aliases: ['rate', 'price', 'unit price', 'unit_price', 'per unit', 'per_unit', 'unit rate', 'unit_rate', 'दर'] },
      { key: 'amount', label: 'Amount', required: false, aliases: ['amount', 'total', 'total amount', 'total_amount', 'value', 'bill amount', 'bill_amount'] },
      { key: 'deliveryDate', label: 'Delivery Date', required: false, aliases: ['deliverydate', 'delivery date', 'delivery_date', 'due date', 'due_date', 'expected date', 'expected_date', 'delivery', 'डिलीवरी दिनांक'] },
      { key: 'status', label: 'Status', required: false, aliases: ['status', 'order status', 'order_status', 'state'] },
    ],
  },
  dispatch: {
    label: 'Dispatch',
    fields: [
      { key: 'customerName', label: 'Customer Name', required: true, aliases: ['customer name', 'customer_name', 'customername', 'cust name', 'cust_name', 'client name', 'client_name', 'party name', 'party_name', 'customer', 'name'] },
      { key: 'brickType', label: 'Brick Type', required: false, aliases: ['bricktype', 'brick type', 'brick_type', 'type', 'brick', 'product type', 'product_type', 'item', 'item name'] },
      { key: 'quantity', label: 'Quantity', required: true, aliases: ['quantity', 'qty', 'amount', 'count', 'dispatch qty', 'dispatch_qty'] },
      { key: 'truckNumber', label: 'Truck Number', required: false, aliases: ['trucknumber', 'truck number', 'truck_number', 'truck no', 'truck_no', 'vehicle', 'vehicle number', 'vehicle_number', 'vehicle no', 'vehicle_no', 'ट्रक नंबर'] },
      { key: 'driverName', label: 'Driver Name', required: false, aliases: ['drivername', 'driver name', 'driver_name', 'driver', 'driver name', 'ड्राइवर'] },
      { key: 'date', label: 'Date', required: true, aliases: ['date', 'dispatch date', 'dispatch_date', 'date of dispatch', 'दिनांक'] },
    ],
  },
  payments: {
    label: 'Payments',
    fields: [
      { key: 'customerName', label: 'Customer Name', required: true, aliases: ['customer name', 'customer_name', 'customername', 'cust name', 'cust_name', 'client name', 'client_name', 'party name', 'party_name', 'customer', 'name', 'received from', 'received_from'] },
      { key: 'paymentType', label: 'Payment Type', required: false, aliases: ['paymenttype', 'payment type', 'payment_type', 'mode', 'payment mode', 'payment_mode', 'mode of payment', 'type', 'भुगतान का प्रकार'] },
      { key: 'amount', label: 'Amount', required: true, aliases: ['amount', 'total', 'payment amount', 'payment_amount', 'paid', 'received', 'राशि'] },
      { key: 'date', label: 'Date', required: true, aliases: ['date', 'payment date', 'payment_date', 'date of payment', 'दिनांक'] },
      { key: 'remarks', label: 'Remarks', required: false, aliases: ['remarks', 'remark', 'note', 'notes', 'comment', 'description', 'टिप्पणी'] },
    ],
  },
  expenses: {
    label: 'Expenses',
    fields: [
      { key: 'category', label: 'Category', required: true, aliases: ['category', 'cat', 'type', 'expense type', 'expense_type', 'expense category', 'expense_category', 'head', 'खर्च का प्रकार'] },
      { key: 'amount', label: 'Amount', required: true, aliases: ['amount', 'total', 'expense amount', 'expense_amount', 'cost', 'value', 'राशि'] },
      { key: 'date', label: 'Date', required: true, aliases: ['date', 'expense date', 'expense_date', 'date of expense', 'दिनांक'] },
      { key: 'description', label: 'Description', required: false, aliases: ['description', 'desc', 'details', 'remark', 'remarks', 'note', 'notes', 'विवरण'] },
    ],
  },
}

// Normalize a string for comparison: lowercase, remove special chars, spaces
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\u0900-\u097F]/g, '')
}

// Smart auto-detect mapping between Excel columns and module fields
function autoMapColumns(excelColumns: string[], moduleFields: { key: string; label: string; required: boolean; aliases: string[] }[]): Record<string, string> {
  const mapping: Record<string, string> = {} // excelColumn -> fieldKey
  const normalizedExcel = excelColumns.map((col) => ({ original: col, normalized: normalize(col) }))

  for (const field of moduleFields) {
    let bestMatch = ''
    let bestScore = 0

    for (const excelCol of normalizedExcel) {
      // Check exact match with key
      if (excelCol.normalized === normalize(field.key)) {
        bestMatch = excelCol.original
        bestScore = 100
        break
      }

      // Check aliases
      for (const alias of field.aliases) {
        const normAlias = normalize(alias)
        if (excelCol.normalized === normAlias) {
          if (100 > bestScore) {
            bestMatch = excelCol.original
            bestScore = 100
          }
          break
        }
      }

      if (bestScore >= 100) break

      // Fuzzy match: check if alias is contained in column name or vice versa
      for (const alias of field.aliases) {
        const normAlias = normalize(alias)
        if (normAlias.length > 2 && (excelCol.normalized.includes(normAlias) || normAlias.includes(excelCol.normalized))) {
          const score = Math.min(normAlias.length, excelCol.normalized.length) / Math.max(normAlias.length, excelCol.normalized.length) * 80
          if (score > bestScore) {
            bestMatch = excelCol.original
            bestScore = score
          }
        }
      }
    }

    if (bestMatch && bestScore >= 50) {
      mapping[bestMatch] = field.key
    }
  }

  return mapping
}

// Auto-detect the module from Excel column headers
function autoDetectModule(columns: string[]): string | null {
  const normalized = columns.map(normalize)
  const scores: Record<string, number> = {}

  for (const [moduleKey, template] of Object.entries(moduleTemplates)) {
    scores[moduleKey] = 0
    for (const field of template.fields) {
      for (const alias of field.aliases) {
        if (normalized.some((col) => col === normalize(alias) || (normalize(alias).length > 3 && col.includes(normalize(alias))))) {
          scores[moduleKey] += field.required ? 3 : 1
        }
      }
    }
  }

  const bestModule = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]
  return bestModule && bestModule[1] >= 3 ? bestModule[0] : null
}

// Transform data using mapping, also handle customer name -> ID resolution
function transformRow(
  row: Record<string, unknown>,
  mapping: Record<string, string>,
  customers?: { id: string; name: string }[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [excelCol, fieldKey] of Object.entries(mapping)) {
    let value = row[excelCol]

    // Handle customer name -> ID resolution
    if ((fieldKey === 'customerName') && customers && customers.length > 0) {
      const nameStr = String(value || '').trim().toLowerCase()
      const matched = customers.find((c) => c.name.toLowerCase() === nameStr)
      if (matched) {
        result['customerId'] = matched.id
      } else {
        result['customerId'] = String(value || '') // fallback: keep as-is for error
      }
      continue
    }

    // Handle numeric fields
    if (['quantityProduced', 'quantity', 'creditLimit', 'amount', 'rate'].includes(fieldKey)) {
      const numVal = Number(String(value || '').replace(/[^0-9.-]/g, '') || 0)
      result[fieldKey] = isNaN(numVal) ? 0 : numVal
      continue
    }

    // Handle date fields - try to parse various formats
    if (['date', 'deliveryDate'].includes(fieldKey)) {
      result[fieldKey] = parseDate(String(value || ''))
      continue
    }

    // Handle shift field - normalize
    if (fieldKey === 'shift') {
      const shiftStr = String(value || 'Morning').trim()
      const lower = shiftStr.toLowerCase()
      if (lower.includes('morn') || lower.includes('सुबह') || lower === '1' || lower === 'morning') {
        result[fieldKey] = 'Morning'
      } else if (lower.includes('eve') || lower.includes('शाम') || lower === '2' || lower === 'evening') {
        result[fieldKey] = 'Evening'
      } else if (lower.includes('night') || lower.includes('रात') || lower === '3' || lower === 'night') {
        result[fieldKey] = 'Night'
      } else {
        result[fieldKey] = shiftStr
      }
      continue
    }

    // Handle payment type
    if (fieldKey === 'paymentType') {
      const ptStr = String(value || 'Cash').trim()
      const lower = ptStr.toLowerCase()
      if (lower.includes('cash') || lower.includes('नकद')) result[fieldKey] = 'Cash'
      else if (lower.includes('upi') || lower.includes('online')) result[fieldKey] = 'UPI'
      else if (lower.includes('bank') || lower.includes('transfer') || lower.includes('neft') || lower.includes('rtgs')) result[fieldKey] = 'Bank Transfer'
      else result[fieldKey] = ptStr
      continue
    }

    // Handle expense category
    if (fieldKey === 'category') {
      const catStr = String(value || '').trim()
      const lower = catStr.toLowerCase()
      if (lower.includes('labour') || lower.includes('labor') || lower.includes('मजदूर') || lower.includes('wage')) result[fieldKey] = 'Labour'
      else if (lower.includes('coal') || lower.includes('कोयला')) result[fieldKey] = 'Coal'
      else if (lower.includes('diesel') || lower.includes('डीज़ल') || lower.includes('fuel')) result[fieldKey] = 'Diesel'
      else if (lower.includes('maint') || lower.includes('रखरखाव') || lower.includes('repair')) result[fieldKey] = 'Maintenance'
      else if (lower.includes('elect') || lower.includes('बिजली') || lower.includes('power')) result[fieldKey] = 'Electricity'
      else result[fieldKey] = catStr
      continue
    }

    // Handle status
    if (fieldKey === 'status') {
      const stStr = String(value || 'Pending').trim()
      const lower = stStr.toLowerCase()
      if (lower.includes('pend') || lower.includes('लंबित')) result[fieldKey] = 'Pending'
      else if (lower.includes('process') || lower.includes('चल')) result[fieldKey] = 'Processing'
      else if (lower.includes('deliver') || lower.includes('भेजा') || lower.includes('complete')) result[fieldKey] = 'Delivered'
      else if (lower.includes('cancel') || lower.includes('रद्द')) result[fieldKey] = 'Cancelled'
      else result[fieldKey] = stStr
      continue
    }

    result[fieldKey] = String(value || '')
  }

  // For orders/dispatch: calculate amount if not mapped
  if (mapping) {
    const targetModule = Object.values(mapping)
    if (targetModule.includes('rate') && targetModule.includes('quantity') && !targetModule.includes('amount')) {
      const qty = Number(result.quantity || 0)
      const rate = Number(result.rate || 0)
      result.amount = qty * rate
    }
  }

  return result
}

// Parse various date formats to YYYY-MM-DD
function parseDate(value: string): string {
  if (!value || value.trim() === '') return new Date().toISOString().split('T')[0]

  const trimmed = value.trim()

  // Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed

  // DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  // DD-MM-YY or DD/MM/YY
  const dmyShortMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2})$/)
  if (dmyShortMatch) {
    const [, d, m, y] = dmyShortMatch
    return `20${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  // MM/DD/YYYY (US format) - only if first number > 12
  const mdyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (mdyMatch) {
    const [, m, d, y] = mdyMatch
    if (Number(m) > 12) {
      return `${y}-${d.padStart(2, '0')}-${m.padStart(2, '0')}`
    }
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  // Try native Date parsing as fallback
  try {
    const date = new Date(trimmed)
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0]
    }
  } catch {}

  return trimmed
}

export default function ExcelImport({ module, open, onClose, onSuccess }: ExcelImportProps) {
  const [rawData, setRawData] = useState<Record<string, unknown>[]>([])
  const [transformedData, setTransformedData] = useState<Record<string, unknown>[]>([])
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({})
  const [excelColumns, setExcelColumns] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ imported: number; total: number; errors?: string[] } | null>(null)
  const [fileName, setFileName] = useState('')
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const template = moduleTemplates[module]

  // Fetch customers for name->ID resolution
  useEffect(() => {
    if (open && ['orders', 'dispatch', 'payments'].includes(module)) {
      api.getCustomers().then((data) => {
        setCustomers((data.customers as { id: string; name: string }[]).map((c) => ({ id: c.id, name: c.name })))
      }).catch(() => {})
    }
  }, [open, module])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setResult(null)

    try {
      const XLSX = await import('xlsx')
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer)
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' })

      if (jsonData.length === 0) {
        toast({ title: 'Empty file', description: 'No data found in the uploaded file', variant: 'destructive' })
        return
      }

      const data = jsonData as Record<string, unknown>[]
      const columns = Object.keys(data[0])

      setRawData(data)
      setExcelColumns(columns)

      // Auto-detect column mapping
      const autoMapping = autoMapColumns(columns, template.fields)
      setColumnMapping(autoMapping)

      // Apply transformation immediately
      const transformed = data.map((row) => transformRow(row, autoMapping, customers))
      setTransformedData(transformed)

      const mappedCount = Object.keys(autoMapping).length
      const totalFields = template.fields.length
      toast({
        title: 'File parsed successfully',
        description: `Found ${data.length} rows. Auto-mapped ${mappedCount} of ${totalFields} fields. Review and adjust if needed.`,
      })
    } catch (err) {
      toast({ title: 'Parse error', description: 'Could not read the Excel file. Make sure it is a valid .xlsx or .csv file.', variant: 'destructive' })
    }
  }

  const handleMappingChange = (excelCol: string, fieldKey: string) => {
    const newMapping = { ...columnMapping }

    // Remove old mapping for this excel column
    delete newMapping[excelCol]

    // Remove any existing mapping to the same field key
    for (const [col, fKey] of Object.entries(newMapping)) {
      if (fKey === fieldKey) {
        delete newMapping[col]
      }
    }

    // Set new mapping
    if (fieldKey && fieldKey !== 'skip') {
      newMapping[excelCol] = fieldKey
    }

    setColumnMapping(newMapping)

    // Re-transform data
    const transformed = rawData.map((row) => transformRow(row, newMapping, customers))
    setTransformedData(transformed)
  }

  const handleImport = async () => {
    if (transformedData.length === 0) return
    setImporting(true)
    try {
      const res = await api.importData(module, transformedData)
      setResult({ imported: res.imported, total: res.total, errors: res.errors })
      if (res.imported > 0) {
        toast({ title: 'Import successful', description: `${res.imported} of ${res.total} rows imported` })
        onSuccess()
      }
    } catch (err) {
      toast({ title: 'Import failed', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' })
    } finally {
      setImporting(false)
    }
  }

  const downloadTemplate = () => {
    const headers = template.fields.map((f) => f.label)
    const csvContent = [headers.join(','), ''].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${module}_import_template.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: 'Template downloaded', description: 'Fill in your data and upload the file' })
  }

  const handleClose = () => {
    setRawData([])
    setTransformedData([])
    setColumnMapping({})
    setExcelColumns([])
    setResult(null)
    setFileName('')
    if (fileInputRef.current) fileInputRef.current.value = ''
    onClose()
  }

  const mappedFieldKeys = new Set(Object.values(columnMapping))
  const unmappedRequired = template.fields.filter((f) => f.required && !mappedFieldKeys.has(f.key))

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            Import {template.label} from Excel
          </DialogTitle>
          <DialogDescription>
            Upload an Excel or CSV file. Columns are auto-detected and mapped — review and adjust before importing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-auto">
          {/* Step 1: Download template */}
          <div className="space-y-2">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <span className="w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
              Template & Format
            </h4>
            <div className="flex flex-wrap gap-2">
              {template.fields.map((field) => (
                <Badge key={field.key} variant={field.required ? 'default' : 'outline'} className="text-xs">
                  {field.label} {field.required && '*'}
                </Badge>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Download CSV Template
            </Button>
          </div>

          {/* Step 2: Upload file */}
          <div className="space-y-2">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <span className="w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
              Upload Excel/CSV File
            </h4>
            <div
              className="border-2 border-dashed rounded-lg p-6 text-center hover:border-emerald-400 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {fileName ? fileName : 'Click to upload .xlsx, .xls, or .csv file'}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>
          </div>

          {/* Step 3: Column Mapping */}
          {excelColumns.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <span className="w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
                <Sparkles className="h-4 w-4 text-amber-500" />
                Column Mapping (Auto-detected)
              </h4>

              {unmappedRequired.length > 0 && (
                <Alert variant="destructive" className="py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Required fields not mapped: {unmappedRequired.map((f) => f.label).join(', ')}
                  </AlertDescription>
                </Alert>
              )}

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-1/3">Excel Column</TableHead>
                      <TableHead className="w-10 text-center"></TableHead>
                      <TableHead className="w-1/3">Maps To</TableHead>
                      <TableHead className="w-1/6">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {excelColumns.map((col) => {
                      const mappedField = columnMapping[col]
                      const field = mappedField ? template.fields.find((f) => f.key === mappedField) : null
                      return (
                        <TableRow key={col}>
                          <TableCell className="font-mono text-xs">{col}</TableCell>
                          <TableCell className="text-center"><ArrowRight className="h-4 w-4 text-muted-foreground mx-auto" /></TableCell>
                          <TableCell>
                            <Select
                              value={mappedField || 'skip'}
                              onValueChange={(val) => handleMappingChange(col, val)}
                            >
                              <SelectTrigger className="w-full text-xs">
                                <SelectValue placeholder="Select field..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="skip">-- Skip --</SelectItem>
                                {template.fields.map((f) => (
                                  <SelectItem key={f.key} value={f.key}>
                                    {f.label} {f.required && '*'}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            {field ? (
                              <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800">
                                <CheckCircle2 className="h-3 w-3 mr-1" /> Mapped
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs text-muted-foreground">
                                Skipped
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Step 4: Preview transformed data */}
          {transformedData.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <span className="w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs font-bold">4</span>
                Preview ({transformedData.length} rows)
              </h4>
              <ScrollArea className="max-h-56">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs w-8">#</TableHead>
                        {template.fields
                          .filter((f) => mappedFieldKeys.has(f.key))
                          .map((f) => (
                            <TableHead key={f.key} className="text-xs whitespace-nowrap">{f.label}</TableHead>
                          ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transformedData.slice(0, 10).map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                          {template.fields
                            .filter((f) => mappedFieldKeys.has(f.key))
                            .map((f) => (
                              <TableCell key={f.key} className="text-xs whitespace-nowrap">
                                {String(row[f.key] ?? '')}
                              </TableCell>
                            ))}
                        </TableRow>
                      ))}
                      {transformedData.length > 10 && (
                        <TableRow>
                          <TableCell colSpan={template.fields.filter((f) => mappedFieldKeys.has(f.key)).length + 1} className="text-xs text-center text-muted-foreground">
                            ... and {transformedData.length - 10} more rows
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Import result */}
          {result && (
            <Alert variant={result.errors && result.errors.length > 0 ? 'destructive' : 'default'}>
              <div className="flex items-start gap-2">
                {result.errors && result.errors.length > 0 ? (
                  <AlertCircle className="h-4 w-4 mt-0.5" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mt-0.5" />
                )}
                <AlertDescription>
                  <p className="font-medium">
                    Imported {result.imported} of {result.total} rows successfully
                  </p>
                  {result.errors && result.errors.length > 0 && (
                    <ScrollArea className="max-h-32 mt-2">
                      <ul className="text-xs space-y-1">
                        {result.errors.slice(0, 20).map((err, i) => (
                          <li key={i} className="text-destructive">{err}</li>
                        ))}
                        {result.errors.length > 20 && (
                          <li className="text-muted-foreground">... and {result.errors.length - 20} more errors</li>
                        )}
                      </ul>
                    </ScrollArea>
                  )}
                </AlertDescription>
              </div>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button
            onClick={handleImport}
            disabled={transformedData.length === 0 || importing || unmappedRequired.length > 0}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {importing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Import {transformedData.length} Rows
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
