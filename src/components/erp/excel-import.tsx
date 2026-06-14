'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Download, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { toast } from '@/hooks/use-toast'

interface ExcelImportProps {
  module: 'customers' | 'production' | 'orders' | 'dispatch' | 'payments' | 'expenses'
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

const moduleTemplates: Record<string, { label: string; columns: { key: string; label: string; required: boolean }[] }> = {
  customers: {
    label: 'Customers',
    columns: [
      { key: 'name', label: 'Customer Name', required: true },
      { key: 'mobile', label: 'Mobile Number', required: true },
      { key: 'gstNumber', label: 'GST Number', required: false },
      { key: 'address', label: 'Address', required: false },
      { key: 'creditLimit', label: 'Credit Limit', required: false },
    ],
  },
  production: {
    label: 'Production',
    columns: [
      { key: 'date', label: 'Date (YYYY-MM-DD)', required: true },
      { key: 'brickType', label: 'Brick Type', required: true },
      { key: 'quantityProduced', label: 'Quantity Produced', required: true },
      { key: 'shift', label: 'Shift (Morning/Evening/Night)', required: false },
      { key: 'remarks', label: 'Remarks', required: false },
    ],
  },
  orders: {
    label: 'Orders',
    columns: [
      { key: 'customerId', label: 'Customer ID', required: true },
      { key: 'brickType', label: 'Brick Type', required: true },
      { key: 'quantity', label: 'Quantity', required: true },
      { key: 'rate', label: 'Rate', required: true },
      { key: 'amount', label: 'Amount', required: false },
      { key: 'deliveryDate', label: 'Delivery Date (YYYY-MM-DD)', required: false },
      { key: 'status', label: 'Status', required: false },
    ],
  },
  dispatch: {
    label: 'Dispatch',
    columns: [
      { key: 'customerId', label: 'Customer ID', required: true },
      { key: 'brickType', label: 'Brick Type', required: false },
      { key: 'quantity', label: 'Quantity', required: true },
      { key: 'truckNumber', label: 'Truck Number', required: false },
      { key: 'driverName', label: 'Driver Name', required: false },
      { key: 'date', label: 'Date (YYYY-MM-DD)', required: true },
    ],
  },
  payments: {
    label: 'Payments',
    columns: [
      { key: 'customerId', label: 'Customer ID', required: true },
      { key: 'paymentType', label: 'Payment Type (Cash/UPI/Bank Transfer)', required: false },
      { key: 'amount', label: 'Amount', required: true },
      { key: 'date', label: 'Date (YYYY-MM-DD)', required: true },
      { key: 'remarks', label: 'Remarks', required: false },
    ],
  },
  expenses: {
    label: 'Expenses',
    columns: [
      { key: 'category', label: 'Category (Labour/Coal/Diesel/Maintenance/Electricity)', required: true },
      { key: 'amount', label: 'Amount', required: true },
      { key: 'date', label: 'Date (YYYY-MM-DD)', required: true },
      { key: 'description', label: 'Description', required: false },
    ],
  },
}

export default function ExcelImport({ module, open, onClose, onSuccess }: ExcelImportProps) {
  const [parsedData, setParsedData] = useState<Record<string, unknown>[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ imported: number; total: number; errors?: string[] } | null>(null)
  const [fileName, setFileName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const template = moduleTemplates[module]

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

      setParsedData(jsonData as Record<string, unknown>[])
      toast({ title: 'File parsed', description: `Found ${jsonData.length} rows in ${sheetName}` })
    } catch (err) {
      toast({ title: 'Parse error', description: 'Could not read the Excel file. Make sure it is a valid .xlsx or .csv file.', variant: 'destructive' })
    }
  }

  const handleImport = async () => {
    if (parsedData.length === 0) return
    setImporting(true)
    try {
      const res = await api.importData(module, parsedData)
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
    const headers = template.columns.map((c) => c.label)
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
    setParsedData([])
    setResult(null)
    setFileName('')
    if (fileInputRef.current) fileInputRef.current.value = ''
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            Import {template.label} from Excel
          </DialogTitle>
          <DialogDescription>
            Upload an Excel (.xlsx) or CSV file to bulk import {template.label.toLowerCase()} data.
            Column headers in your file should match the field names below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-auto">
          {/* Step 1: Download template */}
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Step 1: Download Template</h4>
            <p className="text-xs text-muted-foreground">
              Download the CSV template, fill in your data, and upload it back.
              Required columns are marked with *.
            </p>
            <div className="flex flex-wrap gap-2">
              {template.columns.map((col) => (
                <Badge key={col.key} variant={col.required ? 'default' : 'outline'} className="text-xs">
                  {col.label} {col.required && '*'}
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
            <h4 className="font-medium text-sm">Step 2: Upload Excel/CSV File</h4>
            <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-emerald-400 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {fileName ? fileName : 'Click to upload .xlsx or .csv file'}
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

          {/* Step 3: Preview data */}
          {parsedData.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Step 3: Preview Data ({parsedData.length} rows)</h4>
              <ScrollArea className="max-h-64">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {Object.keys(parsedData[0]).map((key) => (
                          <TableHead key={key} className="text-xs whitespace-nowrap">{key}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedData.slice(0, 10).map((row, i) => (
                        <TableRow key={i}>
                          {Object.keys(parsedData[0]).map((key) => (
                            <TableCell key={key} className="text-xs whitespace-nowrap">
                              {String(row[key] ?? '')}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                      {parsedData.length > 10 && (
                        <TableRow>
                          <TableCell colSpan={Object.keys(parsedData[0]).length} className="text-xs text-center text-muted-foreground">
                            ... and {parsedData.length - 10} more rows
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
                        {result.errors.map((err, i) => (
                          <li key={i} className="text-destructive">{err}</li>
                        ))}
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
            disabled={parsedData.length === 0 || importing}
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
                Import {parsedData.length} Rows
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
