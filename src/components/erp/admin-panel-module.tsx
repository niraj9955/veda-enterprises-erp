'use client'

import * as React from 'react'
import { api } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import { toast } from '@/hooks/use-toast'
import { useAiConfig } from '@/hooks/use-ai-config'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  ShieldCheck,
  Building2,
  Upload,
  ImagePlus,
  Trash2,
  Save,
  Loader2,
  Download,
  Database,
  Users,
  Palette,
  FileSpreadsheet,
  Eye,
  Power,
  PowerOff,
  Pencil,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  X,
  Check,
  Sparkles,
  EyeOff,
  RotateCcw,
  Eraser,
  Layers,
  Plus,
  Zap,
} from 'lucide-react'
import { isFormEmpty, showPleaseFillDataToast } from '@/lib/form-validation'

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

interface UserItem {
  id: string
  name: string
  email: string
  role: string
  active: boolean
  createdAt: string
}

interface UserFormData {
  name: string
  email: string
  password: string
  role: string
}

const ROLES = ['admin', 'operator', 'accountant'] as const

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  operator: 'Operator',
  accountant: 'Accountant',
}

const ROLE_BADGE_STYLES: Record<string, string> = {
  admin: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
  operator: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
  accountant: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800',
}

const ROLE_PERMISSIONS: Record<string, { modules: string[]; description: string }> = {
  admin: {
    modules: ['Dashboard', 'Customers', 'Production', 'Stock', 'Orders', 'Dispatch', 'Payments', 'Expenses', 'Reports', 'Users', 'Settings', 'Admin Panel'],
    description: 'Full access to all modules and features. Can manage users, company settings, and data.',
  },
  operator: {
    modules: ['Dashboard', 'Production', 'Dispatch', 'Stock'],
    description: 'Access to production, dispatch, and stock modules. Can create and update entries but cannot delete.',
  },
  accountant: {
    modules: ['Dashboard', 'Payments', 'Expenses', 'Reports'],
    description: 'Access to payments, expenses, and reports. Can manage financial records and generate reports.',
  },
}

const emptyCompanyForm: CompanyForm = {
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
}

const emptyUserForm: UserFormData = {
  name: '',
  email: '',
  password: '',
  role: 'operator',
}

// ── Component ───────────────────────────────────────────────────────────────

export default function AdminPanelModule() {
  const { company, setCompany, user: currentUser } = useAppStore()

  // Company form state
  const [companyForm, setCompanyForm] = React.useState<CompanyForm>(emptyCompanyForm)
  const [savingCompany, setSavingCompany] = React.useState(false)
  const [uploadingLogo, setUploadingLogo] = React.useState(false)

  // User management state
  const [users, setUsers] = React.useState<UserItem[]>([])
  const [loadingUsers, setLoadingUsers] = React.useState(true)
  const [formOpen, setFormOpen] = React.useState(false)
  const [editingUser, setEditingUser] = React.useState<UserItem | null>(null)
  const [formData, setFormData] = React.useState<UserFormData>(emptyUserForm)
  const [formSubmitting, setFormSubmitting] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<UserItem | null>(null)
  const [deleting, setDeleting] = React.useState(false)
  const [togglingId, setTogglingId] = React.useState<string | null>(null)

  // Database management
  const [dbAction, setDbAction] = React.useState<'clear' | null>(null)
  const [dbLoading, setDbLoading] = React.useState(false)

  // ── Users bulk operations ───────────────────────────────────────────────
  // Adds the same multi-select + bulk-delete pattern used in every other ERP
  // module. Self-selection is auto-excluded from the table so the admin can't
  // accidentally tick their own row.
  const [selectedUserIds, setSelectedUserIds] = React.useState<Set<string>>(new Set())
  const [bulkUserAction, setBulkUserAction] = React.useState<'delete' | 'activate' | 'deactivate' | null>(null)
  const [bulkUserLoading, setBulkUserLoading] = React.useState(false)

  const toggleSelectUser = (id: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const toggleSelectAllUsers = () => {
    if (selectedUserIds.size === users.length) {
      setSelectedUserIds(new Set())
    } else {
      setSelectedUserIds(new Set(users.map((u) => u.id)))
    }
  }
  const clearUserSelection = () => setSelectedUserIds(new Set())

  const handleBulkUserConfirm = async () => {
    if (!bulkUserAction || selectedUserIds.size === 0) return
    const ids = Array.from(selectedUserIds)
    setBulkUserLoading(true)
    try {
      if (bulkUserAction === 'delete') {
        const res = await api.bulkDeleteUsers(ids)
        toast({ title: 'Success', description: res.message })
      } else {
        const active = bulkUserAction === 'activate'
        const res = await api.bulkUpdateUsers(ids, active)
        toast({ title: 'Success', description: res.message })
      }
      setBulkUserAction(null)
      clearUserSelection()
      fetchUsers()
    } catch (err) {
      toast({
        title: 'Bulk action failed',
        description: err instanceof Error ? err.message : 'Failed',
        variant: 'destructive',
      })
    } finally {
      setBulkUserLoading(false)
    }
  }

  // ── Company: dirty tracking + discard + reset to defaults ───────────────
  // `savedCompanyForm` is a snapshot of the form at the moment of last save.
  // We compare current form vs snapshot to show the "Unsaved changes" badge.
  const [savedCompanyForm, setSavedCompanyForm] = React.useState<CompanyForm | null>(null)
  const [resetCompanyOpen, setResetCompanyOpen] = React.useState(false)
  const companyIsDirty = React.useMemo(() => {
    if (!savedCompanyForm) return false
    return (Object.keys(savedCompanyForm) as (keyof CompanyForm)[]).some(
      (k) => savedCompanyForm[k] !== companyForm[k]
    )
  }, [savedCompanyForm, companyForm])

  // Capture snapshot whenever `company` changes from the store (i.e. after save)
  React.useEffect(() => {
    if (company) {
      const snapshot: CompanyForm = {
        name: company.name || '',
        tagline: company.tagline || '',
        phone: company.phone || '',
        email: company.email || '',
        address: company.address || '',
        city: company.city || '',
        state: company.state || '',
        pincode: company.pincode || '',
        gstNumber: company.gstNumber || '',
        panNumber: company.panNumber || '',
        bankName: company.bankName || '',
        bankAccount: company.bankAccount || '',
        bankIfsc: company.bankIfsc || '',
        invoicePrefix: company.invoicePrefix || 'INV',
        dispatchPrefix: company.dispatchPrefix || 'DSP',
        orderPrefix: company.orderPrefix || 'ORD',
        terms: company.terms || '',
        signatureName: company.signatureName || '',
        logoUrl: company.logoUrl || '',
        primaryColor: company.primaryColor || '#059669',
      }
      setSavedCompanyForm(snapshot)
    }
  }, [company])

  const handleDiscardCompanyChanges = () => {
    if (savedCompanyForm) {
      setCompanyForm(savedCompanyForm)
      toast({ title: 'Changes discarded', description: 'Form reverted to last saved state' })
    } else {
      setCompanyForm(emptyCompanyForm)
      toast({ title: 'Form cleared', description: 'No saved state to revert to' })
    }
  }

  const handleResetCompanyDefaults = async () => {
    setResetCompanyOpen(false)
    setSavingCompany(true)
    try {
      // Reset to emptyCompanyForm values but keep setupComplete so the user
      // doesn't get kicked to the onboarding wizard. We also keep the logo
      // because removing it would be surprising from a "reset settings" action.
      const keptLogo = companyForm.logoUrl
      const resetForm: CompanyForm = { ...emptyCompanyForm, logoUrl: keptLogo }
      setCompanyForm(resetForm)
      const result = await api.updateCompany({ ...resetForm, setupComplete: true })
      setCompany(result.company as Parameters<typeof setCompany>[0])
      toast({ title: 'Reset to defaults', description: 'All company settings have been cleared' })
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' })
    } finally {
      setSavingCompany(false)
    }
  }

  // ── Database: clear specific section ────────────────────────────────────
  const [clearableSections, setClearableSections] = React.useState<{ key: string; label: string; count: number }[]>([])
  const [clearSectionKey, setClearSectionKey] = React.useState<string>('')
  const [clearSectionOpen, setClearSectionOpen] = React.useState(false)
  const [clearSectionLoading, setClearSectionLoading] = React.useState(false)

  const fetchClearableSections = React.useCallback(async () => {
    try {
      const res = await api.getClearableSections()
      setClearableSections(res.sections)
      if (!clearSectionKey && res.sections.length > 0) {
        setClearSectionKey(res.sections[0].key)
      }
    } catch {
      // silent — dropdown just stays empty
    }
  }, [clearSectionKey])

  const selectedSectionMeta = clearableSections.find((s) => s.key === clearSectionKey)

  const handleClearSection = async () => {
    if (!clearSectionKey) return
    setClearSectionLoading(true)
    try {
      const res = await api.clearSection(clearSectionKey)
      toast({ title: 'Section cleared', description: res.message })
      setClearSectionOpen(false)
      // Refresh counts so the dropdown reflects the new state
      await fetchClearableSections()
    } catch (err) {
      toast({
        title: 'Failed to clear section',
        description: err instanceof Error ? err.message : 'Failed',
        variant: 'destructive',
      })
    } finally {
      setClearSectionLoading(false)
    }
  }

  // Load company data
  React.useEffect(() => {
    if (company) {
      setCompanyForm({
        name: company.name || '',
        tagline: company.tagline || '',
        phone: company.phone || '',
        email: company.email || '',
        address: company.address || '',
        city: company.city || '',
        state: company.state || '',
        pincode: company.pincode || '',
        gstNumber: company.gstNumber || '',
        panNumber: company.panNumber || '',
        bankName: company.bankName || '',
        bankAccount: company.bankAccount || '',
        bankIfsc: company.bankIfsc || '',
        invoicePrefix: company.invoicePrefix || 'INV',
        dispatchPrefix: company.dispatchPrefix || 'DSP',
        orderPrefix: company.orderPrefix || 'ORD',
        terms: company.terms || '',
        signatureName: company.signatureName || '',
        logoUrl: company.logoUrl || '',
        primaryColor: company.primaryColor || '#059669',
      })
    }
  }, [company])

  // Fetch users
  const fetchUsers = React.useCallback(async () => {
    setLoadingUsers(true)
    try {
      const res = await api.getUsers()
      setUsers(res.users as UserItem[])
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to fetch users', variant: 'destructive' })
    } finally {
      setLoadingUsers(false)
    }
  }, [])

  React.useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // Fetch the list of clearable sections (with live counts) on mount so the
  // Database tab dropdown is populated immediately. We also re-fetch after
  // any database operation (clear all, clear section, restore) so counts
  // stay in sync.
  React.useEffect(() => {
    fetchClearableSections()
  }, [fetchClearableSections])

  // ── Company save ─────────────────────────────────────────────────────────
  const handleSaveCompany = async () => {
    if (!companyForm.name.trim()) {
      toast({ title: 'Error', description: 'Company name is required', variant: 'destructive' })
      return
    }
    setSavingCompany(true)
    try {
      const result = await api.updateCompany({
        ...companyForm,
        setupComplete: true,
      })
      setCompany(result.company as Parameters<typeof setCompany>[0])
      toast({ title: 'Success', description: 'Company settings saved successfully' })
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to save', variant: 'destructive' })
    } finally {
      setSavingCompany(false)
    }
  }

  // ── Logo upload ──────────────────────────────────────────────────────────
  const logoInputRef = React.useRef<HTMLInputElement>(null)

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Please upload an image file', variant: 'destructive' })
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Logo must be under 2MB', variant: 'destructive' })
      return
    }

    setUploadingLogo(true)
    try {
      const reader = new FileReader()
      reader.onload = async () => {
        const base64 = reader.result as string
        const result = await api.updateCompany({ logoUrl: base64, setupComplete: true })
        setCompany(result.company as Parameters<typeof setCompany>[0])
        setCompanyForm((prev) => ({ ...prev, logoUrl: base64 }))
        toast({ title: 'Logo updated', description: 'Company logo has been updated' })
        setUploadingLogo(false)
      }
      reader.readAsDataURL(file)
    } catch (err) {
      toast({ title: 'Upload failed', description: 'Could not upload logo', variant: 'destructive' })
      setUploadingLogo(false)
    }
  }

  const handleRemoveLogo = async () => {
    try {
      const result = await api.updateCompany({ logoUrl: '', setupComplete: true })
      setCompany(result.company as Parameters<typeof setCompany>[0])
      setCompanyForm((prev) => ({ ...prev, logoUrl: '' }))
      toast({ title: 'Logo removed', description: 'Company logo has been removed' })
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to remove logo', variant: 'destructive' })
    }
  }

  // ── Use Veda default logo ────────────────────────────────────────────────
  const handleUseVedaLogo = async () => {
    try {
      // Convert the SVG to a data URL
      const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" fill="none"><rect width="200" height="200" rx="40" fill="#059669"/><path d="M100 30L40 75v15h20v55h30v-35h20v35h30V90h20V75L100 30z" fill="white" opacity="0.95"/><rect x="85" y="95" width="30" height="20" rx="2" fill="white" opacity="0.6"/><path d="M35 155h130v10a10 10 0 01-10 10H45a10 10 0 01-10-10v-10z" fill="white" opacity="0.8"/><text x="100" y="192" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="white" opacity="0.9">VEDA</text></svg>`
      const dataUrl = `data:image/svg+xml;base64,${btoa(svgContent)}`
      const result = await api.updateCompany({ logoUrl: dataUrl, setupComplete: true })
      setCompany(result.company as Parameters<typeof setCompany>[0])
      setCompanyForm((prev) => ({ ...prev, logoUrl: dataUrl }))
      toast({ title: 'Veda logo applied', description: 'Default Veda Enterprises logo has been set' })
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to set Veda logo', variant: 'destructive' })
    }
  }

  // ── User form handlers ──────────────────────────────────────────────────
  const openAddDialog = () => {
    setEditingUser(null)
    setFormData(emptyUserForm)
    setFormOpen(true)
  }

  const openEditDialog = (user: UserItem) => {
    setEditingUser(user)
    setFormData({ name: user.name, email: user.email, password: '', role: user.role })
    setFormOpen(true)
  }

  const handleSubmitUser = async () => {
    // Unified empty-form check — show ONE popup instead of cascading errors.
    // Only applies when CREATING (password is intentionally blank when editing).
    if (!editingUser && isFormEmpty([formData.name, formData.email, formData.password])) {
      toast(showPleaseFillDataToast())
      return
    }
    if (!formData.name.trim() || !formData.email.trim()) {
      toast({ title: 'Error', description: 'Name and email are required', variant: 'destructive' })
      return
    }
    if (!editingUser && !formData.password.trim()) {
      toast({ title: 'Error', description: 'Password is required for new users', variant: 'destructive' })
      return
    }

    setFormSubmitting(true)
    try {
      if (editingUser) {
        const payload: Record<string, unknown> = {
          name: formData.name.trim(),
          email: formData.email.trim(),
          role: formData.role,
          active: editingUser.active,
        }
        if (formData.password.trim()) payload.password = formData.password.trim()
        await api.updateUser(editingUser.id, payload)
        toast({ title: 'Success', description: 'User updated' })
      } else {
        await api.createUser({
          name: formData.name.trim(),
          email: formData.email.trim(),
          password: formData.password.trim(),
          role: formData.role,
        })
        toast({ title: 'Success', description: 'User created' })
      }
      setFormOpen(false)
      fetchUsers()
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' })
    } finally {
      setFormSubmitting(false)
    }
  }

  const handleToggleActive = async (user: UserItem) => {
    setTogglingId(user.id)
    try {
      await api.updateUser(user.id, { name: user.name, email: user.email, role: user.role, active: !user.active })
      toast({ title: 'Success', description: `User ${!user.active ? 'activated' : 'deactivated'}` })
      fetchUsers()
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to toggle user', variant: 'destructive' })
    } finally {
      setTogglingId(null)
    }
  }

  const handleDeleteUser = async () => {
    if (!deleteTarget) return
    if (deleteTarget.id === currentUser?.id) {
      toast({ title: 'Error', description: 'Cannot delete your own account', variant: 'destructive' })
      setDeleteTarget(null)
      return
    }
    setDeleting(true)
    try {
      await api.deleteUser(deleteTarget.id)
      toast({ title: 'Success', description: 'User deleted' })
      setDeleteTarget(null)
      fetchUsers()
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to delete user', variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  // ── Database management ─────────────────────────────────────────────────
  const handleExportBackup = async () => {
    setDbLoading(true)
    try {
      const data = await api.exportBackup()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `veda-erp-backup-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast({ title: 'Backup exported', description: 'Database backup has been downloaded' })
    } catch (err) {
      toast({ title: 'Export failed', description: 'Could not export backup', variant: 'destructive' })
    } finally {
      setDbLoading(false)
    }
  }

  const handleClearData = async () => {
    setDbLoading(true)
    try {
      const result = await api.clearData() as any
      const cleared = result?.cleared || {}
      const total = Object.values(cleared).reduce((s: number, n: any) => s + (Number(n) || 0), 0)
      toast({
        title: 'Data cleared',
        description: total > 0
          ? `${total} records deleted. Users and company profile preserved.`
          : 'All data has been cleared from the system',
      })
      // Refresh the per-section counts in the Clear Section dropdown
      await fetchClearableSections()
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to clear data', variant: 'destructive' })
    } finally {
      setDbLoading(false)
      setDbAction(null)
    }
  }

  const handleRestoreBackup = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      setDbLoading(true)
      try {
        const text = await file.text()
        const parsed = JSON.parse(text)
        // Backup files exported by the v2 export route are wrapped as
        // { version, exportedAt, data: { ...collections... }, counts }.
        // Older / hand-crafted backups may pass the collections map directly.
        // Normalise both shapes here so the backend always sees the inner
        // collections object regardless of file format.
        const payload = parsed?.data && typeof parsed.data === 'object' && !Array.isArray(parsed.data)
          ? parsed.data
          : parsed

        const result = await api.restoreBackup(payload)
        // Result shape (MERGE mode):
        //   { mode: 'merge', counts: { inserted, replaced }, perCollection: { customers: {inserted, replaced, skipped}, ... } }
        // Show a clear breakdown so the user can verify their data was restored.
        const inserted = (result as any)?.counts?.inserted ?? 0
        const replaced = (result as any)?.counts?.replaced ?? 0
        const perCollection = (result as any)?.perCollection || {}
        const summary = Object.entries(perCollection)
          .filter(([, v]: any) => (v?.inserted ?? 0) + (v?.replaced ?? 0) > 0)
          .map(([k, v]: any) => `${k}: +${v.inserted ?? 0} new / ~${v.replaced ?? 0} updated`)
          .join(' • ')
        toast({
          title: 'Backup restored (merge mode)',
          description: summary
            ? `${inserted + replaced} docs affected (${inserted} new + ${replaced} updated). Current data NOT in backup is preserved. ${summary}`
            : `${inserted + replaced} docs affected. Current data NOT in backup is preserved.`,
        })
      } catch (err) {
        console.error('Restore failed:', err)
        toast({
          title: 'Restore failed',
          description: err instanceof Error ? err.message : 'Could not restore backup',
          variant: 'destructive',
        })
      } finally {
        setDbLoading(false)
        // Refresh per-section counts so the dropdown reflects restored data
        await fetchClearableSections()
      }
    }
    input.click()
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex size-9 md:size-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 shrink-0">
          <ShieldCheck className="size-4 md:size-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-xl md:text-2xl font-bold tracking-tight">Admin Panel</h2>
          <p className="text-xs md:text-sm text-muted-foreground">
            Full control over company settings, users, roles, and system data
          </p>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="company" className="space-y-4 md:space-y-6">
        {/* Mobile: horizontally scrollable tabs (no text cut-off); Desktop: 5-col grid */}
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-5 gap-1 h-auto">
          <TabsTrigger value="company" className="gap-1.5 md:gap-2 px-2 md:px-3 py-2 text-xs md:text-sm">
            <Building2 className="h-3.5 w-3.5 md:h-4 md:w-4" /> <span className="truncate">Company</span>
          </TabsTrigger>
          <TabsTrigger value="logo" className="gap-1.5 md:gap-2 px-2 md:px-3 py-2 text-xs md:text-sm">
            <ImagePlus className="h-3.5 w-3.5 md:h-4 md:w-4" /> <span className="truncate">Logo</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5 md:gap-2 px-2 md:px-3 py-2 text-xs md:text-sm">
            <Users className="h-3.5 w-3.5 md:h-4 md:w-4" /> <span className="truncate">Users</span>
          </TabsTrigger>
          <TabsTrigger value="database" className="gap-1.5 md:gap-2 px-2 md:px-3 py-2 text-xs md:text-sm col-span-3 md:col-span-1">
            <Database className="h-3.5 w-3.5 md:h-4 md:w-4" /> <span className="truncate">Database</span>
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-1.5 md:gap-2 px-2 md:px-3 py-2 text-xs md:text-sm col-span-3 md:col-span-1">
            <Sparkles className="h-3.5 w-3.5 md:h-4 md:w-4" /> <span className="truncate">AI Assistant</span>
          </TabsTrigger>
        </TabsList>

        {/* ── Company Settings Tab ──────────────────────────────────────── */}
        <TabsContent value="company" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-emerald-600" />
                Company Details
              </CardTitle>
              <CardDescription>
                Update your company information. These details appear on invoices, reports, and documents.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Company Name <span className="text-destructive">*</span></Label>
                  <Input value={companyForm.name} onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })} placeholder="Enter company name" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Tagline</Label>
                  <Input value={companyForm.tagline} onChange={(e) => setCompanyForm({ ...companyForm, tagline: e.target.value })} placeholder="e.g. Building the future, one brick at a time" />
                </div>
                <div className="space-y-2">
                  <Label>Phone <span className="text-destructive">*</span></Label>
                  <Input value={companyForm.phone} onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })} placeholder="+91 98765 43210" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={companyForm.email} onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })} placeholder="info@company.com" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Address</Label>
                  <Input value={companyForm.address} onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })} placeholder="Enter full address" />
                </div>
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input value={companyForm.city} onChange={(e) => setCompanyForm({ ...companyForm, city: e.target.value })} placeholder="City" />
                </div>
                <div className="space-y-2">
                  <Label>State</Label>
                  <Input value={companyForm.state} onChange={(e) => setCompanyForm({ ...companyForm, state: e.target.value })} placeholder="State" />
                </div>
                <div className="space-y-2">
                  <Label>Pincode</Label>
                  <Input value={companyForm.pincode} onChange={(e) => setCompanyForm({ ...companyForm, pincode: e.target.value })} placeholder="000000" />
                </div>
                <div className="space-y-2">
                  <Label>GST Number</Label>
                  <Input value={companyForm.gstNumber} onChange={(e) => setCompanyForm({ ...companyForm, gstNumber: e.target.value.toUpperCase() })} placeholder="22AAAAA0000A1Z5" />
                </div>
                <div className="space-y-2">
                  <Label>PAN Number</Label>
                  <Input value={companyForm.panNumber} onChange={(e) => setCompanyForm({ ...companyForm, panNumber: e.target.value.toUpperCase() })} placeholder="AAAAA0000A" />
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Palette className="h-4 w-4" /> Business Settings
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Invoice Prefix</Label>
                    <Input value={companyForm.invoicePrefix} onChange={(e) => setCompanyForm({ ...companyForm, invoicePrefix: e.target.value.toUpperCase() })} placeholder="INV" />
                  </div>
                  <div className="space-y-2">
                    <Label>Dispatch Prefix</Label>
                    <Input value={companyForm.dispatchPrefix} onChange={(e) => setCompanyForm({ ...companyForm, dispatchPrefix: e.target.value.toUpperCase() })} placeholder="DSP" />
                  </div>
                  <div className="space-y-2">
                    <Label>Order Prefix</Label>
                    <Input value={companyForm.orderPrefix} onChange={(e) => setCompanyForm({ ...companyForm, orderPrefix: e.target.value.toUpperCase() })} placeholder="ORD" />
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  Bank Details
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Bank Name</Label>
                    <Input value={companyForm.bankName} onChange={(e) => setCompanyForm({ ...companyForm, bankName: e.target.value })} placeholder="Enter bank name" />
                  </div>
                  <div className="space-y-2">
                    <Label>Account Number</Label>
                    <Input value={companyForm.bankAccount} onChange={(e) => setCompanyForm({ ...companyForm, bankAccount: e.target.value })} placeholder="Enter account number" />
                  </div>
                  <div className="space-y-2">
                    <Label>IFSC Code</Label>
                    <Input value={companyForm.bankIfsc} onChange={(e) => setCompanyForm({ ...companyForm, bankIfsc: e.target.value.toUpperCase() })} placeholder="Enter IFSC code" />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Branding / Theme color customization */}
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Palette className="h-4 w-4" /> Theme Color
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={companyForm.primaryColor}
                      onChange={(e) => setCompanyForm({ ...companyForm, primaryColor: e.target.value })}
                      className="h-10 w-16 rounded border border-input cursor-pointer bg-background"
                      aria-label="Pick theme color"
                    />
                    <Input
                      value={companyForm.primaryColor}
                      onChange={(e) => setCompanyForm({ ...companyForm, primaryColor: e.target.value })}
                      placeholder="#059669"
                      className="font-mono max-w-[160px]"
                    />
                    <div
                      className="h-10 px-4 rounded border flex items-center justify-center text-xs font-medium text-white"
                      style={{ backgroundColor: companyForm.primaryColor }}
                    >
                      Preview
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {['#059669', '#0284c7', '#7c3aed', '#d97706', '#dc2626', '#0891b2', '#db2777', '#16a34a'].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCompanyForm({ ...companyForm, primaryColor: c })}
                        className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${companyForm.primaryColor.toLowerCase() === c.toLowerCase() ? 'border-foreground ring-2 ring-offset-2 ring-foreground/30' : 'border-white shadow'}`}
                        style={{ backgroundColor: c }}
                        aria-label={`Use color ${c}`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">Pick a color or click a preset. Applies to buttons, badges, and accents across the app.</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Terms & Conditions</Label>
                  <Textarea value={companyForm.terms} onChange={(e) => setCompanyForm({ ...companyForm, terms: e.target.value })} placeholder="Default terms for invoices..." rows={3} />
                </div>
                <div className="space-y-2">
                  <Label>Authorized Signatory Name</Label>
                  <Input value={companyForm.signatureName} onChange={(e) => setCompanyForm({ ...companyForm, signatureName: e.target.value })} placeholder="Name of authorized signatory" />
                </div>
              </div>

              {/* Action bar: Discard + Reset to Defaults + Save */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t">
                <div className="flex items-center gap-2">
                  {companyIsDirty ? (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-700">
                      <AlertCircle className="h-3 w-3 mr-1" /> Unsaved changes
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-700">
                      <Check className="h-3 w-3 mr-1" /> All changes saved
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={handleDiscardCompanyChanges}
                    disabled={savingCompany || !companyIsDirty}
                    title="Revert form to last saved state"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />Discard Changes
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setResetCompanyOpen(true)}
                    disabled={savingCompany}
                    className="text-destructive hover:bg-destructive/10"
                    title="Clear all company settings back to defaults"
                  >
                    <Eraser className="h-4 w-4 mr-2" />Reset to Defaults
                  </Button>
                  <Button
                    onClick={handleSaveCompany}
                    disabled={savingCompany}
                    className="bg-emerald-600 hover:bg-emerald-700 min-w-[160px]"
                  >
                    {savingCompany ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</> : <><Save className="h-4 w-4 mr-2" />Save Settings</>}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Logo & Branding Tab ───────────────────────────────────────── */}
        <TabsContent value="logo" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImagePlus className="h-5 w-5 text-emerald-600" />
                Company Logo & Branding
              </CardTitle>
              <CardDescription>
                Upload or change your company logo. This logo appears on the sidebar, login page, and all generated documents.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Current Logo Preview */}
              <div className="flex flex-col items-center gap-4 p-6 border-2 border-dashed rounded-xl">
                {companyForm.logoUrl ? (
                  <div className="relative group">
                    <img src={companyForm.logoUrl} alt="Company Logo" className="w-32 h-32 rounded-2xl object-cover border-2 border-emerald-200 dark:border-emerald-800 shadow-lg" />
                    <button
                      onClick={handleRemoveLogo}
                      className="absolute -top-2 -right-2 w-7 h-7 bg-destructive text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="w-32 h-32 rounded-2xl bg-muted flex items-center justify-center border-2 border-dashed">
                    <ImagePlus className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}
                <p className="text-sm text-muted-foreground text-center">
                  {companyForm.logoUrl ? 'Current company logo' : 'No logo uploaded yet'}
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-3 justify-center">
                <Button variant="outline" onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}>
                  {uploadingLogo ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Uploading...</> : <><Upload className="h-4 w-4 mr-2" />Upload Logo</>}
                </Button>
                <Button variant="outline" onClick={handleUseVedaLogo} className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-900/20">
                  <Building2 className="h-4 w-4 mr-2" />
                  Use Veda Logo
                </Button>
                {companyForm.logoUrl && (
                  <Button variant="outline" onClick={handleRemoveLogo} className="text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4 mr-2" />Remove Logo
                  </Button>
                )}
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Supported formats: PNG, JPG, SVG, WEBP. Maximum size: 2MB. Recommended: 200x200px square.
              </p>

              <Separator />

              {/* Primary Color */}
              <div className="space-y-3">
                <Label className="text-base font-medium">Brand Color</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={companyForm.primaryColor}
                    onChange={(e) => setCompanyForm({ ...companyForm, primaryColor: e.target.value })}
                    className="w-12 h-12 rounded-lg border-2 border-border cursor-pointer"
                  />
                  <div className="flex-1">
                    <Input
                      value={companyForm.primaryColor}
                      onChange={(e) => setCompanyForm({ ...companyForm, primaryColor: e.target.value })}
                      placeholder="#059669"
                      className="font-mono"
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCompanyForm({ ...companyForm, primaryColor: '#059669' })
                    }}
                  >
                    Reset to Emerald
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  This color is used for accents, buttons, and highlights across the ERP system.
                </p>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveCompany} disabled={savingCompany} className="bg-emerald-600 hover:bg-emerald-700">
                  {savingCompany ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</> : <><Save className="h-4 w-4 mr-2" />Save Branding</>}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Users & Access Tab ────────────────────────────────────────── */}
        <TabsContent value="users" className="space-y-6">
          {/* Role Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {ROLES.map((role) => (
              <Card key={role} className="border-l-4" style={{ borderLeftColor: role === 'admin' ? '#059669' : role === 'operator' ? '#d97706' : '#0284c7' }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Badge className={ROLE_BADGE_STYLES[role]}>{ROLE_LABELS[role] || role}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-xs text-muted-foreground">{ROLE_PERMISSIONS[role].description}</p>
                  <div className="flex flex-wrap gap-1">
                    {ROLE_PERMISSIONS[role].modules.map((mod) => (
                      <Badge key={mod} variant="outline" className="text-[10px]">{mod}</Badge>
                    ))}
                  </div>
                  <p className="text-xs font-medium">
                    {users.filter((u) => u.role === role).length} user{users.filter((u) => u.role === role).length !== 1 ? 's' : ''} with this role
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* User Management Table */}
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="flex items-center gap-2 flex-wrap">
                  <Users className="h-5 w-5 text-emerald-600" />
                  User Management
                  {selectedUserIds.size > 0 && (
                    <Badge variant="secondary" className="bg-destructive/10 text-destructive border-destructive/30">
                      {selectedUserIds.size} selected
                    </Badge>
                  )}
                </CardTitle>
                <div className="flex flex-wrap gap-2">
                  {/* Bulk action buttons — only visible when rows are selected */}
                  {selectedUserIds.size > 0 && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setBulkUserAction('activate')}
                        disabled={bulkUserLoading}
                        className="text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-700 dark:hover:bg-emerald-900/20"
                      >
                        <Power className="size-4 mr-1.5" />Activate Selected
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setBulkUserAction('deactivate')}
                        disabled={bulkUserLoading}
                        className="text-amber-700 border-amber-300 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-700 dark:hover:bg-amber-900/20"
                      >
                        <PowerOff className="size-4 mr-1.5" />Deactivate Selected
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setBulkUserAction('delete')}
                        disabled={bulkUserLoading}
                        className="text-destructive border-destructive/30 hover:bg-destructive/10"
                      >
                        <Trash2 className="size-4 mr-1.5" />Delete Selected
                        <Badge variant="secondary" className="ml-2 bg-destructive/10 text-destructive border-destructive/30">{selectedUserIds.size}</Badge>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearUserSelection}
                        disabled={bulkUserLoading}
                      >
                        Clear Selection
                      </Button>
                    </>
                  )}
                  <Button onClick={openAddDialog} className="bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="size-4 mr-1" />Add User
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={users.length > 0 && selectedUserIds.size === users.length}
                          onCheckedChange={toggleSelectAllUsers}
                          aria-label="Select all users"
                        />
                      </TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Access</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingUsers ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-8 w-28" /></TableCell>
                        </TableRow>
                      ))
                    ) : users.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                          No users yet. Click &quot;Add User&quot; to create one.
                        </TableCell>
                      </TableRow>
                    ) : (
                      users.map((u) => {
                        const isSelf = u.id === currentUser?.id
                        const perms = ROLE_PERMISSIONS[u.role]
                        const isSelected = selectedUserIds.has(u.id)
                        return (
                          <TableRow
                            key={u.id}
                            data-state={isSelected ? 'selected' : undefined}
                            className={isSelected ? 'bg-emerald-50/60 dark:bg-emerald-900/15' : ''}
                          >
                            <TableCell className="w-10">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleSelectUser(u.id)}
                                aria-label={`Select user ${u.name}`}
                              />
                            </TableCell>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {u.name}
                                {isSelf && <Badge variant="outline" className="text-[10px] px-1.5 py-0">You</Badge>}
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{u.email}</TableCell>
                            <TableCell>
                              <Badge className={ROLE_BADGE_STYLES[u.role] || ''}>{ROLE_LABELS[u.role] || u.role}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={u.active ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' : 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'}>
                                {u.active ? 'Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs text-muted-foreground">{perms?.modules.length || 0} modules</span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="icon" onClick={() => openEditDialog(u)} title="Edit User">
                                  <Pencil className="size-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleToggleActive(u)}
                                  disabled={togglingId === u.id}
                                  title={u.active ? 'Deactivate' : 'Activate'}
                                  className={u.active ? 'text-amber-600 hover:text-amber-700' : 'text-green-600 hover:text-green-700'}
                                >
                                  {togglingId === u.id ? <Loader2 className="size-4 animate-spin" /> : u.active ? <PowerOff className="size-4" /> : <Power className="size-4" />}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setDeleteTarget(u)}
                                  title="Delete User"
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Database Tab ──────────────────────────────────────────────── */}
        <TabsContent value="database" className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Download className="h-5 w-5 text-emerald-600" />
                  Export Backup
                </CardTitle>
                <CardDescription>Download a complete backup of all your ERP data as a JSON file.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={handleExportBackup} disabled={dbLoading} className="w-full bg-emerald-600 hover:bg-emerald-700">
                  {dbLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                  Export Backup
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Upload className="h-5 w-5 text-blue-600" />
                  Restore Backup
                </CardTitle>
                <CardDescription>Restore data from a previously exported backup JSON file.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={handleRestoreBackup} disabled={dbLoading} variant="outline" className="w-full">
                  {dbLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                  Restore Backup
                </Button>
              </CardContent>
            </Card>

            <Card className="border-destructive/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  Clear All Data
                </CardTitle>
                <CardDescription>Permanently delete all data from the system. This cannot be undone.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => setDbAction('clear')} disabled={dbLoading} variant="destructive" className="w-full">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear All Data
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Clear Specific Section — granular section-level delete */}
          <Card className="border-amber-200 dark:border-amber-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Layers className="h-5 w-5 text-amber-600" />
                Clear Specific Section
              </CardTitle>
              <CardDescription>
                Delete all records from a single module — useful for resetting just the Customers, Orders, or Payments data without touching anything else. Cannot be undone.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
                <div className="space-y-2">
                  <Label htmlFor="clear-section-select">Select Section to Clear</Label>
                  <Select value={clearSectionKey} onValueChange={setClearSectionKey}>
                    <SelectTrigger id="clear-section-select">
                      <SelectValue placeholder="Pick a section..." />
                    </SelectTrigger>
                    <SelectContent>
                      {clearableSections.map((s) => (
                        <SelectItem key={s.key} value={s.key} disabled={s.count === 0}>
                          <div className="flex items-center justify-between w-full">
                            <span>{s.label}</span>
                            <Badge variant="outline" className="ml-2 text-[10px]">
                              {s.count} record{s.count === 1 ? '' : 's'}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={() => setClearSectionOpen(true)}
                  disabled={!selectedSectionMeta || selectedSectionMeta.count === 0 || clearSectionLoading || dbLoading}
                  variant="outline"
                  className="text-destructive border-destructive/30 hover:bg-destructive/10 sm:w-auto"
                >
                  <Eraser className="h-4 w-4 mr-2" />
                  Clear Section
                </Button>
              </div>
              {clearableSections.length === 0 && (
                <p className="text-xs text-muted-foreground">Loading sections...</p>
              )}
              {selectedSectionMeta && selectedSectionMeta.count > 0 && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800 dark:text-amber-300">
                    You are about to permanently delete <strong>{selectedSectionMeta.count}</strong> record{selectedSectionMeta.count === 1 ? '' : 's'} from <strong>{selectedSectionMeta.label}</strong>. Consider exporting a backup first.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── AI Assistant Tab ──────────────────────────────────────────── */}
        <TabsContent value="ai" className="space-y-6">
          <AiConfigSection />
        </TabsContent>
      </Tabs>

      {/* ── User Form Dialog ──────────────────────────────────────────────── */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Edit User' : 'Add User'}</DialogTitle>
            <DialogDescription>
              {editingUser ? 'Update user details and role assignment.' : 'Create a new user with appropriate role and access level.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Name <span className="text-destructive">*</span></Label>
              <Input placeholder="Enter full name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Email <span className="text-destructive">*</span></Label>
              <Input type="email" placeholder="Enter email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>
                Password{' '}
                {editingUser ? <span className="text-muted-foreground font-normal">(leave blank to keep existing)</span> : <span className="text-destructive">*</span>}
              </Label>
              <Input type="password" placeholder={editingUser ? 'Leave blank to keep existing' : 'Enter password'} value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Role</Label>
              <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      <div className="flex flex-col">
                        <span>{role}</span>
                        <span className="text-xs text-muted-foreground">{ROLE_PERMISSIONS[role].description.slice(0, 60)}...</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Show access preview */}
            {formData.role && ROLE_PERMISSIONS[formData.role] && (
              <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                <p className="text-sm font-medium">Access Preview:</p>
                <div className="flex flex-wrap gap-1">
                  {ROLE_PERMISSIONS[formData.role].modules.map((mod) => (
                    <Badge key={mod} variant="outline" className="text-xs">{mod}</Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{ROLE_PERMISSIONS[formData.role].description}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={formSubmitting}>Cancel</Button>
            <Button onClick={handleSubmitUser} disabled={formSubmitting} className="bg-emerald-600 hover:bg-emerald-700">
              {formSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              {editingUser ? 'Update User' : 'Create User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete User Confirmation ──────────────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} disabled={deleting} className="bg-destructive text-white hover:bg-destructive/90">
              {deleting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Clear Data Confirmation ───────────────────────────────────────── */}
      <AlertDialog open={dbAction === 'clear'} onOpenChange={(open) => !open && setDbAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Clear All Data
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all customers, productions, orders, dispatches, payments, expenses, and stock data.
              <strong className="block mt-2">This action cannot be undone. Consider exporting a backup first.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={dbLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearData} disabled={dbLoading} className="bg-destructive text-white hover:bg-destructive/90">
              {dbLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
              Clear All Data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Bulk User Action Confirmation ─────────────────────────────────── */}
      <AlertDialog
        open={bulkUserAction !== null}
        onOpenChange={(open) => {
          if (!open && !bulkUserLoading) setBulkUserAction(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              {bulkUserAction === 'delete' && <Trash2 className="h-5 w-5" />}
              {bulkUserAction === 'activate' && <Power className="h-5 w-5 text-emerald-600" />}
              {bulkUserAction === 'deactivate' && <PowerOff className="h-5 w-5 text-amber-600" />}
              {bulkUserAction === 'delete' && `Delete ${selectedUserIds.size} ${selectedUserIds.size === 1 ? 'User' : 'Users'}?`}
              {bulkUserAction === 'activate' && `Activate ${selectedUserIds.size} ${selectedUserIds.size === 1 ? 'User' : 'Users'}?`}
              {bulkUserAction === 'deactivate' && `Deactivate ${selectedUserIds.size} ${selectedUserIds.size === 1 ? 'User' : 'Users'}?`}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              {bulkUserAction === 'delete' && (
                <span className="block">
                  You are about to permanently delete <strong className="text-destructive">{selectedUserIds.size} user{selectedUserIds.size === 1 ? '' : 's'}</strong>.
                  This action <strong>cannot be undone</strong>. You cannot delete your own account or the last active admin.
                </span>
              )}
              {bulkUserAction === 'activate' && (
                <span className="block">
                  You are about to activate <strong>{selectedUserIds.size} user{selectedUserIds.size === 1 ? '' : 's'}</strong>. They will be able to log in immediately.
                </span>
              )}
              {bulkUserAction === 'deactivate' && (
                <span className="block">
                  You are about to deactivate <strong>{selectedUserIds.size} user{selectedUserIds.size === 1 ? '' : 's'}</strong>. They will be signed out and cannot log in until re-activated. You cannot deactivate your own account or the last active admin.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkUserLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkUserConfirm}
              disabled={bulkUserLoading || selectedUserIds.size === 0}
              className={
                bulkUserAction === 'delete'
                  ? 'bg-destructive text-white hover:bg-destructive/90'
                  : bulkUserAction === 'activate'
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-amber-600 text-white hover:bg-amber-700'
              }
            >
              {bulkUserLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
              {bulkUserAction === 'delete' && `Delete ${selectedUserIds.size} ${selectedUserIds.size === 1 ? 'User' : 'Users'}`}
              {bulkUserAction === 'activate' && `Activate ${selectedUserIds.size} ${selectedUserIds.size === 1 ? 'User' : 'Users'}`}
              {bulkUserAction === 'deactivate' && `Deactivate ${selectedUserIds.size} ${selectedUserIds.size === 1 ? 'User' : 'Users'}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Reset Company to Defaults Confirmation ────────────────────────── */}
      <AlertDialog open={resetCompanyOpen} onOpenChange={setResetCompanyOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Eraser className="h-5 w-5 text-destructive" />
              Reset All Company Settings?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will clear <strong>all</strong> company information — name, address, GST/PAN, bank details, prefixes, terms — back to empty defaults.
              The company logo will be preserved. <strong className="block mt-2">This cannot be undone.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingCompany}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetCompanyDefaults}
              disabled={savingCompany}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {savingCompany && <Loader2 className="mr-2 size-4 animate-spin" />}
              Reset to Defaults
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Clear Specific Section Confirmation ───────────────────────────── */}
      <AlertDialog
        open={clearSectionOpen}
        onOpenChange={(open) => {
          if (!open && !clearSectionLoading) setClearSectionOpen(false)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Eraser className="h-5 w-5" />
              Clear {selectedSectionMeta?.label} Section?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong className="text-destructive">{selectedSectionMeta?.count ?? 0}</strong> record{(selectedSectionMeta?.count ?? 0) === 1 ? '' : 's'} from <strong>{selectedSectionMeta?.label}</strong>.
              All other sections (Customers, Orders, Payments, etc.) will be untouched.
              <strong className="block mt-2">This action cannot be undone. Consider exporting a backup first.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearSectionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearSection}
              disabled={clearSectionLoading}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {clearSectionLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
              Clear {selectedSectionMeta?.count ?? 0} Record{(selectedSectionMeta?.count ?? 0) === 1 ? '' : 's'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ── AI Config Section ───────────────────────────────────────────────────────

function AiConfigSection() {
  const { user } = useAppStore()
  const isAdmin = user?.role === 'admin'
  // We need to refresh the shared AI config cache after saving so the
  // floating chat widget + AI Fill buttons re-render and become visible
  // immediately (without requiring a page reload).
  const { refresh: refreshAiConfig } = useAiConfig()

  const [apiKey, setApiKey] = React.useState('')
  const [provider, setProvider] = React.useState<'openai' | 'groq'>('openai')
  const [model, setModel] = React.useState('gpt-4o-mini')
  const [enabled, setEnabled] = React.useState(false)
  const [showKey, setShowKey] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [hasExistingKey, setHasExistingKey] = React.useState(false)
  const [resetLoading, setResetLoading] = React.useState(false)
  const [testing, setTesting] = React.useState(false)
  const [testResult, setTestResult] = React.useState<
    | { ok: boolean; message: string; latencyMs?: number; preview?: string }
    | null
  >(null)

  // ── Test AI Connection ──────────────────────────────────────────────────
  // Sends a tiny ping to the configured AI provider using the SAVED key+model.
  // We intentionally test what's on the server (not the unsaved form state) so
  // the admin gets an accurate picture of what users will experience.
  // If they've just typed a new key but haven't saved yet, we warn them.
  const handleTestConnection = async () => {
    if (!isAdmin) {
      toast({ title: 'Permission denied', description: 'Only admins can test AI.', variant: 'destructive' })
      return
    }
    if (apiKey.trim()) {
      toast({
        title: 'Save first',
        description: 'You have an unsaved API key. Click "Save Configuration" before testing so the test uses the new key.',
        variant: 'destructive',
      })
      return
    }
    setTesting(true)
    setTestResult(null)
    try {
      const res = await api.testAiConnection()
      if (res.ok) {
        setTestResult({
          ok: true,
          message: res.message || 'Connection successful',
          latencyMs: res.latencyMs,
          preview: res.responsePreview,
        })
        toast({
          title: 'AI connection successful',
          description: res.message || 'Test passed.',
        })
      } else {
        const errMsg = res.error || 'Test failed — check the error below.'
        setTestResult({ ok: false, message: errMsg })
        toast({
          title: 'AI test failed',
          description: errMsg,
          variant: 'destructive',
        })
      }
    } catch (e) {
      const errMsg = (e as Error).message || 'Network error during test'
      setTestResult({ ok: false, message: errMsg })
      toast({
        title: 'AI test failed',
        description: errMsg,
        variant: 'destructive',
      })
    } finally {
      setTesting(false)
    }
  }

  // ── Reset AI Configuration ──────────────────────────────────────────────
  // Disables the AI assistant and clears the saved API key from the server.
  // The user can re-enable + re-enter a key later — this is not destructive
  // beyond removing the key.
  const handleResetAi = async () => {
    setResetLoading(true)
    try {
      await api.updateAiConfig({
        provider: 'openai',
        model: 'gpt-4o-mini',
        enabled: false,
        openaiApiKey: '',
      })
      setProvider('openai')
      setModel('gpt-4o-mini')
      setEnabled(false)
      setApiKey('')
      setHasExistingKey(false)
      await refreshAiConfig()
      toast({
        title: 'AI configuration reset',
        description: 'AI Assistant has been disabled and the saved API key has been cleared.',
      })
    } catch (e) {
      toast({
        title: 'Reset failed',
        description: (e as Error).message,
        variant: 'destructive',
      })
    } finally {
      setResetLoading(false)
    }
  }

  // Model presets — change when provider changes
  const MODEL_OPTIONS: Record<'openai' | 'groq', { value: string; label: string }[]> = {
    openai: [
      { value: 'gpt-4o-mini', label: 'gpt-4o-mini (recommended — fast & cheap)' },
      { value: 'gpt-4o', label: 'gpt-4o (more accurate)' },
      { value: 'gpt-4-turbo', label: 'gpt-4-turbo (legacy)' },
      { value: 'gpt-3.5-turbo', label: 'gpt-3.5-turbo (cheapest)' },
    ],
    groq: [
      { value: 'llama-3.3-70b-versatile', label: 'llama-3.3-70b-versatile (recommended — FREE tier)' },
      { value: 'llama-3.1-8b-instant', label: 'llama-3.1-8b-instant (fastest, more free calls)' },
      { value: 'meta-llama/llama-4-scout-17b-16e-instruct', label: 'llama-4-scout-17b (newest)' },
    ],
  }

  const handleProviderChange = (newProvider: 'openai' | 'groq') => {
    setProvider(newProvider)
    // Auto-switch model to the new provider's recommended default
    setModel(MODEL_OPTIONS[newProvider][0].value)
    // Clear the API key field — user must enter the right key for the new provider
    setApiKey('')
    // We don't know yet if there's an existing key for the new provider,
    // so optimistically set to false. handleSave will update hasExistingKey.
    setHasExistingKey(false)
  }

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const cfg = await api.getAiConfig()
        if (cancelled) return
        setProvider(cfg.provider || 'openai')
        setModel(cfg.model || 'gpt-4o-mini')
        setEnabled(!!cfg.enabled)
        setHasExistingKey(!!cfg.hasKey)
        // Don't populate apiKey — backend returns masked version only
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleSave = async () => {
    if (!isAdmin) {
      toast({ title: 'Permission denied', description: 'Only admins can configure AI.', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const payload: {
        provider: 'openai' | 'groq'
        model: string
        enabled: boolean
        openaiApiKey?: string
      } = {
        provider,
        model,
        enabled,
      }
      if (apiKey.trim()) {
        payload.openaiApiKey = apiKey.trim()
      }
      const res = await api.updateAiConfig(payload)
      toast({
        title: 'AI settings saved',
        description: `${provider === 'groq' ? 'Groq' : 'OpenAI'} configuration updated successfully.`,
      })
      setApiKey('')
      setHasExistingKey(!!res.hasKey)
      // Refresh the shared cache so the floating chat button + AI Fill
      // buttons appear immediately across the app (no page reload needed).
      await refreshAiConfig()
    } catch (e) {
      toast({ title: 'Failed to save', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-600" />
            AI Assistant
          </CardTitle>
          <CardDescription>AI-powered voice & text entry helper</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Admin access required</p>
              <p className="text-muted-foreground mt-1">Only admin users can configure AI Assistant settings.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-600" />
            AI Assistant Configuration
          </CardTitle>
          <CardDescription>
            Configure AI provider to enable voice &amp; text entry for all ERP forms.
            Users can speak or type in Hindi/English/Hinglish and forms auto-fill.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Enable / Disable */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              {enabled ? (
                <Power className="h-5 w-5 text-emerald-600" />
              ) : (
                <PowerOff className="h-5 w-5 text-muted-foreground" />
              )}
              <div>
                <Label className="font-medium">AI Assistant Status</Label>
                <p className="text-xs text-muted-foreground">Enable or disable AI features across the app</p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant={enabled ? 'default' : 'outline'}
              onClick={() => setEnabled(!enabled)}
              className={enabled ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
            >
              {enabled ? 'Enabled' : 'Disabled'}
            </Button>
          </div>

          {/* Provider selection */}
          <div className="grid gap-2">
            <Label htmlFor="ai-provider">AI Provider</Label>
            <Select
              value={provider}
              onValueChange={(v) => handleProviderChange(v as 'openai' | 'groq')}
            >
              <SelectTrigger id="ai-provider">
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="groq">
                  <div className="flex flex-col">
                    <span>Groq (Llama 3) — FREE tier available</span>
                    <span className="text-xs text-muted-foreground">
                      1,000 free requests/day on llama-3.3-70b. Recommended for cost.
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="openai">
                  <div className="flex flex-col">
                    <span>OpenAI (GPT-4o / GPT-3.5)</span>
                    <span className="text-xs text-muted-foreground">
                      Best quality, ~₹10-20/month for normal use. Paid only.
                    </span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {provider === 'groq' ? (
                <>
                  🆓 Groq free tier: 1,000 requests/day (70b model) or 14,400/day (8b).
                  Get your free key at{' '}
                  <a
                    href="https://console.groq.com/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-600 hover:underline"
                  >
                    console.groq.com/keys
                  </a>
                  . No credit card needed.
                </>
              ) : (
                <>
                  OpenAI is paid — get your key at{' '}
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-600 hover:underline"
                  >
                    platform.openai.com/api-keys
                  </a>
                  . gpt-4o-mini is recommended (cheap + fast + good Hindi).
                </>
              )}
            </p>
          </div>

          {/* API Key */}
          <div className="grid gap-2">
            <Label htmlFor="ai-api-key">
              {provider === 'groq' ? 'Groq API Key' : 'OpenAI API Key'}
            </Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="ai-api-key"
                  type={showKey ? 'text' : 'password'}
                  placeholder={
                    hasExistingKey
                      ? '•••••••• (saved, leave blank to keep)'
                      : provider === 'groq'
                      ? 'gsk_...'
                      : 'sk-...'
                  }
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="pr-10 font-mono"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowKey(!showKey)}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            {hasExistingKey && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Check className="h-3 w-3" />
                {provider === 'groq' ? 'Groq' : 'OpenAI'} API key is saved. Enter a new key above to replace it.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              The key is stored securely in the database and never exposed to non-admin users.
            </p>
          </div>

          {/* Model selection */}
          <div className="grid gap-2">
            <Label htmlFor="ai-model">Model</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger id="ai-model">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {MODEL_OPTIONS[provider].map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {provider === 'groq' ? (
                <>
                  <strong>llama-3.3-70b-versatile</strong> is recommended — fast, accurate, FREE.
                  Switch to 8b-instant if you need more daily requests (14,400 vs 1,000).
                </>
              ) : (
                <>
                  <strong>gpt-4o-mini</strong> is recommended — it&apos;s fast, accurate enough for form extraction, and very affordable.
                </>
              )}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Configuration
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={testing || !hasExistingKey}
              className="border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
              title={hasExistingKey ? 'Send a tiny ping to verify the saved key + model actually work' : 'Save a key first to enable testing'}
            >
              {testing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  Test Connection
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleResetAi}
              disabled={saving || resetLoading}
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
            >
              {resetLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="mr-2 h-4 w-4" />
              )}
              Reset Configuration
            </Button>
          </div>

          {/* Test Result Card */}
          {testResult && (
            <div
              className={`rounded-lg border p-3 text-sm ${
                testResult.ok
                  ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300'
                  : 'border-rose-300 bg-rose-50 dark:border-rose-700 dark:bg-rose-900/20 text-rose-800 dark:text-rose-300'
              }`}
            >
              <div className="flex items-start gap-2">
                {testResult.ok ? (
                  <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">
                    {testResult.ok ? 'Connection Successful' : 'Connection Failed'}
                  </p>
                  <p className="text-xs mt-0.5 break-words">{testResult.message}</p>
                  {testResult.latencyMs !== undefined && (
                    <p className="text-xs mt-1 opacity-80">Latency: {testResult.latencyMs}ms</p>
                  )}
                  {testResult.preview && (
                    <p className="text-xs mt-1 opacity-80 font-mono break-all">
                      Response: {testResult.preview}
                    </p>
                  )}
                  {!testResult.ok && (
                    <p className="text-xs mt-2 opacity-90">
                      Common fixes:
                      <br />
                      • <b>401 / Incorrect key</b> — re-check the key for typos, no extra spaces
                      <br />
                      • <b>404 / Model not found</b> — pick a different model (some Groq models are deprecated)
                      <br />
                      • <b>429 / Rate limit</b> — free tier exhausted, wait or upgrade
                      <br />
                      • <b>Network error</b> — check internet connection / firewall
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setTestResult(null)}
                  className="text-current opacity-60 hover:opacity-100 shrink-0"
                  aria-label="Dismiss"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How it works</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>1. <strong>Admin configures</strong> the OpenAI API key here (one-time setup).</p>
          <p>2. <strong>Users</strong> see a green "AI" button next to every form (Daily Sell, Production, Customer Payment, etc.).</p>
          <p>3. They click it, <strong>speak or type</strong> in Hindi/English/Hinglish — e.g. "aaj 500 bricks banaye, 2 labour the, 1500 rupee diye".</p>
          <p>4. AI extracts the relevant fields and shows a <strong>preview</strong>. User clicks "Apply to Form" and all fields are auto-filled.</p>
          <p>5. A floating chat button (bottom-right) is also available on every page for hands-free form filling.</p>
          <p className="pt-2 text-xs">Voice input works in Chrome and Edge browsers. Hindi (hi-IN) is the default language.</p>
        </CardContent>
      </Card>
    </div>
  )
}
