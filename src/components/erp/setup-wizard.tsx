'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import { toast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Building2, Check, Loader2 } from 'lucide-react'

const STEPS = [
  { id: 1, title: 'Company Details', description: 'Basic company information' },
  { id: 2, title: 'Admin Account', description: 'Manage administrator credentials' },
  { id: 3, title: 'Business Settings', description: 'Invoice, dispatch & bank settings' },
]

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
}

interface AdminForm {
  name: string
  email: string
  password: string
  confirmPassword: string
}

interface BusinessForm {
  invoicePrefix: string
  dispatchPrefix: string
  orderPrefix: string
  bankName: string
  bankAccount: string
  bankIfsc: string
  terms: string
  signatureName: string
}

export default function SetupWizard() {
  const { user, company, setCompany } = useAppStore()
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)

  const [companyForm, setCompanyForm] = useState<CompanyForm>({
    name: '',
    tagline: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    gstNumber: '',
  })

  const [adminForm, setAdminForm] = useState<AdminForm>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })

  const [businessForm, setBusinessForm] = useState<BusinessForm>({
    invoicePrefix: 'INV',
    dispatchPrefix: 'DSP',
    orderPrefix: 'ORD',
    bankName: '',
    bankAccount: '',
    bankIfsc: '',
    terms: '',
    signatureName: '',
  })

  // Pre-fill from existing data
  useEffect(() => {
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
      })
      setBusinessForm({
        invoicePrefix: company.invoicePrefix || 'INV',
        dispatchPrefix: company.dispatchPrefix || 'DSP',
        orderPrefix: company.orderPrefix || 'ORD',
        bankName: company.bankName || '',
        bankAccount: company.bankAccount || '',
        bankIfsc: company.bankIfsc || '',
        terms: company.terms || '',
        signatureName: company.signatureName || '',
      })
    }
    if (user) {
      setAdminForm((prev) => ({
        ...prev,
        name: user.name || '',
        email: user.email || '',
      }))
    }
  }, [company, user])

  // Don't show wizard if setup is already complete
  if (company?.setupComplete) {
    return null
  }

  const validateStep1 = (): boolean => {
    if (!companyForm.name.trim()) {
      toast({ title: 'Validation Error', description: 'Company Name is required', variant: 'destructive' })
      return false
    }
    if (!companyForm.phone.trim()) {
      toast({ title: 'Validation Error', description: 'Phone number is required', variant: 'destructive' })
      return false
    }
    if (!companyForm.address.trim()) {
      toast({ title: 'Validation Error', description: 'Address is required', variant: 'destructive' })
      return false
    }
    if (!companyForm.gstNumber.trim()) {
      toast({ title: 'Validation Error', description: 'GST Number is required', variant: 'destructive' })
      return false
    }
    return true
  }

  const validateStep2 = (): boolean => {
    if (!adminForm.name.trim()) {
      toast({ title: 'Validation Error', description: 'Admin name is required', variant: 'destructive' })
      return false
    }
    if (adminForm.password && adminForm.password !== adminForm.confirmPassword) {
      toast({ title: 'Validation Error', description: 'Passwords do not match', variant: 'destructive' })
      return false
    }
    if (adminForm.password && adminForm.password.length < 6) {
      toast({ title: 'Validation Error', description: 'Password must be at least 6 characters', variant: 'destructive' })
      return false
    }
    return true
  }

  const handleNext = () => {
    if (currentStep === 1 && !validateStep1()) return
    if (currentStep === 2 && !validateStep2()) return
    setCurrentStep((prev) => Math.min(prev + 1, 3))
  }

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1))
  }

  const handleComplete = async () => {
    if (!validateStep1() || !validateStep2()) return

    setLoading(true)
    try {
      // Update admin user if password changed
      if (adminForm.password && user?.id) {
        try {
          await api.updateUser(user.id, {
            name: adminForm.name,
            password: adminForm.password,
          })
        } catch {
          // Non-critical: continue with company setup even if user update fails
        }
      }

      // Update company with all collected data
      const result = await api.updateCompany({
        name: companyForm.name,
        tagline: companyForm.tagline,
        phone: companyForm.phone,
        email: companyForm.email,
        address: companyForm.address,
        city: companyForm.city,
        state: companyForm.state,
        pincode: companyForm.pincode,
        gstNumber: companyForm.gstNumber,
        invoicePrefix: businessForm.invoicePrefix,
        dispatchPrefix: businessForm.dispatchPrefix,
        orderPrefix: businessForm.orderPrefix,
        bankName: businessForm.bankName,
        bankAccount: businessForm.bankAccount,
        bankIfsc: businessForm.bankIfsc,
        terms: businessForm.terms,
        signatureName: businessForm.signatureName,
        setupComplete: true,
      })

      setCompany(result.company as unknown as Parameters<typeof setCompany>[0])
      toast({ title: 'Setup Complete!', description: 'Your ERP system is ready to use.' })
    } catch (err) {
      toast({
        title: 'Setup Failed',
        description: err instanceof Error ? err.message : 'Could not save setup data. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const progressPercent = (currentStep / STEPS.length) * 100

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-amber-50 dark:from-gray-950 dark:to-gray-900 p-4">
      <Card className="w-full max-w-2xl shadow-xl border-emerald-200/50 dark:border-emerald-900/30">
        {/* Header */}
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="mx-auto w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center">
            <Building2 className="h-8 w-8 text-white" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
              Setup Wizard
            </CardTitle>
            <CardDescription className="mt-1">
              Let&apos;s configure your ERP system in a few simple steps
            </CardDescription>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-emerald-100 dark:bg-emerald-900/30 rounded-full h-2 mt-2">
            <div
              className="bg-emerald-600 h-2 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Step Indicators */}
          <div className="flex items-center justify-center gap-0 pt-2">
            {STEPS.map((step, index) => {
              const isCompleted = currentStep > step.id
              const isCurrent = currentStep === step.id

              return (
                <div key={step.id} className="flex items-center">
                  {/* Step Circle */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                        isCompleted
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200 dark:shadow-emerald-900/50'
                          : isCurrent
                            ? 'bg-emerald-600 text-white ring-4 ring-emerald-200 dark:ring-emerald-800/50 shadow-md'
                            : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {isCompleted ? <Check className="h-5 w-5" /> : step.id}
                    </div>
                    <span
                      className={`text-xs mt-1.5 font-medium whitespace-nowrap ${
                        isCurrent
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : isCompleted
                            ? 'text-emerald-600 dark:text-emerald-500'
                            : 'text-muted-foreground'
                      }`}
                    >
                      {step.title}
                    </span>
                  </div>

                  {/* Connector Line */}
                  {index < STEPS.length - 1 && (
                    <div
                      className={`w-16 sm:w-24 h-0.5 mx-1 mb-5 transition-all duration-300 ${
                        currentStep > step.id
                          ? 'bg-emerald-600'
                          : 'bg-muted'
                      }`}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </CardHeader>

        <CardContent className="pt-2">
          {/* Step 1: Company Details */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="companyName">
                    Company Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="companyName"
                    placeholder="Enter company name"
                    value={companyForm.name}
                    onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="tagline">Tagline</Label>
                  <Input
                    id="tagline"
                    placeholder="e.g. Building the future, one brick at a time"
                    value={companyForm.tagline}
                    onChange={(e) => setCompanyForm({ ...companyForm, tagline: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">
                    Phone <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={companyForm.phone}
                    onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="companyEmail">Email</Label>
                  <Input
                    id="companyEmail"
                    type="email"
                    placeholder="info@company.com"
                    value={companyForm.email}
                    onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="address">
                    Address <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="address"
                    placeholder="Enter full address"
                    value={companyForm.address}
                    onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    placeholder="City"
                    value={companyForm.city}
                    onChange={(e) => setCompanyForm({ ...companyForm, city: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    placeholder="State"
                    value={companyForm.state}
                    onChange={(e) => setCompanyForm({ ...companyForm, state: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pincode">Pincode</Label>
                  <Input
                    id="pincode"
                    placeholder="000000"
                    value={companyForm.pincode}
                    onChange={(e) => setCompanyForm({ ...companyForm, pincode: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gstNumber">
                    GST Number <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="gstNumber"
                    placeholder="22AAAAA0000A1Z5"
                    value={companyForm.gstNumber}
                    onChange={(e) => setCompanyForm({ ...companyForm, gstNumber: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Admin Account */}
          {currentStep === 2 && (
            <div className="space-y-4">
              {/* Current admin info card */}
              <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/30 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {adminForm.name?.charAt(0)?.toUpperCase() || 'A'}
                  </div>
                  <div>
                    <p className="font-semibold text-emerald-700 dark:text-emerald-400">Current Admin</p>
                    <p className="text-sm text-muted-foreground">{adminForm.email}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  This is your current administrator account. You can update your name or change your password below.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="adminName">Admin Name</Label>
                  <Input
                    id="adminName"
                    placeholder="Enter admin name"
                    value={adminForm.name}
                    onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <div className="border-t pt-4 mt-2">
                    <p className="text-sm font-medium text-muted-foreground mb-3">Change Password (optional)</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="Enter new password"
                    value={adminForm.password}
                    onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirm new password"
                    value={adminForm.confirmPassword}
                    onChange={(e) => setAdminForm({ ...adminForm, confirmPassword: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Business Settings */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="invoicePrefix">Invoice Prefix</Label>
                  <Input
                    id="invoicePrefix"
                    placeholder="INV"
                    value={businessForm.invoicePrefix}
                    onChange={(e) => setBusinessForm({ ...businessForm, invoicePrefix: e.target.value.toUpperCase() })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dispatchPrefix">Dispatch Prefix</Label>
                  <Input
                    id="dispatchPrefix"
                    placeholder="DSP"
                    value={businessForm.dispatchPrefix}
                    onChange={(e) => setBusinessForm({ ...businessForm, dispatchPrefix: e.target.value.toUpperCase() })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="orderPrefix">Order Prefix</Label>
                  <Input
                    id="orderPrefix"
                    placeholder="ORD"
                    value={businessForm.orderPrefix}
                    onChange={(e) => setBusinessForm({ ...businessForm, orderPrefix: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm font-medium text-muted-foreground mb-3">Bank Details</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bankName">Bank Name</Label>
                  <Input
                    id="bankName"
                    placeholder="Enter bank name"
                    value={businessForm.bankName}
                    onChange={(e) => setBusinessForm({ ...businessForm, bankName: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bankAccount">Account Number</Label>
                  <Input
                    id="bankAccount"
                    placeholder="Enter account number"
                    value={businessForm.bankAccount}
                    onChange={(e) => setBusinessForm({ ...businessForm, bankAccount: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bankIfsc">IFSC Code</Label>
                  <Input
                    id="bankIfsc"
                    placeholder="Enter IFSC code"
                    value={businessForm.bankIfsc}
                    onChange={(e) => setBusinessForm({ ...businessForm, bankIfsc: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm font-medium text-muted-foreground mb-3">Document Settings</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="terms">Terms & Conditions</Label>
                  <Textarea
                    id="terms"
                    placeholder="Enter default terms & conditions for invoices and documents..."
                    value={businessForm.terms}
                    onChange={(e) => setBusinessForm({ ...businessForm, terms: e.target.value })}
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signatureName">Authorized Signatory Name</Label>
                  <Input
                    id="signatureName"
                    placeholder="Name of the authorized signatory"
                    value={businessForm.signatureName}
                    onChange={(e) => setBusinessForm({ ...businessForm, signatureName: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-8 pt-4 border-t">
            <div>
              {currentStep > 1 && (
                <Button variant="outline" onClick={handleBack} disabled={loading}>
                  Back
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Step {currentStep} of {STEPS.length}
              </span>
              {currentStep < STEPS.length ? (
                <Button onClick={handleNext} className="bg-emerald-600 hover:bg-emerald-700">
                  Next
                </Button>
              ) : (
                <Button
                  onClick={handleComplete}
                  disabled={loading}
                  className="bg-emerald-600 hover:bg-emerald-700 min-w-[140px]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Saving...
                    </>
                  ) : (
                    'Complete Setup'
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
