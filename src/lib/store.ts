import { create } from 'zustand'

export type ModuleKey = 'dashboard' | 'customers' | 'production' | 'stock' | 'orders' | 'dispatch' | 'payments' | 'expenses' | 'reports' | 'settings' | 'users' | 'admin' | 'dailySell' | 'customerPayment' | 'labourPayment' | 'tractorPayment' | 'dustPurchase' | 'cementPurchase' | 'hardner' | 'electricity' | 'factoryStuff' | 'bills'

interface User {
  id: string
  name: string
  email: string
  role: string
}

export interface CompanyInfo {
  id: string
  name: string
  tagline: string
  address: string
  city: string
  state: string
  pincode: string
  phone: string
  email: string
  gstNumber: string
  panNumber: string
  logoUrl: string
  primaryColor: string
  bankName: string
  bankAccount: string
  bankIfsc: string
  invoicePrefix: string
  dispatchPrefix: string
  orderPrefix: string
  terms: string
  signatureName: string
  setupComplete: boolean
}

interface AppState {
  // Auth
  user: User | null
  isAuthenticated: boolean
  setUser: (user: User | null) => void
  logout: () => void

  // Navigation
  activeModule: ModuleKey
  setActiveModule: (module: ModuleKey) => void

  // Sidebar
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  // True hide/show sidebar (separate from collapse/expand)
  sidebarVisible: boolean
  setSidebarVisible: (visible: boolean) => void

  // Company branding
  company: CompanyInfo | null
  setCompany: (company: CompanyInfo | null) => void
}

const defaultCompany: CompanyInfo = {
  id: '',
  name: 'Veda Enterprises',
  tagline: 'Paver Block ERP',
  address: 'Purushottampur, Muzaffarpur',
  city: 'Muzaffarpur',
  state: 'Bihar',
  pincode: '842002',
  phone: '9572831213',
  email: 'vedaenterprises@gmail.com',
  gstNumber: '',
  panNumber: '',
  logoUrl: '',
  primaryColor: '#059669',
  bankName: '',
  bankAccount: '',
  bankIfsc: '',
  invoicePrefix: 'INV',
  dispatchPrefix: 'DSP',
  orderPrefix: 'ORD',
  terms: '',
  signatureName: 'Authorized Signatory',
  setupComplete: false,
}

export const useAppStore = create<AppState>((set) => ({
  // Auth
  user: null,
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  logout: () => {
    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    set({ user: null, isAuthenticated: false, activeModule: 'dashboard' })
  },

  // Navigation
  activeModule: 'dashboard',
  setActiveModule: (module) => set({ activeModule: module }),

  // Sidebar
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  sidebarVisible: false,
  setSidebarVisible: (visible) => set({ sidebarVisible: visible }),

  // Company branding
  company: defaultCompany,
  setCompany: (company) => set({ company: company || defaultCompany }),
}))
