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
  module:
    | 'customers'
    | 'production'
    | 'stock'
    | 'dailySell'
    | 'customerPayment'
    | 'labourPayment'
    | 'tractorPayment'
    | 'dustPurchase'
    | 'cementPurchase'
    | 'hardner'
    | 'electricity'
    | 'factoryStuff'
    | 'orders'
    | 'dispatch'
    | 'payments'
    | 'expenses'
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
      { key: 'cement', label: 'Cement', required: false, aliases: ['cement', 'cement bags', 'सीमेंट'] },
      { key: 'zigZagWhite80', label: 'Zig Zag White 80', required: false, aliases: ['zigzagwhite80', 'zig zag white 80', 'zig_zag_white_80', 'zz white 80', 'white 80'] },
      { key: 'zigZagRed80', label: 'Zig Zag Red 80', required: false, aliases: ['zigzagred80', 'zig zag red 80', 'zig_zag_red_80', 'zz red 80', 'red 80'] },
      { key: 'zigZagYellow80', label: 'Zig Zag Yellow 80', required: false, aliases: ['zigzagyellow80', 'zig zag yellow 80', 'zig_zag_yellow_80', 'zz yellow 80', 'yellow 80'] },
      { key: 'zigZagWhite60', label: 'Zig Zag White 60', required: false, aliases: ['zigzagwhite60', 'zig zag white 60', 'zig_zag_white_60', 'zz white 60', 'white 60'] },
      { key: 'zigZagRed60', label: 'Zig Zag Red 60', required: false, aliases: ['zigzagred60', 'zig zag red 60', 'zig_zag_red_60', 'zz red 60', 'red 60'] },
      { key: 'zigZagYellow60', label: 'Zig Zag Yellow 60', required: false, aliases: ['zigzagyellow60', 'zig zag yellow 60', 'zig_zag_yellow_60', 'zz yellow 60', 'yellow 60'] },
      { key: 'curveStone', label: 'Curve Stone', required: false, aliases: ['curvestone', 'curve stone', 'curve_stone', 'curve'] },
      { key: 'chequreTile', label: 'Chequre Tile', required: false, aliases: ['chequretile', 'chequre tile', 'chequre_tile', 'chequre', 'tile'] },
      { key: 'transportationCharge', label: 'Transportation Charge', required: false, aliases: ['transportationcharge', 'transportation charge', 'transportation_charge', 'transport', 'transport charge'] },
      { key: 'remarks', label: 'Remarks', required: false, aliases: ['remarks', 'remark', 'note', 'notes', 'comment', 'comments', 'टिप्पणी'] },
    ],
  },
  stock: {
    label: 'Stock',
    fields: [
      { key: 'date', label: 'Date', required: true, aliases: ['date', 'stock date', 'दिनांक'] },
      { key: 'cement', label: 'Cement', required: false, aliases: ['cement', 'cement bags'] },
      { key: 'zigZagGrey80', label: 'Zig Zag Grey 80', required: false, aliases: ['zigzaggrey80', 'zig zag grey 80', 'grey 80'] },
      { key: 'zigZagRed80', label: 'Zig Zag Red 80', required: false, aliases: ['zigzagred80', 'zig zag red 80', 'red 80'] },
      { key: 'zigZagYellow80', label: 'Zig Zag Yellow 80', required: false, aliases: ['zigzagyellow80', 'zig zag yellow 80', 'yellow 80'] },
      { key: 'zigZagGrey60', label: 'Zig Zag Grey 60', required: false, aliases: ['zigzaggrey60', 'zig zag grey 60', 'grey 60'] },
      { key: 'zigZagRed60', label: 'Zig Zag Red 60', required: false, aliases: ['zigzagred60', 'zig zag red 60', 'red 60'] },
      { key: 'zigZagYellow60', label: 'Zig Zag Yellow 60', required: false, aliases: ['zigzagyellow60', 'zig zag yellow 60', 'yellow 60'] },
      { key: 'chequreTile', label: 'Chequre Tile', required: false, aliases: ['chequretile', 'chequre tile', 'chequre'] },
      { key: 'curveStone', label: 'Curve Stone', required: false, aliases: ['curvestone', 'curve stone', 'curve'] },
      { key: 'dumbleGrey80', label: 'Dumble Grey 80', required: false, aliases: ['dumblegrey80', 'dumble grey 80'] },
      { key: 'dumbleRed80', label: 'Dumble Red 80', required: false, aliases: ['dumblered80', 'dumble red 80'] },
      { key: 'dumbleYellow80', label: 'Dumble Yellow 80', required: false, aliases: ['dumbleyellow80', 'dumble yellow 80'] },
    ],
  },
  dailySell: {
    label: 'Daily Sell',
    fields: [
      { key: 'date', label: 'Date', required: true, aliases: ['date', 'sell date', 'दिनांक'] },
      { key: 'customerName', label: 'Customer Name', required: true, aliases: ['customer name', 'customer_name', 'customer', 'party', 'name'] },
      { key: 'address', label: 'Address', required: false, aliases: ['address', 'addr', 'location'] },
      { key: 'amount', label: 'Amount', required: true, aliases: ['amount', 'total', 'sell amount', 'राशि'] },
      { key: 'contactNumber', label: 'Contact Number', required: false, aliases: ['contact', 'mobile', 'phone', 'contact number', 'contact_no'] },
      { key: 'remarks', label: 'Remarks', required: false, aliases: ['remarks', 'remark', 'note'] },
    ],
  },
  customerPayment: {
    label: 'Customer Payment',
    fields: [
      { key: 'date', label: 'Date', required: true, aliases: ['date', 'payment date', 'दिनांक'] },
      { key: 'name', label: 'Customer Name', required: true, aliases: ['name', 'customer name', 'customer_name', 'customer', 'party'] },
      { key: 'address', label: 'Address', required: false, aliases: ['address', 'addr'] },
      { key: 'amount', label: 'Amount', required: true, aliases: ['amount', 'total', 'paid', 'राशि'] },
      { key: 'remarks', label: 'Remarks', required: false, aliases: ['remarks', 'remark', 'note'] },
    ],
  },
  labourPayment: {
    label: 'Labour Payment',
    fields: [
      { key: 'date', label: 'Date', required: true, aliases: ['date', 'payment date', 'दिनांक'] },
      { key: 'name', label: 'Labour Name', required: true, aliases: ['name', 'labour name', 'labour_name', 'labour', 'worker name', 'worker'] },
      { key: 'address', label: 'Address', required: false, aliases: ['address', 'addr'] },
      { key: 'amount', label: 'Amount', required: true, aliases: ['amount', 'total', 'paid', 'wage', 'राशि'] },
      { key: 'remarks', label: 'Remarks', required: false, aliases: ['remarks', 'remark', 'note'] },
    ],
  },
  tractorPayment: {
    label: 'Tractor Payment',
    fields: [
      { key: 'date', label: 'Date', required: true, aliases: ['date', 'payment date', 'दिनांक'] },
      { key: 'vendorName', label: 'Vendor Name', required: true, aliases: ['vendor', 'vendor name', 'vendor_name', 'tractor', 'tractor name', 'party'] },
      { key: 'quantityTon', label: 'Quantity (Ton)', required: true, aliases: ['quantity', 'qty', 'quantity ton', 'quantity_ton', 'ton', 'tons'] },
      { key: 'rate', label: 'Rate', required: true, aliases: ['rate', 'price', 'per ton', 'rate per ton'] },
      { key: 'totalAmount', label: 'Total Amount', required: false, aliases: ['total', 'total amount', 'total_amount', 'amount'] },
      { key: 'paidAmount', label: 'Paid Amount', required: false, aliases: ['paid', 'paid amount', 'paid_amount'] },
      { key: 'remainingAmount', label: 'Remaining Amount', required: false, aliases: ['remaining', 'remaining amount', 'remaining_amount', 'balance'] },
      { key: 'remarks', label: 'Remarks', required: false, aliases: ['remarks', 'remark', 'note'] },
    ],
  },
  dustPurchase: {
    label: 'Dust Purchase',
    fields: [
      { key: 'date', label: 'Date', required: true, aliases: ['date', 'purchase date', 'दिनांक'] },
      { key: 'vendorName', label: 'Vendor Name', required: true, aliases: ['vendor', 'vendor name', 'vendor_name', 'party', 'supplier'] },
      { key: 'cementName', label: 'Cement Name', required: false, aliases: ['cement', 'cement name', 'cement_name', 'brand'] },
      { key: 'quantity', label: 'Quantity', required: true, aliases: ['quantity', 'qty', 'ton'] },
      { key: 'rate', label: 'Rate', required: true, aliases: ['rate', 'price', 'per ton'] },
      { key: 'totalAmount', label: 'Total Amount', required: false, aliases: ['total', 'total amount', 'amount'] },
      { key: 'paidAmount', label: 'Paid Amount', required: false, aliases: ['paid', 'paid amount'] },
      { key: 'transportationCharge', label: 'Transportation Charge', required: false, aliases: ['transport', 'transportation', 'transport charge'] },
      { key: 'gst', label: 'GST', required: false, aliases: ['gst', 'gst amount', 'tax'] },
      { key: 'remarks', label: 'Remarks', required: false, aliases: ['remarks', 'remark', 'note'] },
    ],
  },
  cementPurchase: {
    label: 'Cement Purchase',
    fields: [
      { key: 'date', label: 'Date', required: true, aliases: ['date', 'purchase date', 'दिनांक'] },
      { key: 'vendorName', label: 'Vendor Name', required: true, aliases: ['vendor', 'vendor name', 'vendor_name', 'party', 'supplier'] },
      { key: 'itemName', label: 'Item Name', required: false, aliases: ['item', 'item name', 'item_name', 'cement brand', 'brand'] },
      { key: 'quantity', label: 'Quantity', required: true, aliases: ['quantity', 'qty', 'bags'] },
      { key: 'rate', label: 'Rate', required: true, aliases: ['rate', 'price', 'per bag'] },
      { key: 'totalAmount', label: 'Total Amount', required: false, aliases: ['total', 'total amount', 'amount'] },
      { key: 'paidAmount', label: 'Paid Amount', required: false, aliases: ['paid', 'paid amount'] },
      { key: 'transportationCharge', label: 'Transportation Charge', required: false, aliases: ['transport', 'transportation'] },
      { key: 'gst', label: 'GST', required: false, aliases: ['gst', 'tax'] },
      { key: 'remarks', label: 'Remarks', required: false, aliases: ['remarks', 'remark', 'note'] },
    ],
  },
  hardner: {
    label: 'Hardner',
    fields: [
      { key: 'date', label: 'Date', required: true, aliases: ['date', 'दिनांक'] },
      { key: 'amount', label: 'Amount', required: true, aliases: ['amount', 'total', 'राशि'] },
    ],
  },
  electricity: {
    label: 'Electricity',
    fields: [
      { key: 'date', label: 'Date', required: true, aliases: ['date', 'bill date', 'दिनांक'] },
      { key: 'name', label: 'Name', required: false, aliases: ['name', 'party', 'connection name'] },
      { key: 'work', label: 'Work', required: false, aliases: ['work', 'description', 'details'] },
      { key: 'amount', label: 'Amount', required: true, aliases: ['amount', 'total', 'bill amount', 'राशि'] },
      { key: 'remarks', label: 'Remarks', required: false, aliases: ['remarks', 'remark', 'note'] },
    ],
  },
  factoryStuff: {
    label: 'Factory Stuff',
    fields: [
      { key: 'date', label: 'Date', required: true, aliases: ['date', 'दिनांक'] },
      { key: 'itemName', label: 'Item Name', required: true, aliases: ['item', 'item name', 'item_name', 'stuff'] },
      { key: 'quantity', label: 'Quantity', required: false, aliases: ['quantity', 'qty'] },
      { key: 'amount', label: 'Amount', required: true, aliases: ['amount', 'total', 'राशि'] },
      { key: 'remarks', label: 'Remarks', required: false, aliases: ['remarks', 'remark', 'note'] },
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
    if ([
      'quantityProduced', 'quantity', 'creditLimit', 'amount', 'rate',
      'zigZagWhite80', 'zigZagRed80', 'zigZagYellow80',
      'zigZagWhite60', 'zigZagRed60', 'zigZagYellow60',
      'curveStone', 'chequreTile', 'transportationCharge',
      'cement', 'zigZagGrey80', 'zigZagGrey60',
      'dumbleGrey80', 'dumbleRed80', 'dumbleYellow80',
      'quantityTon', 'totalAmount', 'paidAmount', 'remainingAmount',
      'gst',
    ].includes(fieldKey)) {
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
  const [result, setResult] = useState<{ imported: number; total: number; duplicatesSkipped?: number; errors?: string[] } | null>(null)
  const [resultOpen, setResultOpen] = useState(false)
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
      const skipped = res.total - res.imported
      const dups = (res as { duplicatesSkipped?: number }).duplicatesSkipped || 0
      setResult({ imported: res.imported, total: res.total, duplicatesSkipped: dups, errors: res.errors })

      // Refresh the underlying list whenever at least one row imported.
      if (res.imported > 0) {
        onSuccess()
      }

      // Close the import dialog and open the result popup so the user
      // can review success/error details at their own pace.
      handleClose(false)
      setResultOpen(true)
    } catch (err) {
      // Network/API error — surface in the result popup as well.
      setResult({
        imported: 0,
        total: transformedData.length,
        errors: [err instanceof Error ? err.message : 'Unknown error'],
      })
      handleClose(false)
      setResultOpen(true)
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

  const handleClose = (clearResult = true) => {
    setRawData([])
    setTransformedData([])
    setColumnMapping({})
    setExcelColumns([])
    if (clearResult) setResult(null)
    setFileName('')
    if (fileInputRef.current) fileInputRef.current.value = ''
    onClose()
  }

  const closeResultPopup = () => {
    setResultOpen(false)
    setResult(null)
  }

  const mappedFieldKeys = new Set(Object.values(columnMapping))
  const unmappedRequired = template.fields.filter((f) => f.required && !mappedFieldKeys.has(f.key))

  return (
    <>
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
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

          {/* Import result is now shown in a dedicated popup after the
              import dialog closes — see the result Dialog below. */}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose()}>Cancel</Button>
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

    {/* Result popup — opens after import finishes (success, partial, or error). */}
    <Dialog open={resultOpen} onOpenChange={(open) => { if (!open) closeResultPopup() }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {result && result.errors && result.errors.length > 0 ? (
              <>
                <AlertCircle className="h-5 w-5 text-destructive" />
                <span className="text-destructive">
                  {result.imported > 0 ? 'Partial Import' : 'Import Failed'}
                </span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <span className="text-emerald-700 dark:text-emerald-400">Import Successful</span>
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {template.label} import result
          </DialogDescription>
        </DialogHeader>

        {result && (
          <div className="space-y-4 py-2">
            {/* Summary numbers */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg border bg-emerald-50 dark:bg-emerald-900/20 p-3 text-center">
                <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{result.imported}</div>
                <div className="text-xs text-muted-foreground mt-1">Imported</div>
              </div>
              <div className="rounded-lg border bg-muted/50 p-3 text-center">
                <div className="text-2xl font-bold">{result.total}</div>
                <div className="text-xs text-muted-foreground mt-1">Total Rows</div>
              </div>
              <div className="rounded-lg border bg-amber-50 dark:bg-amber-900/20 p-3 text-center">
                <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                  {result.total - result.imported}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Skipped</div>
              </div>
              <div className="rounded-lg border bg-muted/50 p-3 text-center">
                <div className="text-2xl font-bold">
                  {result.duplicatesSkipped || 0}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Duplicates</div>
              </div>
            </div>

            {/* Status message */}
            <Alert variant={result.errors && result.errors.length > 0 ? 'destructive' : 'default'}>
              <AlertDescription>
                {result.imported === 0 ? (
                  <span>
                    No rows were imported.{' '}
                    {result.errors && result.errors.length > 0
                      ? `Reasons are listed below.`
                      : 'Please check your file and column mapping, then try again.'}
                  </span>
                ) : result.imported === result.total ? (
                  <span>All {result.imported} row(s) imported successfully. The list has been refreshed.</span>
                ) : (
                  <span>
                    {result.imported} of {result.total} row(s) imported.{' '}
                    {result.duplicatesSkipped && result.duplicatesSkipped > 0
                      ? `${result.duplicatesSkipped} duplicate(s) skipped. `
                      : ''}
                    {result.errors && result.errors.length > 0
                      ? `${result.errors.length} error(s) listed below.`
                      : ''}
                  </span>
                )}
              </AlertDescription>
            </Alert>

            {/* Error list */}
            {result.errors && result.errors.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  Errors ({result.errors.length})
                </h4>
                <ScrollArea className="max-h-64 rounded-md border">
                  <ul className="text-xs space-y-1 p-3">
                    {result.errors.map((err, i) => (
                      <li key={i} className="text-destructive flex gap-2">
                        <span className="font-mono text-muted-foreground shrink-0">#{i + 1}</span>
                        <span>{err}</span>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button onClick={closeResultPopup} className="bg-emerald-600 hover:bg-emerald-700">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}
