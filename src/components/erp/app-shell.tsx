'use client'

import { useState } from 'react'
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
  ChevronDown,
  ChevronRight,
  Settings,
  UserCog,
  Building2,
  ShieldCheck,
  HardHat,
  Mountain,
  Construction,
  Droplets,
  Zap,
  Wrench,
  Banknote,
  Wallet,
  Flame,
  ClipboardList,
  Briefcase,
  FileText,
} from 'lucide-react'
import { AiChatWidget } from '@/components/ui/ai-chat-widget'

// Navigation structure with collapsible sections
interface NavItem {
  key: ModuleKey
  label: string
  icon: React.ReactNode
  roles: string[]
}

interface NavSection {
  id: string
  label: string
  icon: React.ReactNode
  color: 'emerald' | 'amber' | 'blue' | 'purple' | 'rose'
  roles: string[]
  items: NavItem[]
}

const topItems: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4.5 w-4.5" />, roles: ['admin', 'operator', 'accountant'] },
  { key: 'customers', label: 'Customers', icon: <Users className="h-4.5 w-4.5" />, roles: ['admin', 'operator'] },
  { key: 'bills', label: 'Billing', icon: <FileText className="h-4.5 w-4.5" />, roles: ['admin', 'operator', 'accountant'] },
]

const navSections: NavSection[] = [
  {
    id: 'stock',
    label: 'Stock',
    icon: <Package className="h-4.5 w-4.5" />,
    color: 'emerald',
    roles: ['admin', 'operator', 'accountant'],
    items: [
      { key: 'stock', label: 'Stock Overview', icon: <Package className="h-4 w-4" />, roles: ['admin', 'operator'] },
      { key: 'production', label: 'Production', icon: <Factory className="h-4 w-4" />, roles: ['admin', 'operator'] },
      { key: 'dailySell', label: 'Daily Sell', icon: <ShoppingCart className="h-4 w-4" />, roles: ['admin', 'operator', 'accountant'] },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: <Wallet className="h-4.5 w-4.5" />,
    color: 'blue',
    roles: ['admin', 'operator', 'accountant'],
    items: [
      { key: 'customerPayment', label: 'Customer Payment', icon: <Banknote className="h-4 w-4" />, roles: ['admin', 'operator', 'accountant'] },
      { key: 'labourPayment', label: 'Labour Payment', icon: <HardHat className="h-4 w-4" />, roles: ['admin', 'operator', 'accountant'] },
      { key: 'tractorPayment', label: 'Tractor Payment', icon: <Truck className="h-4 w-4" />, roles: ['admin', 'operator', 'accountant'] },
    ],
  },
  {
    id: 'purchases',
    label: 'Purchases & Expenses',
    icon: <Flame className="h-4.5 w-4.5" />,
    color: 'amber',
    roles: ['admin', 'operator', 'accountant'],
    items: [
      { key: 'dustPurchase', label: 'Dust Purchase', icon: <Mountain className="h-4 w-4" />, roles: ['admin', 'operator', 'accountant'] },
      { key: 'cementPurchase', label: 'Cement Purchase', icon: <Construction className="h-4 w-4" />, roles: ['admin', 'operator', 'accountant'] },
      { key: 'hardner', label: 'Hardner', icon: <Droplets className="h-4 w-4" />, roles: ['admin', 'operator', 'accountant'] },
      { key: 'electricity', label: 'Electricity', icon: <Zap className="h-4 w-4" />, roles: ['admin', 'operator', 'accountant'] },
      { key: 'factoryStuff', label: 'Factory Stuff', icon: <Wrench className="h-4 w-4" />, roles: ['admin', 'operator', 'accountant'] },
    ],
  },
  {
    id: 'management',
    label: 'Management',
    icon: <Briefcase className="h-4.5 w-4.5" />,
    color: 'purple',
    roles: ['admin', 'operator', 'accountant'],
    items: [
      { key: 'orders', label: 'Orders', icon: <ClipboardList className="h-4 w-4" />, roles: ['admin', 'operator'] },
      { key: 'dispatch', label: 'Dispatch', icon: <Truck className="h-4 w-4" />, roles: ['admin', 'operator'] },
      { key: 'payments', label: 'Payments', icon: <CreditCard className="h-4 w-4" />, roles: ['admin', 'operator', 'accountant'] },
      { key: 'expenses', label: 'Expenses', icon: <Receipt className="h-4 w-4" />, roles: ['admin', 'operator', 'accountant'] },
      { key: 'reports', label: 'Reports', icon: <FileBarChart className="h-4 w-4" />, roles: ['admin', 'operator', 'accountant'] },
    ],
  },
]

const adminItems: NavItem[] = [
  { key: 'admin', label: 'Admin Panel', icon: <ShieldCheck className="h-4.5 w-4.5" />, roles: ['admin'] },
  { key: 'users', label: 'Users', icon: <UserCog className="h-4.5 w-4.5" />, roles: ['admin'] },
  { key: 'settings', label: 'Settings', icon: <Settings className="h-4.5 w-4.5" />, roles: ['admin'] },
]

// Color configs for each section
const sectionColors: Record<string, {
  headerText: string
  headerBg: string
  headerHover: string
  iconBg: string
  iconText: string
  activeItem: string
  activeItemText: string
  border: string
}> = {
  emerald: {
    headerText: 'text-emerald-700 dark:text-emerald-400',
    headerBg: 'bg-emerald-50/50 dark:bg-emerald-900/20',
    headerHover: 'hover:bg-emerald-50 dark:hover:bg-emerald-900/20',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
    iconText: 'text-emerald-600 dark:text-emerald-400',
    activeItem: 'bg-emerald-100 dark:bg-emerald-900/30',
    activeItemText: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-200 dark:border-emerald-800/30',
  },
  blue: {
    headerText: 'text-blue-700 dark:text-blue-400',
    headerBg: 'bg-blue-50/50 dark:bg-blue-900/20',
    headerHover: 'hover:bg-blue-50 dark:hover:bg-blue-900/20',
    iconBg: 'bg-blue-100 dark:bg-blue-900/40',
    iconText: 'text-blue-600 dark:text-blue-400',
    activeItem: 'bg-blue-100 dark:bg-blue-900/30',
    activeItemText: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800/30',
  },
  amber: {
    headerText: 'text-amber-700 dark:text-amber-400',
    headerBg: 'bg-amber-50/50 dark:bg-amber-900/20',
    headerHover: 'hover:bg-amber-50 dark:hover:bg-amber-900/20',
    iconBg: 'bg-amber-100 dark:bg-amber-900/40',
    iconText: 'text-amber-600 dark:text-amber-400',
    activeItem: 'bg-amber-100 dark:bg-amber-900/30',
    activeItemText: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-800/30',
  },
  purple: {
    headerText: 'text-purple-700 dark:text-purple-400',
    headerBg: 'bg-purple-50/50 dark:bg-purple-900/20',
    headerHover: 'hover:bg-purple-50 dark:hover:bg-purple-900/20',
    iconBg: 'bg-purple-100 dark:bg-purple-900/40',
    iconText: 'text-purple-600 dark:text-purple-400',
    activeItem: 'bg-purple-100 dark:bg-purple-900/30',
    activeItemText: 'text-purple-700 dark:text-purple-400',
    border: 'border-purple-200 dark:border-purple-800/30',
  },
  rose: {
    headerText: 'text-rose-700 dark:text-rose-400',
    headerBg: 'bg-rose-50/50 dark:bg-rose-900/20',
    headerHover: 'hover:bg-rose-50 dark:hover:bg-rose-900/20',
    iconBg: 'bg-rose-100 dark:bg-rose-900/40',
    iconText: 'text-rose-600 dark:text-rose-400',
    activeItem: 'bg-rose-100 dark:bg-rose-900/30',
    activeItemText: 'text-rose-700 dark:text-rose-400',
    border: 'border-rose-200 dark:border-rose-800/30',
  },
}

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
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    stock: true,
    finance: true,
    purchases: true,
    management: false,
  })

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const userRole = user?.role || ''

  const filterByRole = (items: NavItem[]) => items.filter((item) => item.roles.includes(userRole))
  const sectionVisible = (section: NavSection) => section.roles.includes(userRole) && filterByRole(section.items).length > 0

  const filteredTop = filterByRole(topItems)
  const filteredAdmin = filterByRole(adminItems)

  // Check if any sub-item is active in a section
  const isSectionActive = (section: NavSection) =>
    section.items.some((item) => item.key === activeModule)

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-white to-gray-50/80 dark:from-gray-900 dark:to-gray-950/80">
      {/* Logo / Brand */}
      <div className="p-4 border-b border-border/50 flex items-center gap-3 shrink-0">
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" className="w-10 h-10 rounded-xl object-cover flex-shrink-0 shadow-sm" />
        ) : (
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
            <Building2 className="h-5 w-5 text-white" />
          </div>
        )}
        <div className={cn('overflow-hidden transition-all duration-300', sidebarOpen ? 'w-40' : 'w-0')}>
          <h2 className="font-bold text-sm text-emerald-700 dark:text-emerald-400 whitespace-nowrap truncate">{companyName || 'Veda Enterprises'}</h2>
          <p className="text-[11px] text-muted-foreground whitespace-nowrap truncate">{companyTagline || 'Paver Block ERP'}</p>
        </div>
      </div>

      {/* Scrollable Navigation */}
      <ScrollArea className="flex-1 overflow-y-auto">
        <nav className="space-y-1 px-2 py-2">
          {/* Top items: Dashboard + Customers */}
          {filteredTop.map((item) => (
            <button
              key={item.key}
              onClick={() => setActiveModule(item.key)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                activeModule === item.key
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 shadow-sm'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              {item.icon}
              <span className={cn('whitespace-nowrap transition-all duration-300', sidebarOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden')}>
                {item.label}
              </span>
            </button>
          ))}

          {/* Divider */}
          <div className="h-px bg-border/40 mx-2 my-1" />

          {/* Collapsible Sections */}
          {navSections.filter(sectionVisible).map((section) => {
            const colors = sectionColors[section.color]
            const isActive = isSectionActive(section)
            const isExpanded = expandedSections[section.id]

            return (
              <div key={section.id}>
                {/* Section Header - Clickable to expand/collapse */}
                <button
                  onClick={() => toggleSection(section.id)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200 group',
                    isActive ? cn(colors.headerText, colors.headerBg) : cn(colors.headerText, colors.headerHover)
                  )}
                >
                  <div className={cn(
                    'flex items-center justify-center w-7 h-7 rounded-md transition-all shrink-0',
                    isActive || isExpanded ? cn(colors.iconBg, colors.iconText) : 'bg-muted text-muted-foreground group-hover:bg-accent'
                  )}>
                    {section.icon}
                  </div>
                  <span className={cn('whitespace-nowrap transition-all duration-300 flex-1 text-left', sidebarOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden')}>
                    {section.label}
                  </span>
                  {sidebarOpen && (
                    <div className={cn('transition-transform duration-200', isExpanded ? 'rotate-0' : '-rotate-90')}>
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  )}
                </button>

                {/* Sub-items - Collapsible */}
                <div className={cn(
                  'overflow-hidden transition-all duration-300 ease-in-out',
                  isExpanded && sidebarOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
                )}>
                  <div className={cn('ml-4 pl-3 border-l-2 space-y-0.5 py-1', colors.border)}>
                    {filterByRole(section.items).map((item) => (
                      <button
                        key={item.key}
                        onClick={() => setActiveModule(item.key)}
                        className={cn(
                          'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium transition-all duration-200',
                          activeModule === item.key
                            ? cn(colors.activeItem, colors.activeItemText)
                            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                        )}
                      >
                        {item.icon}
                        <span className="whitespace-nowrap">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}

          {/* Divider */}
          {filteredAdmin.length > 0 && <div className="h-px bg-border/40 mx-2 my-1" />}

          {/* Admin items */}
          {filteredAdmin.length > 0 && sidebarOpen && (
            <div className="px-3 pb-1 pt-0.5">
              <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">Admin</p>
            </div>
          )}
          {filteredAdmin.map((item) => (
            <button
              key={item.key}
              onClick={() => setActiveModule(item.key)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                activeModule === item.key
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 shadow-sm'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              {item.icon}
              <span className="whitespace-nowrap">{item.label}</span>
            </button>
          ))}
        </nav>
      </ScrollArea>


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
          'hidden md:flex flex-col border-r border-border/50 bg-white dark:bg-gray-900 transition-all duration-300 shadow-sm',
          sidebarOpen ? 'w-60' : 'w-16'
        )}
      >
        <SidebarContent {...sidebarProps} />
        <div className="border-t border-border/50 p-2 flex justify-center shrink-0">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} className="hover:bg-accent">
            {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header bar */}
        <header className="flex items-center gap-2 px-4 py-2.5 border-b border-border/50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10 shrink-0">
          {/* Mobile menu */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-60 p-0">
              <SidebarContent {...sidebarProps} />
            </SheetContent>
          </Sheet>
          <h1 className="font-bold text-emerald-700 dark:text-emerald-400 flex-1 truncate text-base">{company?.name || 'Veda Enterprises'}</h1>
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <div className="hidden md:flex items-center gap-2 ml-1">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center text-white font-semibold text-xs shadow-sm">
                {user?.name?.charAt(0) || 'U'}
              </div>
              <div className="hidden lg:block">
                <p className="text-sm font-medium leading-none">{user?.name}</p>
                <p className="text-[11px] text-muted-foreground capitalize">{user?.role}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={logout} title="Logout">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Page content - scrollable */}
        <main className="flex-1 overflow-auto">
          <div className="p-4 md:p-6 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Floating AI chat widget — shown only if AI is enabled in Admin Panel */}
      <AiChatWidget />
    </div>
  )
}
