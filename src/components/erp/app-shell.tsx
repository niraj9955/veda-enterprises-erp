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
  Mail,
  Phone,
  MapPin,
} from 'lucide-react'
import { AiChatWidget } from '@/components/ui/ai-chat-widget'
import { SectionBackButton } from '@/components/erp/section-back-button'
import { InstallAppButton } from '@/components/pwa/install-app-button'

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
  { key: 'quotations', label: 'Quotations', icon: <FileText className="h-4.5 w-4.5" />, roles: ['admin', 'operator', 'accountant'] },
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
// NOTE: The sidebar background is now dark slate (#2D3748), so section
// colors use white-tinted variants that work on top of dark slate. Section
// identity is preserved via the icon's tinted background (e.g. emerald
// section gets a soft emerald-tinted icon chip) while text and active
// states use white for maximum readability on the dark slate nav.
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
    headerText: 'text-white',
    headerBg: 'bg-white/15',
    headerHover: 'hover:bg-white/10',
    iconBg: 'bg-white/30',
    iconText: 'text-white',
    activeItem: 'bg-[#013D29]',
    activeItemText: 'text-white',
    border: 'border-white/25',
  },
  blue: {
    headerText: 'text-white',
    headerBg: 'bg-white/15',
    headerHover: 'hover:bg-white/10',
    iconBg: 'bg-white/30',
    iconText: 'text-white',
    activeItem: 'bg-[#013D29]',
    activeItemText: 'text-white',
    border: 'border-white/25',
  },
  amber: {
    headerText: 'text-white',
    headerBg: 'bg-white/15',
    headerHover: 'hover:bg-white/10',
    iconBg: 'bg-white/30',
    iconText: 'text-white',
    activeItem: 'bg-[#013D29]',
    activeItemText: 'text-white',
    border: 'border-white/25',
  },
  purple: {
    headerText: 'text-white',
    headerBg: 'bg-white/15',
    headerHover: 'hover:bg-white/10',
    iconBg: 'bg-white/30',
    iconText: 'text-white',
    activeItem: 'bg-[#013D29]',
    activeItemText: 'text-white',
    border: 'border-white/25',
  },
  rose: {
    headerText: 'text-white',
    headerBg: 'bg-white/15',
    headerHover: 'hover:bg-white/10',
    iconBg: 'bg-white/30',
    iconText: 'text-white',
    activeItem: 'bg-[#013D29]',
    activeItemText: 'text-white',
    border: 'border-white/25',
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
    <div className="flex flex-col h-full bg-gradient-to-b from-[#02714F] via-[#025C42] to-[#014A36] text-white relative">
      {/* Subtle inner top highlight for 3D depth */}
      <div className="absolute inset-x-0 top-0 h-px bg-white/30 pointer-events-none" />
      {/* Logo / Brand */}
      <div className="p-4 border-b border-white/20 flex items-center gap-3 shrink-0 bg-white/[0.08] backdrop-blur-sm shadow-inner">
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" className="w-10 h-10 rounded-xl object-cover flex-shrink-0 shadow-sm" />
        ) : (
          <div className="w-10 h-10 bg-gradient-to-br from-white/40 to-white/10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg ring-1 ring-white/30">
            <Building2 className="h-5 w-5 text-white" />
          </div>
        )}
        <div className={cn('overflow-hidden transition-all duration-300', sidebarOpen ? 'w-40' : 'w-0')}>
          <h2 className="font-bold text-sm text-white whitespace-nowrap truncate drop-shadow-sm">{companyName || 'Veda Enterprises'}</h2>
          <p className="text-[11px] text-white/70 whitespace-nowrap truncate">{companyTagline || 'Paver Block ERP'}</p>
        </div>
      </div>

      {/* Scrollable Navigation */}
      <ScrollArea className="flex-1 min-h-0 overflow-y-auto">
        <nav className="space-y-1 px-2 py-2">
          {/* Top items: Dashboard + Customers */}
          {filteredTop.map((item) => (
            <button
              key={item.key}
              onClick={() => setActiveModule(item.key)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 active:scale-[0.97]',
                activeModule === item.key
                  ? 'bg-[#013D29] text-white shadow-md ring-1 ring-white/30'
                  : 'text-white/90 hover:bg-white/15 hover:text-white'
              )}
            >
              {item.icon}
              <span className={cn('whitespace-nowrap transition-all duration-300', sidebarOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden')}>
                {item.label}
              </span>
            </button>
          ))}

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-white/25 to-transparent mx-2 my-1" />

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
                    'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200 group active:scale-[0.97]',
                    isActive ? cn(colors.headerText, colors.headerBg) : cn(colors.headerText, colors.headerHover)
                  )}
                >
                  <div className={cn(
                    'flex items-center justify-center w-7 h-7 rounded-md transition-all shrink-0 shadow-sm',
                    isActive || isExpanded ? cn(colors.iconBg, colors.iconText, 'ring-1 ring-white/20') : 'bg-white/10 text-white/80 group-hover:bg-white/20'
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
                          'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium transition-all duration-200 active:scale-[0.97]',
                          activeModule === item.key
                            ? cn(colors.activeItem, colors.activeItemText, 'shadow-md ring-1 ring-white/30')
                            : 'text-white/90 hover:bg-white/15 hover:text-white'
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
          {filteredAdmin.length > 0 && <div className="h-px bg-gradient-to-r from-transparent via-white/15 to-transparent mx-2 my-1" />}

          {/* Admin items */}
          {filteredAdmin.length > 0 && sidebarOpen && (
            <div className="px-3 pb-1 pt-0.5">
              <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Admin</p>
            </div>
          )}
          {filteredAdmin.map((item) => (
            <button
              key={item.key}
              onClick={() => setActiveModule(item.key)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 active:scale-[0.97]',
                activeModule === item.key
                  ? 'bg-[#013D29] text-white shadow-md ring-1 ring-white/30'
                  : 'text-white/90 hover:bg-white/15 hover:text-white'
              )}
            >
              {item.icon}
              <span className={cn('whitespace-nowrap transition-all duration-300', sidebarOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden')}>{item.label}</span>
            </button>
          ))}
        </nav>
      </ScrollArea>


    </div>
  )
}

// Format a 10-digit Indian mobile number as "+91 XXXXX XXXXX" for display.
// Falls back to the original string if it doesn't look like a 10-digit number.
function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  // Handle "9572831213" or "919572831213" or "+919572831213"
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`
  }
  return phone
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, activeModule, setActiveModule, sidebarOpen, setSidebarOpen, sidebarVisible, setSidebarVisible, logout, company } = useAppStore()

  const sidebarProps = {
    user, activeModule, setActiveModule, sidebarOpen, logout,
    companyName: company?.name || 'My Company',
    companyTagline: company?.tagline || 'ERP System',
    logoUrl: company?.logoUrl || '',
  }

  return (
    <div className="flex h-screen bg-[#F1F5F9] dark:bg-gray-950 overflow-hidden">
      {/* Desktop sidebar — fully hidden when sidebarVisible is false */}
      {sidebarVisible && (
        <aside
          className={cn(
            'hidden md:flex flex-col border-r border-black/30 bg-gradient-to-b from-[#02714F] via-[#025C42] to-[#014A36] transition-all duration-300 shadow-2xl ring-1 ring-black/20 h-screen',
            sidebarOpen ? 'w-60' : 'w-16'
          )}
        >
          <div className="flex-1 min-h-0 flex flex-col">
            <SidebarContent {...sidebarProps} />
          </div>
        </aside>
      )}

      {/* Floating "Show Sidebar" button — visible only when sidebar is hidden (edge tab) */}
      {!sidebarVisible && (
        <button
          onClick={() => setSidebarVisible(true)}
          className="hidden md:flex fixed left-0 top-1/2 -translate-y-1/2 z-30 items-center justify-center w-7 h-20 bg-gradient-to-r from-[#014A36] to-[#02714F] text-white rounded-r-xl shadow-2xl ring-1 ring-black/30 hover:w-9 hover:from-[#02714F] hover:to-[#04A56C] transition-all duration-300 group"
          title="Show sidebar"
          aria-label="Show sidebar"
        >
          <ChevronRight className="h-5 w-5 group-hover:animate-pulse" />
          <span className="sr-only">Show sidebar</span>
        </button>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header bar */}
        <header className="relative flex items-center gap-2 px-4 py-2.5 border-b border-black/30 bg-gradient-to-r from-[#02714F] via-[#025C42] to-[#02714F] backdrop-blur-sm sticky top-0 z-10 shrink-0 text-white shadow-lg ring-1 ring-black/20">
          {/* Subtle top highlight for 3D pop */}
          <div className="absolute inset-x-0 top-0 h-px bg-white/30 pointer-events-none" />
          {/* Sidebar toggle button (desktop) — arrow that points in the direction the sidebar will move */}
          <button
            onClick={() => setSidebarVisible(!sidebarVisible)}
            className={cn(
              'group relative hidden md:flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300 shrink-0',
              'bg-gradient-to-br from-[#02714F] to-[#025C42] ring-1 ring-white/25 shadow-md',
              'hover:from-[#025C42] hover:to-[#02714F] hover:shadow-emerald-900/40',
              'active:scale-90'
            )}
            title={sidebarVisible ? 'Hide menu' : 'Show menu'}
            aria-label={sidebarVisible ? 'Hide menu' : 'Show menu'}
          >
            {/* Arrow: ← when sidebar is visible (click to slide it away), → when hidden (click to bring it back) */}
            <span className="relative w-5 h-5 flex items-center justify-center">
              <ChevronLeft
                className={cn(
                  'absolute h-5 w-5 text-white transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
                  sidebarVisible
                    ? 'opacity-100 translate-x-0 rotate-0'
                    : 'opacity-0 -translate-x-1 rotate-0'
                )}
              />
              <ChevronRight
                className={cn(
                  'absolute h-5 w-5 text-white transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
                  sidebarVisible
                    ? 'opacity-0 translate-x-1'
                    : 'opacity-100 translate-x-0'
                )}
              />
            </span>
          </button>
          {/* Mobile menu — animated hamburger toggle (opens Sheet drawer) */}
          <Sheet>
            <SheetTrigger asChild>
              <button
                className="md:hidden group relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-[#02714F] to-[#025C42] ring-1 ring-white/25 shadow-md hover:from-[#025C42] hover:to-[#02714F] active:scale-90 transition-all duration-300 shrink-0"
                title="Open menu"
                aria-label="Open menu"
              >
                <span className="relative w-5 h-5 flex flex-col items-center justify-center gap-[5px]">
                  <span className="block h-[2.5px] w-5 bg-white rounded-full" />
                  <span className="block h-[2.5px] w-5 bg-white rounded-full" />
                  <span className="block h-[2.5px] w-5 bg-white rounded-full" />
                </span>
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-60 p-0">
              <SidebarContent {...sidebarProps} />
            </SheetContent>
          </Sheet>
          <h1 className="font-bold text-white flex-1 truncate text-base drop-shadow-sm">{company?.name || 'Veda Enterprises'}</h1>
          <div className="flex items-center gap-1.5">
            {/* PWA install — always visible (Android + iOS). Hidden if already installed. */}
            <InstallAppButton className="text-white hover:bg-white/15 hover:text-white" />
            <ThemeToggle className="text-white hover:bg-white/15 hover:text-white" />
            <div className="hidden md:flex items-center gap-2 ml-1">
              <div className="w-8 h-8 bg-gradient-to-br from-[#02714F] to-[#025C42] rounded-full flex items-center justify-center text-white font-semibold text-xs shadow-md ring-1 ring-white/30">
                {user?.name?.charAt(0) || 'U'}
              </div>
              <div className="hidden lg:block">
                <p className="text-sm font-medium leading-none text-white">{user?.name}</p>
                <p className="text-[11px] text-white/70 capitalize">{user?.role}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/15 hover:text-white" onClick={logout} title="Logout">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Page content - scrollable */}
        <main className="flex-1 overflow-auto">
          <div className="p-4 md:p-6 max-w-7xl mx-auto">
            {/* Back button — shown on every section except Dashboard.
                Sticky at the top of the scrollable content area so it's
                always reachable without scrolling back up. */}
            <SectionBackButton />
            {children}
          </div>

          {/* Footer */}
          <footer className="bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 text-slate-100 mt-4 shadow-lg">
            <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
              {/* Top row: brand + tagline + contact info in 3 cols */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Brand column */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    {company?.logoUrl ? (
                      <img src={company.logoUrl} alt="Logo" className="w-11 h-11 rounded-xl object-cover shadow-md ring-2 ring-white/20" />
                    ) : (
                      <div className="w-11 h-11 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-md">
                        <Building2 className="h-5 w-5 text-white" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-base text-white tracking-tight">{company?.name || 'Veda Enterprises'}</h3>
                      <p className="text-[11px] text-slate-400">{company?.tagline || 'Paver Block ERP'}</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-300/80 leading-relaxed pr-4">
                    Complete enterprise resource planning system for paver block manufacturing — production, sales, payments, purchases, expenses & reports all in one place.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      v1.0 · Secure
                    </span>
                    <span className="text-slate-500">·</span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-amber-400">
                      <Zap className="h-3 w-3" />
                      AI-assisted
                    </span>
                  </div>
                </div>

                {/* Contact column */}
                <div className="space-y-3">
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Contact</h4>
                  <ul className="space-y-2 text-xs">
                    <li className="flex items-start gap-2.5 text-slate-200">
                      <Mail className="h-3.5 w-3.5 text-emerald-300 mt-0.5 shrink-0" />
                      <a href={`mailto:${company?.email || 'vedaenterprises@gmail.com'}`} className="hover:text-white transition-colors break-all">
                        {company?.email || 'vedaenterprises@gmail.com'}
                      </a>
                    </li>
                    <li className="flex items-start gap-2.5 text-slate-200">
                      <Phone className="h-3.5 w-3.5 text-emerald-400 mt-0.5 shrink-0" />
                      <a href={`tel:${company?.phone || '9572831213'}`} className="hover:text-white transition-colors font-medium">
                        {company?.phone ? formatPhone(company.phone) : '+91 95728 31213'}
                      </a>
                    </li>
                  </ul>
                </div>

                {/* Location column */}
                <div className="space-y-3">
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Location</h4>
                  <div className="flex items-start gap-2.5 text-xs text-slate-200">
                    <MapPin className="h-3.5 w-3.5 text-emerald-400 mt-0.5 shrink-0" />
                    <address className="not-italic leading-relaxed">
                      {company?.address ? (
                        <>
                          {company.address}<br />
                          {[company.city, company.state].filter(Boolean).join(', ')}
                          {company.pincode ? ` - ${company.pincode}` : ''}
                        </>
                      ) : (
                        <>
                          Purushottampur, Muzaffarpur<br />
                          Bihar - 842002<br />
                          India
                        </>
                      )}
                    </address>
                  </div>
                </div>
              </div>

              {/* Bottom row: copyright bar */}
              <div className="mt-7 pt-4 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-2 text-[11px] text-slate-400/80">
                <p>© {new Date().getFullYear()} {(company?.name || 'Veda Enterprises')}. All rights reserved.</p>
                <p className="flex items-center gap-2">
                  <span>Built with Next.js</span>
                  <span className="text-slate-600">·</span>
                  <span>Powered by AI</span>
                </p>
              </div>
            </div>
          </footer>
        </main>
      </div>

      {/* Floating AI chat widget — shown only if AI is enabled in Admin Panel */}
      <AiChatWidget />
    </div>
  )
}
