'use client'

import { useEffect, useState } from 'react'
import { useAppStore, type ModuleKey } from '@/lib/store'
import { api } from '@/lib/api'
import LoginPage from '@/components/erp/login-page'
import AppShell from '@/components/erp/app-shell'
import DashboardModule from '@/components/erp/dashboard-module'
import CustomerModule from '@/components/erp/customer-module'
import ProductionModule from '@/components/erp/production-module'
import StockModule from '@/components/erp/stock-module'
import OrderModule from '@/components/erp/order-module'
import DispatchModule from '@/components/erp/dispatch-module'
import PaymentModule from '@/components/erp/payment-module'
import ExpenseModule from '@/components/erp/expense-module'
import ReportModule from '@/components/erp/report-module'
import SettingsModule from '@/components/erp/settings-module'
import UserManagementModule from '@/components/erp/user-management-module'
import AdminPanelModule from '@/components/erp/admin-panel-module'

const moduleComponents: Record<ModuleKey, React.ComponentType> = {
  dashboard: DashboardModule,
  customers: CustomerModule,
  production: ProductionModule,
  stock: StockModule,
  orders: OrderModule,
  dispatch: DispatchModule,
  payments: PaymentModule,
  expenses: ExpenseModule,
  reports: ReportModule,
  settings: SettingsModule,
  users: UserManagementModule,
  admin: AdminPanelModule,
}

export default function Home() {
  const { isAuthenticated, setUser, setCompany } = useAppStore()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    // Initialize default admin on first load
    api.init().catch(() => {})
  }, [])

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Use a lightweight company endpoint to check auth status
        const data = await api.getCompany()
        if (data.session) {
          // Session exists - user is authenticated
          setUser({
            id: (data.session as Record<string, unknown>).userId as string,
            name: (data.session as Record<string, unknown>).name as string,
            email: (data.session as Record<string, unknown>).email as string,
            role: (data.session as Record<string, unknown>).role as string,
          })
        }
      } catch {
        // Not authenticated - will show login page
      }
      setChecking(false)
    }
    checkAuth()
  }, [setUser])

  // Load company data once authenticated
  useEffect(() => {
    if (isAuthenticated) {
      api.getCompany().then((data) => {
        setCompany(data.company as Parameters<typeof setCompany>[0])
      }).catch(() => {})
    }
  }, [isAuthenticated, setCompany])

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading ERP...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginPage />
  }

  return (
    <AppShell>
      <ModuleRenderer />
    </AppShell>
  )
}

function ModuleRenderer() {
  const activeModule = useAppStore((s) => s.activeModule)
  const Component = moduleComponents[activeModule]
  return <Component />
}
