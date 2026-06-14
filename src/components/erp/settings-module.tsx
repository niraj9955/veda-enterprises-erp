'use client'

import * as React from 'react'
import { api } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import { toast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Building2,
  Palette,
  Database,
  Save,
  Loader2,
  Download,
  Upload,
  Trash2,
  MapPin,
  Scale,
  Landmark,
  FileText,
  UserCheck,
  AlertTriangle,
  Eye,
} from 'lucide-react'

// ── Types ───────────────────────────────────────────────────────────────────

interface CompanyForm {
  name: string
  tagline: string
  phone: string
  email: string
  address: string
  city: string
  state: string
  pincode: string
  gstNumber: string
  panNumber: string
  bankName: string
  bankAccount: string
  bankIfsc: string
  invoicePrefix: string
  dispatchPrefix: string
  orderPrefix: string
  terms: string
  signatureName: string
  logoUrl: string
  primaryColor: string
}

// ── Component ───────────────────────────────────────────────────────────────

export default function SettingsModule() {
  const { company, setCompany } = useAppStore()

  // Loading state for initial fetch
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)

  // Company form data
  const [form, setForm] = React.useState<CompanyForm>({
    name: '',
    tagline: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    gstNumber: '',
    panNumber: '',
    bankName: '',
    bankAccount: '',
    bankIfsc: '',
    invoicePrefix: 'INV',
    dispatchPrefix: 'DSP',
    orderPrefix: 'ORD',
    terms: '',
    signatureName: '',
    logoUrl: '',
    primaryColor: '#059669',
  })

  // Database management states
  const [exporting, setExporting] = React.useState(false)
  const [importing, setImporting] = React.useState(false)
  const [clearDialogOpen, setClearDialogOpen] = React.useState(false)
  const [clearing, setClearing] = React.useState(false)

  // File input ref for import
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // ── Fetch company data on mount ──────────────────────────────────────────

  React.useEffect(() => {
    const fetchCompany = async () => {
      try {
        setLoading(true)
        const data = await api.getCompany()
        const c = data.company as Record<string, unknown>
        if (c) {
          setForm({
            name: (c.name as string) || '',
            tagline: (c.tagline as string) || '',
            phone: (c.phone as string) || '',
            email: (c.email as string) || '',
            address: (c.address as string) || '',
            city: (c.city as string) || '',
            state: (c.state as string) || '',
            pincode: (c.pincode as string) || '',
            gstNumber: (c.gstNumber as string) || '',
            panNumber: (c.panNumber as string) || '',
            bankName: (c.bankName as string) || '',
            bankAccount: (c.bankAccount as string) || '',
            bankIfsc: (c.bankIfsc as string) || '',
            invoicePrefix: (c.invoicePrefix as string) || 'INV',
            dispatchPrefix: (c.dispatchPrefix as string) || 'DSP',
            orderPrefix: (c.orderPrefix as string) || 'ORD',
            terms: (c.terms as string) || '',
            signatureName: (c.signatureName as string) || '',
            logoUrl: (c.logoUrl as string) || '',
            primaryColor: (c.primaryColor as string) || '#059669',
          })
        }
      } catch {
        toast({ title: 'Error', description: 'Failed to load company settings', variant: 'destructive' })
      } finally {
        setLoading(false)
      }
    }
    fetchCompany()
  }, [])

  // ── Update form field helper ─────────────────────────────────────────────

  const updateField = (field: keyof CompanyForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  // ── Save company profile ─────────────────────────────────────────────────

  const handleSaveProfile = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Validation Error', description: 'Company Name is required', variant: 'destructive' })
      return
    }

    try {
      setSaving(true)
      const data = await api.updateCompany(form as unknown as Record<string, unknown>)
      const updated = data.company as Record<string, unknown>
      if (updated && company) {
        setCompany({
          ...company,
          ...(updated as typeof company),
        })
      }
      toast({ title: 'Success', description: 'Company profile saved successfully' })
    } catch {
      toast({ title: 'Error', description: 'Failed to save company profile', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  // ── Save branding ────────────────────────────────────────────────────────

  const handleSaveBranding = async () => {
    try {
      setSaving(true)
      const data = await api.updateCompany({
        primaryColor: form.primaryColor,
        logoUrl: form.logoUrl,
      } as unknown as Record<string, unknown>)
      const updated = data.company as Record<string, unknown>
      if (updated && company) {
        setCompany({
          ...company,
          ...(updated as typeof company),
        })
      }
      toast({ title: 'Success', description: 'Branding settings saved successfully' })
    } catch {
      toast({ title: 'Error', description: 'Failed to save branding settings', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  // ── Export backup ────────────────────────────────────────────────────────

  const handleExport = async () => {
    try {
      setExporting(true)
      const data = await api.exportBackup()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `erp-backup-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast({ title: 'Success', description: 'Backup exported and downloaded successfully' })
    } catch {
      toast({ title: 'Error', description: 'Failed to export backup', variant: 'destructive' })
    } finally {
      setExporting(false)
    }
  }

  // ── Import backup ────────────────────────────────────────────────────────

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setImporting(true)
      const text = await file.text()
      const data = JSON.parse(text)
      const result = await api.restoreBackup(data)
      const counts = result.counts as Record<string, number>
      const summary = Object.entries(counts)
        .map(([key, val]) => `${key}: ${val}`)
        .join(', ')
      toast({
        title: 'Backup Restored',
        description: summary || result.message,
      })
    } catch (err) {
      if (err instanceof SyntaxError) {
        toast({ title: 'Invalid File', description: 'The selected file is not valid JSON', variant: 'destructive' })
      } else {
        toast({ title: 'Error', description: 'Failed to restore backup', variant: 'destructive' })
      }
    } finally {
      setImporting(false)
      // Reset file input so the same file can be re-selected
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // ── Clear all data ───────────────────────────────────────────────────────

  const handleClearData = async () => {
    try {
      setClearing(true)
      await api.clearData()
      toast({ title: 'Success', description: 'All data has been cleared' })
      setClearDialogOpen(false)
    } catch {
      toast({ title: 'Error', description: 'Failed to clear data', variant: 'destructive' })
    } finally {
      setClearing(false)
    }
  }

  // ── Loading skeleton ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-2 h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-96" />
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground text-sm">Manage your company profile, branding, and database</p>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="profile" className="gap-1.5">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Company Profile</span>
            <span className="sm:hidden">Profile</span>
          </TabsTrigger>
          <TabsTrigger value="branding" className="gap-1.5">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Branding</span>
            <span className="sm:hidden">Brand</span>
          </TabsTrigger>
          <TabsTrigger value="database" className="gap-1.5">
            <Database className="h-4 w-4" />
            <span className="hidden sm:inline">Database</span>
            <span className="sm:hidden">Data</span>
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════ Tab 1: Company Profile ═══════════════════ */}
        <TabsContent value="profile" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* ── Business Details ─────────────────────────────────────── */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-emerald-600" />
                  <CardTitle className="text-base">Business Details</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="company-name">
                    Company Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="company-name"
                    placeholder="Enter company name"
                    value={form.name}
                    onChange={(e) => updateField('name', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-tagline">Tagline</Label>
                  <Input
                    id="company-tagline"
                    placeholder="Your company tagline"
                    value={form.tagline}
                    onChange={(e) => updateField('tagline', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-phone">Phone</Label>
                  <Input
                    id="company-phone"
                    type="tel"
                    placeholder="+91 9876543210"
                    value={form.phone}
                    onChange={(e) => updateField('phone', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-email">Email</Label>
                  <Input
                    id="company-email"
                    type="email"
                    placeholder="contact@company.com"
                    value={form.email}
                    onChange={(e) => updateField('email', e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* ── Address ──────────────────────────────────────────────── */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-emerald-600" />
                  <CardTitle className="text-base">Address</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="company-address">Address</Label>
                  <Input
                    id="company-address"
                    placeholder="Street address"
                    value={form.address}
                    onChange={(e) => updateField('address', e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="company-city">City</Label>
                    <Input
                      id="company-city"
                      placeholder="City"
                      value={form.city}
                      onChange={(e) => updateField('city', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company-state">State</Label>
                    <Input
                      id="company-state"
                      placeholder="State"
                      value={form.state}
                      onChange={(e) => updateField('state', e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-pincode">Pincode</Label>
                  <Input
                    id="company-pincode"
                    placeholder="000000"
                    value={form.pincode}
                    onChange={(e) => updateField('pincode', e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* ── Tax & Legal ──────────────────────────────────────────── */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <Scale className="h-4 w-4 text-emerald-600" />
                  <CardTitle className="text-base">Tax &amp; Legal</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="company-gst">GST Number</Label>
                  <Input
                    id="company-gst"
                    placeholder="22AAAAA0000A1Z5"
                    value={form.gstNumber}
                    onChange={(e) => updateField('gstNumber', e.target.value.toUpperCase())}
                    className="uppercase"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-pan">PAN Number</Label>
                  <Input
                    id="company-pan"
                    placeholder="AAAAA0000A"
                    value={form.panNumber}
                    onChange={(e) => updateField('panNumber', e.target.value.toUpperCase())}
                    className="uppercase"
                  />
                </div>
              </CardContent>
            </Card>

            {/* ── Bank Details ─────────────────────────────────────────── */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-emerald-600" />
                  <CardTitle className="text-base">Bank Details</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="company-bank-name">Bank Name</Label>
                  <Input
                    id="company-bank-name"
                    placeholder="Bank name"
                    value={form.bankName}
                    onChange={(e) => updateField('bankName', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-bank-account">Account Number</Label>
                  <Input
                    id="company-bank-account"
                    placeholder="000000000000"
                    value={form.bankAccount}
                    onChange={(e) => updateField('bankAccount', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-bank-ifsc">IFSC Code</Label>
                  <Input
                    id="company-bank-ifsc"
                    placeholder="BANK0000000"
                    value={form.bankIfsc}
                    onChange={(e) => updateField('bankIfsc', e.target.value.toUpperCase())}
                    className="uppercase"
                  />
                </div>
              </CardContent>
            </Card>

            {/* ── Document Prefixes ────────────────────────────────────── */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-emerald-600" />
                  <CardTitle className="text-base">Document Prefixes</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  Used to auto-generate document numbers like INV-001, DSP-001
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="company-invoice-prefix">Invoice</Label>
                    <Input
                      id="company-invoice-prefix"
                      placeholder="INV"
                      value={form.invoicePrefix}
                      onChange={(e) => updateField('invoicePrefix', e.target.value.toUpperCase())}
                      className="uppercase"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company-dispatch-prefix">Dispatch</Label>
                    <Input
                      id="company-dispatch-prefix"
                      placeholder="DSP"
                      value={form.dispatchPrefix}
                      onChange={(e) => updateField('dispatchPrefix', e.target.value.toUpperCase())}
                      className="uppercase"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company-order-prefix">Order</Label>
                    <Input
                      id="company-order-prefix"
                      placeholder="ORD"
                      value={form.orderPrefix}
                      onChange={(e) => updateField('orderPrefix', e.target.value.toUpperCase())}
                      className="uppercase"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── Other ────────────────────────────────────────────────── */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-emerald-600" />
                  <CardTitle className="text-base">Other</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="company-terms">Terms &amp; Conditions</Label>
                  <Textarea
                    id="company-terms"
                    placeholder="Standard terms & conditions for invoices and documents..."
                    rows={5}
                    value={form.terms}
                    onChange={(e) => updateField('terms', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-signature">Authorized Signatory Name</Label>
                  <Input
                    id="company-signature"
                    placeholder="Name of the authorized signatory"
                    value={form.signatureName}
                    onChange={(e) => updateField('signatureName', e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Save Button ──────────────────────────────────────────────── */}
          <div className="flex justify-end">
            <Button
              onClick={handleSaveProfile}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[140px]"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Profile
                </>
              )}
            </Button>
          </div>
        </TabsContent>

        {/* ═══════════════════ Tab 2: Branding & Appearance ═════════════ */}
        <TabsContent value="branding" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* ── Branding Settings ────────────────────────────────────── */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4 text-emerald-600" />
                  <CardTitle className="text-base">Branding Settings</CardTitle>
                </div>
                <CardDescription>
                  Customize how your brand appears across the ERP system and printed documents
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Primary Color */}
                <div className="space-y-2">
                  <Label htmlFor="primary-color">Primary Color</Label>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <input
                        type="color"
                        value={form.primaryColor}
                        onChange={(e) => updateField('primaryColor', e.target.value)}
                        className="h-10 w-12 cursor-pointer rounded-md border border-input p-0.5"
                      />
                    </div>
                    <Input
                      id="primary-color"
                      type="text"
                      placeholder="#059669"
                      value={form.primaryColor}
                      onChange={(e) => {
                        const val = e.target.value
                        updateField('primaryColor', val.startsWith('#') ? val : `#${val}`)
                      }}
                      className="flex-1 font-mono"
                      maxLength={7}
                    />
                    <div
                      className="h-10 w-10 rounded-md border border-input shrink-0"
                      style={{ backgroundColor: form.primaryColor || '#059669' }}
                    />
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Used for buttons, headers, and accents throughout the system
                  </p>
                </div>

                <Separator />

                {/* Logo URL */}
                <div className="space-y-2">
                  <Label htmlFor="company-logo-url">Company Logo URL</Label>
                  <Input
                    id="company-logo-url"
                    type="url"
                    placeholder="https://example.com/logo.png"
                    value={form.logoUrl}
                    onChange={(e) => updateField('logoUrl', e.target.value)}
                  />
                  <p className="text-muted-foreground text-xs">
                    Enter a URL for your company logo. This will appear on invoices and reports.
                  </p>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={handleSaveBranding}
                    disabled={saving}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[140px]"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Branding
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* ── Preview ──────────────────────────────────────────────── */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-emerald-600" />
                  <CardTitle className="text-base">Preview</CardTitle>
                </div>
                <CardDescription>
                  See how your branding will look on documents
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border bg-white p-6 dark:bg-gray-950">
                  {/* Header area with logo and company info */}
                  <div className="flex items-start gap-4">
                    {form.logoUrl ? (
                      <img
                        src={form.logoUrl}
                        alt="Company logo preview"
                        className="h-16 w-16 rounded-md object-contain border border-gray-200 dark:border-gray-700"
                        onError={(e) => {
                          ;(e.target as HTMLImageElement).style.display = 'none'
                        }}
                      />
                    ) : (
                      <div
                        className="flex h-16 w-16 items-center justify-center rounded-md text-xl font-bold text-white shrink-0"
                        style={{ backgroundColor: form.primaryColor || '#059669' }}
                      >
                        {(form.name || 'C').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3
                        className="text-xl font-bold truncate"
                        style={{ color: form.primaryColor || '#059669' }}
                      >
                        {form.name || 'Company Name'}
                      </h3>
                      {form.tagline && (
                        <p className="text-muted-foreground text-sm mt-0.5 truncate">
                          {form.tagline}
                        </p>
                      )}
                      {(form.address || form.city) && (
                        <p className="text-muted-foreground text-xs mt-1 truncate">
                          {[form.address, form.city, form.state].filter(Boolean).join(', ')}
                          {form.pincode ? ` - ${form.pincode}` : ''}
                        </p>
                      )}
                    </div>
                  </div>

                  <Separator className="my-4" />

                  {/* Mini invoice preview */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span
                        className="text-xs font-semibold uppercase tracking-wider"
                        style={{ color: form.primaryColor || '#059669' }}
                      >
                        Tax Invoice
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {form.invoicePrefix || 'INV'}-001
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div>Date: {new Date().toLocaleDateString('en-IN')}</div>
                      <div>GST: {form.gstNumber || '—'}</div>
                    </div>
                  </div>

                  <Separator className="my-4" />

                  {/* Footer with terms */}
                  {form.terms && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Terms &amp; Conditions
                      </p>
                      <p className="text-muted-foreground text-[10px] line-clamp-2">
                        {form.terms}
                      </p>
                    </div>
                  )}

                  {/* Signature */}
                  {form.signatureName && (
                    <div className="mt-4 flex justify-end">
                      <div className="text-right">
                        <div className="border-t border-gray-300 pt-1 text-xs">
                          {form.signatureName}
                        </div>
                        <p className="text-[10px] text-muted-foreground">Authorized Signatory</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════════════════ Tab 3: Database Management ═══════════════ */}
        <TabsContent value="database" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* ── Export Backup ─────────────────────────────────────────── */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <Download className="h-4 w-4 text-emerald-600" />
                  <CardTitle className="text-base">Export Backup</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground text-sm">
                  Download a complete backup of all your ERP data as a JSON file. This includes
                  company settings, users, customers, production records, stock, orders, dispatches,
                  payments, and expenses.
                </p>
                <Button
                  onClick={handleExport}
                  disabled={exporting}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {exporting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Export Backup
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* ── Import Backup ─────────────────────────────────────────── */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <Upload className="h-4 w-4 text-emerald-600" />
                  <CardTitle className="text-base">Import Backup</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground text-sm">
                  Restore data from a previously exported JSON backup file. This will merge the
                  backup data with your existing data. Make sure the file was exported from this
                  ERP system.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileChange}
                  className="hidden"
                  aria-label="Select backup file"
                />
                <Button
                  onClick={handleImportClick}
                  disabled={importing}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {importing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Import Backup
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* ── Clear All Data ────────────────────────────────────────── */}
            <Card className="border-destructive/30">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2 text-destructive">
                  <Trash2 className="h-4 w-4" />
                  <CardTitle className="text-base text-destructive">Clear All Data</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground text-sm">
                  Permanently delete all business data from the system. This includes customers,
                  production, stock, orders, dispatches, payments, and expenses. Company settings
                  and user accounts will be preserved.
                </p>
                <div className="flex items-start gap-2 rounded-md bg-destructive/5 p-3 border border-destructive/20">
                  <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <p className="text-destructive text-xs font-medium">
                    This action cannot be undone. Please export a backup before clearing data.
                  </p>
                </div>
                <Button
                  variant="destructive"
                  onClick={() => setClearDialogOpen(true)}
                  className="w-full"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear All Data
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* ── Additional Warning ────────────────────────────────────────── */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Important Notes</p>
                  <ul className="text-muted-foreground text-sm space-y-1 list-disc list-inside">
                    <li>
                      <strong>Export Backup</strong> — Creates a snapshot of all data. Safe to use anytime.
                    </li>
                    <li>
                      <strong>Import Backup</strong> — Merges backup data into the existing database. Existing records
                      with the same ID will be overwritten.
                    </li>
                    <li>
                      <strong>Clear All Data</strong> — Irreversibly removes all business data. Always export a backup
                      first as a safety measure.
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Clear Data Confirmation Dialog ──────────────────────────────── */}
      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Clear All Data</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all customers, production records, stock entries, orders,
              dispatches, payments, and expenses. Company settings and user accounts will be kept.
              <br />
              <br />
              <strong>This action cannot be undone.</strong> Have you exported a backup?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearData}
              disabled={clearing}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {clearing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Clearing...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Yes, Clear All Data
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
