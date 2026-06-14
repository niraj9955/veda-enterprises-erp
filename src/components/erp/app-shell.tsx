'use client'

import { useAppStore, type ModuleKey } from '@/lib/store'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { ThemeToggle } from '@/components/erp/theme-toggle'
import {
  LayoutDashboard,
  Users,
  Factory,
  Package,
  ShoppingCart,
  Truck,
  CreditCard,
  Receipt,
  FileBarChart,
  LogOut,
  Menu,
  ChevronLeft,
  Settings,
  UserCog,
  Building2,
} from 'lucide-react'

const navItems: { key: ModuleKey; label: string; icon: React.ReactNode; roles: string[] }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" />, roles: ['admin'] },
  { key: 'customers', label: 'Customers', icon: <Users className="h-5 w-5" />, roles: ['admin'] },
  { key: 'production', label: 'Production', icon: <Factory className="h-5 w-5" />, roles: ['admin', 'operator'] },
  { key: 'stock', label: 'Stock', icon: <Package className="h-5 w-5" />, roles: ['admin', 'operator'] },
  { key: 'orders', label: 'Orders', icon: <ShoppingCart className="h-5 w-5" />, roles: ['admin'] },
  { key: 'dispatch', label: 'Dispatch', icon: <Truck className="h-5 w-5" />, roles: ['admin', 'operator'] },
  { key: 'payments', label: 'Payments', icon: <CreditCard className="h-5 w-5" />, roles: ['admin', 'accountant'] },
  { key: 'expenses', label: 'Expenses', icon: <Receipt className="h-5 w-5" />, roles: ['admin', 'accountant'] },
  { key: 'reports', label: 'Reports', icon: <FileBarChart className="h-5 w-5" />, roles: ['admin', 'accountant'] },
  { key: 'users', label: 'Users', icon: <UserCog className="h-5 w-5" />, roles: ['admin'] },
  { key: 'settings', label: 'Settings', icon: <Settings className="h-5 w-5" />, roles: ['admin'] },
]

function SidebarContent({ user, activeModule, setActiveModule, sidebarOpen, logout, companyName, companyTagline, logoUrl }: {
  user: { name: string; role: string } | null
  activeModule: ModuleKey
  setActiveModule: (m: ModuleKey) => void
  sidebarOpen: boolean
  logout: () => void
  companyName: string
  companyTagline: string
  logoUrl: string
}) {
  const filteredNav = navItems.filter((item) => user && item.roles.includes(user.role))

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b flex items-center gap-3">
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
        ) : (
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <Building2 className="h-5 w-5 text-white" />
          </div>
        )}
        <div className={cn('overflow-hidden transition-all', sidebarOpen ? 'w-40' : 'w-0')}>
          <h2 className="font-bold text-sm text-emerald-700 dark:text-emerald-400 whitespace-nowrap truncate">{companyName || 'My Company'}</h2>
          <p className="text-xs text-muted-foreground whitespace-nowrap truncate">{companyTagline || 'ERP System'}</p>
        </div>
      </div>

      <ScrollArea className="flex-1 py-2">
        <nav className="space-y-1 px-2">
          {filteredNav.map((item) => (
            <button
              key={item.key}
              onClick={() => setActiveModule(item.key)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                activeModule === item.key
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {item.icon}
              <span className={cn('whitespace-nowrap transition-all', sidebarOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden')}>
                {item.label}
              </span>
            </button>
          ))}
        </nav>
      </ScrollArea>

      <div className="border-t p-3 space-y-2">
        <div className={cn('flex items-center gap-3', !sidebarOpen && 'justify-center')}>
          <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-700 dark:text-emerald-400 font-semibold text-xs flex-shrink-0">
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div className={cn('overflow-hidden transition-all flex-1', sidebarOpen ? 'w-32' : 'w-0')}>
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
          </div>
          {sidebarOpen && <ThemeToggle />}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={logout}
        >
          <LogOut className="h-4 w-4 mr-2" />
          <span className={cn(!sidebarOpen && 'hidden')}>Logout</span>
        </Button>
      </div>
    </div>
  )
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, activeModule, setActiveModule, sidebarOpen, setSidebarOpen, logout, company } = useAppStore()

  const sidebarProps = {
    user, activeModule, setActiveModule, sidebarOpen, logout,
    companyName: company?.name || 'My Company',
    companyTagline: company?.tagline || 'ERP System',
    logoUrl: company?.logoUrl || '',
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden md:flex flex-col border-r bg-white dark:bg-gray-900 transition-all duration-300',
          sidebarOpen ? 'w-56' : 'w-16'
        )}
      >
        <SidebarContent {...sidebarProps} />
        <div className="border-t p-2 flex justify-center">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <ChevronLeft className={cn('h-4 w-4 transition-transform', !sidebarOpen && 'rotate-180')} />
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar for mobile */}
        <header className="md:hidden flex items-center gap-2 p-3 border-b bg-white dark:bg-gray-900">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-56 p-0">
              <SidebarContent {...sidebarProps} />
            </SheetContent>
          </Sheet>
          <h1 className="font-bold text-emerald-700 dark:text-emerald-400 flex-1 truncate">{company?.name || 'My Company'}</h1>
          <ThemeToggle />
        </header>

        <main className="flex-1 overflow-auto">
          <div className="p-4 md:p-6 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
