'use client'

import { useState } from 'react'
import { api } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/hooks/use-toast'

export default function LoginPage() {
  const { setUser } = useAppStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [initialized, setInitialized] = useState(false)

  const handleInit = async () => {
    try {
      await api.init()
      setInitialized(true)
      toast({ title: 'System initialized', description: 'Default admin user created. Use admin@veda.com / admin123' })
    } catch {
      setInitialized(true)
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-amber-50 dark:from-gray-950 dark:to-gray-900 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center mb-2">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <CardTitle className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">Veda Enterprises</CardTitle>
          <CardDescription>ERP & Management System</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@veda.com"
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
            <Button type="button" variant="outline" className="w-full" onClick={handleInit}>
              Initialize Default Admin
            </Button>
          </form>
          <p className="text-xs text-muted-foreground text-center mt-4">
            Default credentials: admin@veda.com / admin123
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
