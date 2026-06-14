import { create } from 'zustand'

export type ModuleKey = 'dashboard' | 'customers' | 'production' | 'stock' | 'orders' | 'dispatch' | 'payments' | 'expenses' | 'reports'

interface User {
  id: string
  name: string
  email: string
  role: string
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
}))
