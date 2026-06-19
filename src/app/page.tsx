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
import DailySellModule from '@/components/erp/daily-sell-module'
import CustomerPaymentModule from '@/components/erp/customer-payment-module'
import LabourPaymentModule from '@/components/erp/labour-payment-module'
import TractorPaymentModule from '@/components/erp/tractor-payment-module'
import DustPurchaseModule from '@/components/erp/dust-purchase-module'
import CementPurchaseModule from '@/components/erp/cement-purchase-module'
import HardnerModule from '@/components/erp/hardner-module'
import ElectricityModule from '@/components/erp/electricity-module'
import FactoryStuffModule from '@/components/erp/factory-stuff-module'
import BillModule from '@/components/erp/bill-module'

// EAGER imports — every module is bundled into the main chunk so that
// sidebar clicks switch INSTANTLY with zero network round-trip. On a
// 5G/wifi connection the bundle is cached after the first load and the
// whole SPA feels as fast as a desktop app. Lazy loading made every
// module click wait for a separate JS chunk fetch, which the user
// correctly perceived as "slower than before".
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
  dailySell: DailySellModule,
  customerPayment: CustomerPaymentModule,
  labourPayment: LabourPaymentModule,
  tractorPayment: TractorPaymentModule,
  dustPurchase: DustPurchaseModule,
  cementPurchase: CementPurchaseModule,
  hardner: HardnerModule,
  electricity: ElectricityModule,
  factoryStuff: FactoryStuffModule,
  bills: BillModule,
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
        const data = await api.me()
        if (data.user) {
          setUser({
            id: data.user.userId,
            name: data.user.name,
            email: data.user.email,
            role: data.user.role,
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
  const { activeModule, user } = useAppStore()

  // Role-based module access guard
  const accessMap: Record<string, string[]> = {
    admin: ['dashboard', 'customers', 'production', 'stock', 'orders', 'dispatch', 'payments', 'expenses', 'reports', 'settings', 'users', 'admin', 'dailySell', 'customerPayment', 'labourPayment', 'tractorPayment', 'dustPurchase', 'cementPurchase', 'hardner', 'electricity', 'factoryStuff', 'bills'],
    operator: ['dashboard', 'customers', 'production', 'stock', 'orders', 'dispatch', 'payments', 'expenses', 'reports', 'dailySell', 'customerPayment', 'labourPayment', 'tractorPayment', 'dustPurchase', 'cementPurchase', 'hardner', 'electricity', 'factoryStuff', 'bills'],
    accountant: ['dashboard', 'payments', 'expenses', 'reports', 'dailySell', 'customerPayment', 'labourPayment', 'tractorPayment', 'dustPurchase', 'cementPurchase', 'hardner', 'electricity', 'factoryStuff', 'bills'],
  }

  const allowedModules = accessMap[user?.role || ''] || ['dashboard']
  const safeModule = allowedModules.includes(activeModule) ? activeModule : 'dashboard'
  const Component = moduleComponents[safeModule]
  return <Component />
}
