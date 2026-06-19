'use client'

import { useEffect, useState, lazy, Suspense } from 'react'
import { useAppStore, type ModuleKey } from '@/lib/store'
import { api } from '@/lib/api'
import LoginPage from '@/components/erp/login-page'
import AppShell from '@/components/erp/app-shell'
import DashboardModule from '@/components/erp/dashboard-module'

// Lazy-load every other module so the initial JS bundle stays small.
// Dashboard is the default landing page so it stays eager; everything
// else loads on demand when the user clicks the sidebar item.
const CustomerModule = lazy(() => import('@/components/erp/customer-module'))
const ProductionModule = lazy(() => import('@/components/erp/production-module'))
const StockModule = lazy(() => import('@/components/erp/stock-module'))
const OrderModule = lazy(() => import('@/components/erp/order-module'))
const DispatchModule = lazy(() => import('@/components/erp/dispatch-module'))
const PaymentModule = lazy(() => import('@/components/erp/payment-module'))
const ExpenseModule = lazy(() => import('@/components/erp/expense-module'))
const ReportModule = lazy(() => import('@/components/erp/report-module'))
const SettingsModule = lazy(() => import('@/components/erp/settings-module'))
const UserManagementModule = lazy(() => import('@/components/erp/user-management-module'))
const AdminPanelModule = lazy(() => import('@/components/erp/admin-panel-module'))
const DailySellModule = lazy(() => import('@/components/erp/daily-sell-module'))
const CustomerPaymentModule = lazy(() => import('@/components/erp/customer-payment-module'))
const LabourPaymentModule = lazy(() => import('@/components/erp/labour-payment-module'))
const TractorPaymentModule = lazy(() => import('@/components/erp/tractor-payment-module'))
const DustPurchaseModule = lazy(() => import('@/components/erp/dust-purchase-module'))
const CementPurchaseModule = lazy(() => import('@/components/erp/cement-purchase-module'))
const HardnerModule = lazy(() => import('@/components/erp/hardner-module'))
const ElectricityModule = lazy(() => import('@/components/erp/electricity-module'))
const FactoryStuffModule = lazy(() => import('@/components/erp/factory-stuff-module'))
const BillModule = lazy(() => import('@/components/erp/bill-module'))

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
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <Component />
    </Suspense>
  )
}
