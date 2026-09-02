'use client'

import { useState, useEffect, useRef } from 'react'
import { api } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ThemeToggle } from '@/components/erp/theme-toggle'
import { toast } from '@/hooks/use-toast'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp'
import {
  ArrowLeft,
  KeyRound,
  Mail,
  ShieldCheck,
  Eye,
  EyeOff,
  CheckCircle2,
  Clock,
  RefreshCw,
} from 'lucide-react'
import { APP_VERSION } from '@/lib/version'

type Mode = 'login' | 'forgot-email' | 'forgot-otp' | 'forgot-reset' | 'forgot-success'

export default function LoginPage() {
  const { setUser } = useAppStore()

  // Login state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Forgot password state
  const [mode, setMode] = useState<Mode>('login')
  const [forgotEmail, setForgotEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)

  // Cooldown for resend OTP
  const [cooldownSecs, setCooldownSecs] = useState(0)
  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // Company branding
  const [companyName, setCompanyName] = useState('Veda Enterprises')
  const [logoUrl, setLogoUrl] = useState('')

  useEffect(() => {
    api.getCompany().then((data) => {
      const c = data.company as { name?: string; logoUrl?: string } | undefined
      if (c?.name) setCompanyName(c.name)
      if (c?.logoUrl) setLogoUrl(c.logoUrl)
    }).catch(() => {})
  }, [])

  // Cleanup cooldown timer on unmount
  useEffect(() => {
    return () => {
      if (cooldownTimer.current) clearInterval(cooldownTimer.current)
    }
  }, [])

  const startCooldown = (secs: number) => {
    setCooldownSecs(secs)
    if (cooldownTimer.current) clearInterval(cooldownTimer.current)
    cooldownTimer.current = setInterval(() => {
      setCooldownSecs((prev) => {
        if (prev <= 1) {
          if (cooldownTimer.current) clearInterval(cooldownTimer.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const handleInit = async () => {
    try {
      await api.init()
      toast({ title: 'System initialized', description: 'Default admin user created successfully.' })
    } catch {
      // Already initialized
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const result = await api.login({ email, password })
      setUser(result.user)
      toast({ title: 'Welcome back!', description: `Logged in as ${result.user.name}` })
    } catch (err) {
      toast({ title: 'Login failed', description: err instanceof Error ? err.message : 'Invalid credentials', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  // ─── Forgot Password: Step 1 — Send OTP ─────────────────────────────────
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!forgotEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotEmail)) {
      toast({ title: 'Invalid email', description: 'Please enter a valid email address.', variant: 'destructive' })
      return
    }
    setForgotLoading(true)
    try {
      const result = await api.requestOtp({ email: forgotEmail })
      // Start cooldown regardless (60s standard, or whatever the server says)
      startCooldown(result.cooldownSeconds || 60)
      // Move to OTP step
      setMode('forgot-otp')
      // In dev mode (SMTP not configured), the server returns a devPreview
      // with the actual OTP — show it in a toast so the developer can test.
      if (result.devPreview?.otp) {
        toast({
          title: '[DEV] OTP Preview',
          description: `SMTP not configured. Your OTP is: ${result.devPreview.otp}`,
          duration: 10000,
        })
      } else {
        toast({
          title: 'OTP sent',
          description: `A 6-digit OTP has been sent to ${forgotEmail}. Valid for ${result.expiryMinutes} minutes.`,
        })
      }
    } catch (err) {
      toast({
        title: 'Failed to send OTP',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setForgotLoading(false)
    }
  }

  // ─── Forgot Password: Step 2 — Verify OTP ───────────────────────────────
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (otp.length !== 6) {
      toast({ title: 'Invalid OTP', description: 'Please enter all 6 digits.', variant: 'destructive' })
      return
    }
    setForgotLoading(true)
    try {
      const result = await api.verifyOtp({ email: forgotEmail, otp })
      setResetToken(result.resetToken)
      setMode('forgot-reset')
      toast({ title: 'OTP verified', description: 'Now set your new password.' })
    } catch (err) {
      toast({
        title: 'OTP verification failed',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setForgotLoading(false)
    }
  }

  // ─── Forgot Password: Step 3 — Set New Password ─────────────────────────
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 6) {
      toast({ title: 'Password too short', description: 'Password must be at least 6 characters.', variant: 'destructive' })
      return
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'Passwords do not match', description: 'Please re-enter the same password in both fields.', variant: 'destructive' })
      return
    }
    setForgotLoading(true)
    try {
      await api.resetPassword({
        email: forgotEmail,
        resetToken,
        newPassword,
        confirmPassword,
      })
      setMode('forgot-success')
      toast({ title: 'Password updated', description: 'You can now log in with your new password.' })
      // Clear sensitive state
      setOtp('')
      setResetToken('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      toast({
        title: 'Reset failed',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setForgotLoading(false)
    }
  }

  const resetForgotFlow = () => {
    setForgotEmail('')
    setOtp('')
    setResetToken('')
    setNewPassword('')
    setConfirmPassword('')
    setMode('login')
    setCooldownSecs(0)
    if (cooldownTimer.current) clearInterval(cooldownTimer.current)
  }

  // Pre-fill the login email with the forgot-password email (convenience)
  const goToLoginFromSuccess = () => {
    setEmail(forgotEmail)
    setPassword('')
    resetForgotFlow()
  }

  // ─── Render helpers ──────────────────────────────────────────────────────
  const logo = logoUrl ? (
    <img src={logoUrl} alt="Logo" className="w-16 h-16 rounded-2xl object-cover mx-auto mb-2" />
  ) : (
    <div className="mx-auto w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center mb-2">
      <svg className="w-9 h-9 text-white" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M32 4L8 20v8h8v28h12V40h8v16h12V28h8v-8L32 4z" fill="currentColor" opacity="0.9"/>
        <rect x="26" y="28" width="12" height="8" rx="1" fill="currentColor" opacity="0.6"/>
        <path d="M4 52h56v4a4 4 0 01-4 4H8a4 4 0 01-4-4v-4z" fill="currentColor" opacity="0.8"/>
      </svg>
    </div>
  )

  return (
    // min-h-svh (smallest viewport height) instead of min-h-screen: on mobile,
    // 100vh includes the area behind the browser URL bar, so a 100vh-centered
    // card renders BELOW the visible area (looked like "card at the bottom").
    // svh always matches the guaranteed-visible area → true centering.
    <div className="min-h-svh flex items-center justify-center bg-gradient-to-br from-emerald-50 to-amber-50 dark:from-gray-950 dark:to-gray-900 p-4 py-10 relative">
      {/* Theme toggle top right */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center space-y-2">
          {logo}
          <CardTitle className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{companyName}</CardTitle>
          <CardDescription>
            {mode === 'login' && 'ERP & Management System'}
            {mode === 'forgot-email' && 'Forgot Password — Step 1 of 3'}
            {mode === 'forgot-otp' && 'Forgot Password — Step 2 of 3'}
            {mode === 'forgot-reset' && 'Forgot Password — Step 3 of 3'}
            {mode === 'forgot-success' && 'Password Updated Successfully'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* ─── MODE: LOGIN ─────────────────────────────────────────────── */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <button
                    type="button"
                    onClick={() => setMode('forgot-email')}
                    className="text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    <KeyRound className="w-3 h-3" />
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
          )}

          {/* ─── MODE: FORGOT — STEP 1 (Email) ──────────────────────────── */}
          {mode === 'forgot-email' && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg p-3">
                <Mail className="w-4 h-4 flex-shrink-0" />
                <span>Enter your registered email — we&apos;ll send a 6-digit OTP.</span>
              </div>
              <div className="space-y-2">
                <Label htmlFor="forgot-email">Email Address</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="e.g. dataanalogydirector@gmail.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                  autoFocus
                  autoComplete="email"
                />
              </div>
              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={forgotLoading}>
                {forgotLoading ? (
                  <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Sending OTP...</>
                ) : (
                  <><Mail className="w-4 h-4 mr-2" /> Send OTP</>
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={resetForgotFlow}
              >
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Login
              </Button>
            </form>
          )}

          {/* ─── MODE: FORGOT — STEP 2 (OTP) ────────────────────────────── */}
          {mode === 'forgot-otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg p-3">
                <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                <span>
                  Enter the 6-digit OTP sent to <strong className="break-all">{forgotEmail}</strong>
                </span>
              </div>
              <div className="space-y-2">
                <Label>One-Time Password (OTP)</Label>
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={otp}
                    onChange={(v) => setOtp(v)}
                    autoFocus
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} className="h-12 w-12 text-lg" />
                      <InputOTPSlot index={1} className="h-12 w-12 text-lg" />
                      <InputOTPSlot index={2} className="h-12 w-12 text-lg" />
                      <InputOTPSlot index={3} className="h-12 w-12 text-lg" />
                      <InputOTPSlot index={4} className="h-12 w-12 text-lg" />
                      <InputOTPSlot index={5} className="h-12 w-12 text-lg" />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
                  <Clock className="w-3 h-3" />
                  OTP expires in 10 minutes
                </p>
              </div>
              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={forgotLoading || otp.length !== 6}>
                {forgotLoading ? (
                  <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Verifying...</>
                ) : (
                  <><ShieldCheck className="w-4 h-4 mr-2" /> Verify OTP</>
                )}
              </Button>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => setMode('forgot-email')}
                  className="text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <ArrowLeft className="w-3 h-3" /> Change email
                </button>
                {cooldownSecs > 0 ? (
                  <span className="text-muted-foreground">
                    Resend OTP in {cooldownSecs}s
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={forgotLoading}
                    className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${forgotLoading ? 'animate-spin' : ''}`} />
                    Resend OTP
                  </button>
                )}
              </div>

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={resetForgotFlow}
              >
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Login
              </Button>
            </form>
          )}

          {/* ─── MODE: FORGOT — STEP 3 (New Password) ──────────────────── */}
          {mode === 'forgot-reset' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg p-3">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>OTP verified. Set a new password for your account.</span>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="Enter new password (min 6 chars)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    autoFocus
                    autoComplete="new-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    tabIndex={-1}
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    className={`pr-10 ${
                      confirmPassword && confirmPassword !== newPassword
                        ? 'border-rose-500 focus-visible:ring-rose-500/30'
                        : confirmPassword && confirmPassword === newPassword
                        ? 'border-emerald-500 focus-visible:ring-emerald-500/30'
                        : ''
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirmPassword && confirmPassword !== newPassword && (
                  <p className="text-xs text-rose-500">Passwords do not match.</p>
                )}
                {confirmPassword && confirmPassword === newPassword && (
                  <p className="text-xs text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Passwords match.
                  </p>
                )}
              </div>
              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={forgotLoading || !newPassword || !confirmPassword || newPassword !== confirmPassword}>
                {forgotLoading ? (
                  <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Updating...</>
                ) : (
                  <><KeyRound className="w-4 h-4 mr-2" /> Update Password</>
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={resetForgotFlow}
              >
                <ArrowLeft className="w-4 h-4 mr-2" /> Cancel & Back to Login
              </Button>
            </form>
          )}

          {/* ─── MODE: FORGOT — SUCCESS ─────────────────────────────────── */}
          {mode === 'forgot-success' && (
            <div className="space-y-4 text-center">
              <div className="mx-auto w-16 h-16 bg-emerald-100 dark:bg-emerald-950 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-9 h-9 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-semibold">All set!</h3>
                <p className="text-sm text-muted-foreground">
                  Your password has been updated. You can now log in with your new password.
                </p>
              </div>
              <Button
                type="button"
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                onClick={goToLoginFromSuccess}
              >
                Back to Login
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      {/* Version chip — cache/update verification: user can confirm they're on the latest build */}
      <p className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-emerald-700/40 dark:text-emerald-300/30 select-none">
        Veda ERP {APP_VERSION}
      </p>
    </div>
  )
}
