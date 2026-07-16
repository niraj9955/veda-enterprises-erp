'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ThemeToggle } from '@/components/erp/theme-toggle'
import { toast } from '@/hooks/use-toast'

export default function LoginPage() {
  const { setUser } = useAppStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [companyName, setCompanyName] = useState('Veda Enterprises')
  const [logoUrl, setLogoUrl] = useState('')

  useEffect(() => {
    api.getCompany().then((data) => {
      const c = data.company as { name?: string; logoUrl?: string } | undefined
      if (c?.name) setCompanyName(c.name)
      if (c?.logoUrl) setLogoUrl(c.logoUrl)
    }).catch(() => {})
  }, [])

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-amber-50 dark:from-gray-950 dark:to-gray-900 p-4 relative">
      {/* Theme toggle top right */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center space-y-2">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-16 h-16 rounded-2xl object-cover mx-auto mb-2" />
          ) : (
            <div className="mx-auto w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center mb-2">
              <svg className="w-9 h-9 text-white" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M32 4L8 20v8h8v28h12V40h8v16h12V28h8v-8L32 4z" fill="currentColor" opacity="0.9"/>
                <rect x="26" y="28" width="12" height="8" rx="1" fill="currentColor" opacity="0.6"/>
                <path d="M4 52h56v4a4 4 0 01-4 4H8a4 4 0 01-4-4v-4z" fill="currentColor" opacity="0.8"/>
              </svg>
            </div>
          )}
          <CardTitle className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{companyName}</CardTitle>
          <CardDescription>ERP & Management System</CardDescription>
        </CardHeader>
        <CardContent>
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
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
