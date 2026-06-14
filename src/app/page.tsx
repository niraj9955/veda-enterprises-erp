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
}

export default function Home() {
  const { isAuthenticated, setUser, setActiveModule } = useAppStore()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    // Initialize default admin on first load
    api.init().catch(() => {})
  }, [])

  useEffect(() => {
    // Check if already authenticated via cookie
    const checkAuth = async () => {
      try {
        // Try to fetch dashboard - if it works, we're authenticated
        await api.getDashboard()
        // If we get here without error, session is valid
        // But we need user info - try login page auto-check
        setChecking(false)
      } catch {
        setChecking(false)
      }
    }
    checkAuth()
  }, [])

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading Veda ERP...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginPage />
  }

  const ActiveModule = moduleComponents[useAppStore.getState().activeModule]

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
