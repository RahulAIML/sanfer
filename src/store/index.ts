import { create } from 'zustand'

export type Language = 'es' | 'en'
export type Theme = 'light' | 'dark'

interface AppState {
  language: Language
  theme: Theme
  sidebarCollapsed: boolean
  aiOpen: boolean
  selectedActivityId: number | null
  selectedLineId: number | null
  dateFrom: string | null
  dateTo: string | null
  mobileMenuOpen: boolean

  setLanguage: (lang: Language) => void
  toggleTheme: () => void
  toggleSidebar: () => void
  setSidebarCollapsed: (v: boolean) => void
  toggleAI: () => void
  setAIOpen: (v: boolean) => void
  setActivityFilter: (id: number | null) => void
  setLineFilter: (id: number | null) => void
  setDateRange: (from: string | null, to: string | null) => void
  clearFilters: () => void
  toggleMobileMenu: () => void
  setMobileMenuOpen: (v: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  language: 'es',
  theme: 'light',
  sidebarCollapsed: false,
  aiOpen: false,
  selectedActivityId: null,
  selectedLineId: null,
  dateFrom: null,
  dateTo: null,
  mobileMenuOpen: false,

  setLanguage: (lang) => set({ language: lang }),
  toggleTheme: () => set((s) => ({ theme: s.theme === 'light' ? 'dark' : 'light' })),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  toggleAI: () => set((s) => ({ aiOpen: !s.aiOpen })),
  setAIOpen: (v) => set({ aiOpen: v }),
  setActivityFilter: (id) => set({ selectedActivityId: id }),
  setLineFilter: (id) => set({ selectedLineId: id }),
  setDateRange: (from, to) => set({ dateFrom: from, dateTo: to }),
  clearFilters: () => set({ selectedActivityId: null, selectedLineId: null, dateFrom: null, dateTo: null }),
  toggleMobileMenu: () => set((s) => ({ mobileMenuOpen: !s.mobileMenuOpen })),
  setMobileMenuOpen: (v) => set({ mobileMenuOpen: v }),
}))
