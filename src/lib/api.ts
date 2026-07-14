const BASE = '/api'

// In-process response cache for read-only GET requests. Mutations
// (POST/PUT/DELETE) automatically invalidate the affected endpoints.
// This is intentionally simple — no SWR/React-Query because that would
// require refactoring every component. Instead, GETs are cached for a
// short TTL (default 15s) and the cache is wiped on any mutation.
interface CacheEntry {
  data: unknown
  expiresAt: number
}
const responseCache = new Map<string, CacheEntry>()
const DEFAULT_TTL = 15_000 // 15s — short enough that mutations feel live,
                            // long enough to dedupe rapid identical calls
                            // (e.g. dashboard + daily-sell both calling
                            // /api/stock/summary on mount).

// Endpoints where stale data is unacceptable (e.g. login state). For
// everything else we lean on the cache + mutation invalidation.
const NO_CACHE_URLS = ['/auth/me', '/auth/init']

function invalidateCache(urlPattern?: string) {
  if (!urlPattern) {
    responseCache.clear()
    return
  }
  // Invalidate any cache entry whose URL contains the pattern.
  for (const key of Array.from(responseCache.keys())) {
    if (key.includes(urlPattern)) responseCache.delete(key)
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const fullUrl = `${BASE}${url}`
  const method = (options?.method || 'GET').toUpperCase()

  // 1) Mutation? Bust the cache so the next GET sees fresh data, then
  //    proceed with the network call.
  if (method !== 'GET') {
    // Wildcard invalidation: any mutation likely affects multiple lists.
    invalidateCache()
  }

  // 2) For GETs, try the in-process cache first (unless explicitly opted
  //    out). This dedupes parallel calls and speeds up back navigation.
  if (method === 'GET' && !NO_CACHE_URLS.some((u) => url.includes(u))) {
    const cached = responseCache.get(fullUrl)
    const now = Date.now()
    if (cached && cached.expiresAt > now) {
      return cached.data as T
    }
    const res = await fetch(fullUrl, {
      headers: { 'Content-Type': 'application/json', ...options?.headers },
      credentials: 'same-origin',
      ...options,
    })
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Request failed' }))
      throw new Error(error.error || `HTTP ${res.status}`)
    }
    const data = await res.json()
    responseCache.set(fullUrl, { data, expiresAt: now + DEFAULT_TTL })
    return data as T
  }

  // 3) Non-cacheable GETs (auth state) and all mutations — straight to network.
  const res = await fetch(fullUrl, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    credentials: 'same-origin',
    cache: 'no-store',
    ...options,
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(error.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  // Auth
  init: () => request<{ message: string; user?: unknown }>('/auth/init', { method: 'POST' }),
  login: (data: { email: string; password: string }) =>
    request<{ user: { id: string; name: string; email: string; role: string } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  me: () => request<{ user: { userId: string; name: string; email: string; role: string } }>('/auth/me'),

  // Dashboard
  getDashboard: () => request<Record<string, unknown>>('/dashboard'),
  getDashboardStats: () => request<Record<string, number>>('/dashboard/stats'),

  // Customers
  getCustomers: (search?: string) =>
    request<{ customers: unknown[]; total?: number; page?: number; limit?: number; totalPages?: number }>(`/customers${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  createCustomer: (data: Record<string, unknown>) =>
    request<{ customer: unknown }>('/customers', { method: 'POST', body: JSON.stringify(data) }),
  updateCustomer: (id: string, data: Record<string, unknown>) =>
    request<{ customer: unknown }>(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCustomer: (id: string) =>
    request<{ message: string }>(`/customers/${id}`, { method: 'DELETE' }),
  bulkDeleteCustomers: (ids: string[]) =>
    request<{ message: string; deletedCount: number; requestedCount: number }>('/customers/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),
  getCustomerHistory: (id: string) =>
    request<{ customer: Record<string, unknown>; summary: Record<string, number>; orders: unknown[]; dispatches: unknown[]; payments: unknown[]; customerPayments: unknown[]; timeline: unknown[] }>(`/customers/${id}/history`),
  // Bill-specific history — production + dispatches + previous bills, used
  // by the new full-screen Create Bill page to populate the items table
  // from past production records.
  getCustomerBillHistory: (id: string) =>
    request<{
      customer: { id: string; name: string; mobile?: string; address?: string; gstNumber?: string }
      productions: Array<{
        id: string
        date: string
        customerName?: string
        address?: string
        cement?: number
        zigZagGrey80?: number
        zigZagRed80?: number
        zigZagYellow80?: number
        zigZagGrey60?: number
        zigZagRed60?: number
        zigZagYellow60?: number
        curveStone?: number
        chequreTile?: number
        dumbleGrey80?: number
        dumbleRed80?: number
        dumbleYellow80?: number
        transportationCharge?: number
        remarks?: string
      }>
      dispatches: Array<{
        id: string
        dispatchNumber: string
        truckNumber: string
        driverName?: string
        quantity: number
        brickType: string
        date: string
        orderId?: string
      }>
      bills: Array<{
        id: string
        billNumber: string
        date: string
        grandTotal: number
        paidAmount: number
        balanceAmount: number
        status: string
      }>
      orders: Array<{
        id: string
        orderNumber: string
        brickType?: string
        quantity?: number
        rate?: number
        amount?: number
        deliveryDate: string
        status?: string
        items?: Array<{
          description: string
          hsn?: string
          quantity: number
          unit?: string
          rate: number
          amount: number
        }>
      }>
      payments: Array<{
        id: string
        paymentType: string
        amount: number
        date: string
        remarks?: string
        billId?: string | null
        billNumber?: string
      }>
      productFields: Array<{ key: string; label: string; hsn: string }>
      summary: {
        productionCount: number
        dispatchCount: number
        billCount: number
        orderCount: number
        paymentCount: number
        totalDispatchedQty: number
        totalPreviouslyBilled: number
        totalPreviouslyPaid: number
        totalPaymentsReceived: number
        outstanding: number
        productTotals: Record<string, number>
        dispatchedTotals: Record<string, number>
      }
    }>(`/customers/${id}/bill-history`),

  // Production
  getProduction: (filters?: { date?: string; brickType?: string }) => {
    const params = new URLSearchParams()
    if (filters?.date) params.set('date', filters.date)
    if (filters?.brickType) params.set('brickType', filters.brickType)
    const qs = params.toString()
    return request<{ productions: unknown[] }>(`/production${qs ? `?${qs}` : ''}`)
  },
  createProduction: (data: Record<string, unknown>) =>
    request<{ production: unknown }>('/production', { method: 'POST', body: JSON.stringify(data) }),
  updateProduction: (id: string, data: Record<string, unknown>) =>
    request<{ production: unknown }>(`/production/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProduction: (id: string) =>
    request<{ message: string }>(`/production/${id}`, { method: 'DELETE' }),
  bulkDeleteProductions: (ids: string[]) =>
    request<{ message: string; deletedCount: number; requestedCount: number }>('/production/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),
  deleteAllProductions: () =>
    request<{ message: string; deletedCount: number }>('/production?all=true', { method: 'DELETE' }),

  // Stock
  getStock: () => request<{ stocks: unknown[] }>('/stock'),
  getStockSummary: () =>
    request<{ summary: Array<{ id: string; key: string; name: string; totalProduction: number; sellItem: number; availableQuantity: number; previousYearStock: number; latestDate: string; latestQuantity: number; productionDays: number }> }>('/stock/summary'),
  createStock: (data: Record<string, unknown>) =>
    request<{ stock: unknown }>('/stock', { method: 'POST', body: JSON.stringify(data) }),
  updateStock: (id: string, data: Record<string, unknown>) =>
    request<{ stock: unknown }>(`/stock/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteStock: (id: string) =>
    request<{ message: string }>(`/stock/${id}`, { method: 'DELETE' }),
  // Bulk delete selected stock entries by id.
  bulkDeleteStocks: (ids: string[]) =>
    request<{ message: string; deletedCount: number }>('/stock', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),
  // Delete ALL stock entries (Delete All button).
  deleteAllStocks: () =>
    request<{ message: string; deletedCount: number }>('/stock?all=true', { method: 'DELETE' }),

  // Orders
  getOrders: () => request<{ orders: unknown[] }>('/orders'),
  createOrder: (data: Record<string, unknown>) =>
    request<{ order: unknown }>('/orders', { method: 'POST', body: JSON.stringify(data) }),
  updateOrder: (id: string, data: Record<string, unknown>) =>
    request<{ order: unknown }>(`/orders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteOrder: (id: string) =>
    request<{ message: string }>(`/orders/${id}`, { method: 'DELETE' }),
  bulkDeleteOrders: (ids: string[]) =>
    request<{ message: string; deletedCount: number; requestedCount: number }>('/orders/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),

  // Dispatch
  getDispatches: () => request<{ dispatches: unknown[] }>('/dispatch'),
  createDispatch: (data: Record<string, unknown>) =>
    request<{ dispatch: unknown }>('/dispatch', { method: 'POST', body: JSON.stringify(data) }),
  updateDispatch: (id: string, data: Record<string, unknown>) =>
    request<{ dispatch: unknown }>(`/dispatch/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDispatch: (id: string) =>
    request<{ message: string }>(`/dispatch/${id}`, { method: 'DELETE' }),
  bulkDeleteDispatches: (ids: string[]) =>
    request<{ message: string; deletedCount: number; requestedCount: number }>('/dispatch/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),

  // Payments
  getPayments: () => request<{ payments: unknown[] }>('/payments'),
  createPayment: (data: Record<string, unknown>) =>
    request<{ payment: unknown }>('/payments', { method: 'POST', body: JSON.stringify(data) }),
  updatePayment: (id: string, data: Record<string, unknown>) =>
    request<{ payment: unknown }>(`/payments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePayment: (id: string) =>
    request<{ message: string }>(`/payments/${id}`, { method: 'DELETE' }),
  bulkDeletePayments: (ids: string[]) =>
    request<{ message: string; deletedCount: number; requestedCount: number }>('/payments/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),

  // Expenses
  getExpenses: (filters?: { category?: string; date?: string }) => {
    const params = new URLSearchParams()
    if (filters?.category) params.set('category', filters.category)
    if (filters?.date) params.set('date', filters.date)
    const qs = params.toString()
    return request<{ expenses: unknown[] }>(`/expenses${qs ? `?${qs}` : ''}`)
  },
  createExpense: (data: Record<string, unknown>) =>
    request<{ expense: unknown }>('/expenses', { method: 'POST', body: JSON.stringify(data) }),
  updateExpense: (id: string, data: Record<string, unknown>) =>
    request<{ expense: unknown }>(`/expenses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteExpense: (id: string) =>
    request<{ message: string }>(`/expenses/${id}`, { method: 'DELETE' }),
  bulkDeleteExpenses: (ids: string[]) =>
    request<{ message: string; deletedCount: number; requestedCount: number }>('/expenses/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),

  // Daily Sell
  getDailySells: () => request<{ dailySells: unknown[] }>('/daily-sell'),
  createDailySell: (data: Record<string, unknown>) =>
    request<{ dailySell: unknown }>('/daily-sell', { method: 'POST', body: JSON.stringify(data) }),
  updateDailySell: (id: string, data: Record<string, unknown>) =>
    request<{ dailySell: unknown }>(`/daily-sell/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDailySell: (id: string) =>
    request<{ message: string }>(`/daily-sell/${id}`, { method: 'DELETE' }),
  // Bulk delete selected daily sell entries by id.
  bulkDeleteDailySells: (ids: string[]) =>
    request<{ message: string; deletedCount: number }>('/daily-sell', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),
  // Delete ALL daily sell entries (Delete All button).
  deleteAllDailySells: () =>
    request<{ message: string; deletedCount: number }>('/daily-sell?all=true', { method: 'DELETE' }),

  // Customer Payment
  getCustomerPayments: () => request<{ customerPayments: unknown[] }>('/customer-payment'),
  createCustomerPayment: (data: Record<string, unknown>) =>
    request<{ customerPayment: unknown }>('/customer-payment', { method: 'POST', body: JSON.stringify(data) }),
  updateCustomerPayment: (id: string, data: Record<string, unknown>) =>
    request<{ customerPayment: unknown }>(`/customer-payment/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCustomerPayment: (id: string) =>
    request<{ message: string }>(`/customer-payment/${id}`, { method: 'DELETE' }),
  bulkDeleteCustomerPayments: (ids: string[]) =>
    request<{ message: string; deletedCount: number; requestedCount: number }>('/customer-payment/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),

  // Labour Payment
  getLabourPayments: () => request<{ labourPayments: unknown[] }>('/labour-payment'),
  createLabourPayment: (data: Record<string, unknown>) =>
    request<{ labourPayment: unknown }>('/labour-payment', { method: 'POST', body: JSON.stringify(data) }),
  updateLabourPayment: (id: string, data: Record<string, unknown>) =>
    request<{ labourPayment: unknown }>(`/labour-payment/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteLabourPayment: (id: string) =>
    request<{ message: string }>(`/labour-payment/${id}`, { method: 'DELETE' }),
  bulkDeleteLabourPayments: (ids: string[]) =>
    request<{ message: string; deletedCount: number; requestedCount: number }>('/labour-payment/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),

  // Tractor Payment
  getTractorPayments: () => request<{ tractorPayments: unknown[] }>('/tractor-payment'),
  createTractorPayment: (data: Record<string, unknown>) =>
    request<{ tractorPayment: unknown }>('/tractor-payment', { method: 'POST', body: JSON.stringify(data) }),
  updateTractorPayment: (id: string, data: Record<string, unknown>) =>
    request<{ tractorPayment: unknown }>(`/tractor-payment/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTractorPayment: (id: string) =>
    request<{ message: string }>(`/tractor-payment/${id}`, { method: 'DELETE' }),
  bulkDeleteTractorPayments: (ids: string[]) =>
    request<{ message: string; deletedCount: number; requestedCount: number }>('/tractor-payment/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),

  // Dust Purchase
  getDustPurchases: () => request<{ dustPurchases: unknown[] }>('/dust-purchase'),
  createDustPurchase: (data: Record<string, unknown>) =>
    request<{ dustPurchase: unknown }>('/dust-purchase', { method: 'POST', body: JSON.stringify(data) }),
  updateDustPurchase: (id: string, data: Record<string, unknown>) =>
    request<{ dustPurchase: unknown }>(`/dust-purchase/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDustPurchase: (id: string) =>
    request<{ message: string }>(`/dust-purchase/${id}`, { method: 'DELETE' }),
  bulkDeleteDustPurchases: (ids: string[]) =>
    request<{ message: string; deletedCount: number; requestedCount: number }>('/dust-purchase/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),

  // Cement Purchase
  getCementPurchases: () => request<{ cementPurchases: unknown[] }>('/cement-purchase'),
  createCementPurchase: (data: Record<string, unknown>) =>
    request<{ cementPurchase: unknown }>('/cement-purchase', { method: 'POST', body: JSON.stringify(data) }),
  updateCementPurchase: (id: string, data: Record<string, unknown>) =>
    request<{ cementPurchase: unknown }>(`/cement-purchase/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCementPurchase: (id: string) =>
    request<{ message: string }>(`/cement-purchase/${id}`, { method: 'DELETE' }),
  bulkDeleteCementPurchases: (ids: string[]) =>
    request<{ message: string; deletedCount: number; requestedCount: number }>('/cement-purchase/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),

  // Hardner
  getHardners: () => request<{ hardners: unknown[] }>('/hardner'),
  createHardner: (data: Record<string, unknown>) =>
    request<{ hardner: unknown }>('/hardner', { method: 'POST', body: JSON.stringify(data) }),
  updateHardner: (id: string, data: Record<string, unknown>) =>
    request<{ hardner: unknown }>(`/hardner/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteHardner: (id: string) =>
    request<{ message: string }>(`/hardner/${id}`, { method: 'DELETE' }),
  bulkDeleteHardners: (ids: string[]) =>
    request<{ message: string; deletedCount: number; requestedCount: number }>('/hardner/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),

  // Electricity
  getElectricitys: () => request<{ electricitys: unknown[] }>('/electricity'),
  createElectricity: (data: Record<string, unknown>) =>
    request<{ electricity: unknown }>('/electricity', { method: 'POST', body: JSON.stringify(data) }),
  updateElectricity: (id: string, data: Record<string, unknown>) =>
    request<{ electricity: unknown }>(`/electricity/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteElectricity: (id: string) =>
    request<{ message: string }>(`/electricity/${id}`, { method: 'DELETE' }),
  bulkDeleteElectricitys: (ids: string[]) =>
    request<{ message: string; deletedCount: number; requestedCount: number }>('/electricity/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),

  // Factory Stuff
  getFactoryStuffs: () => request<{ factoryStuffs: unknown[] }>('/factory-stuff'),
  createFactoryStuff: (data: Record<string, unknown>) =>
    request<{ factoryStuff: unknown }>('/factory-stuff', { method: 'POST', body: JSON.stringify(data) }),
  updateFactoryStuff: (id: string, data: Record<string, unknown>) =>
    request<{ factoryStuff: unknown }>(`/factory-stuff/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteFactoryStuff: (id: string) =>
    request<{ message: string }>(`/factory-stuff/${id}`, { method: 'DELETE' }),
  bulkDeleteFactoryStuffs: (ids: string[]) =>
    request<{ message: string; deletedCount: number; requestedCount: number }>('/factory-stuff/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),

  // Bills (Billing system)
  getBills: (filters?: { billType?: string; status?: string; search?: string }) => {
    const params = new URLSearchParams()
    if (filters?.billType) params.set('billType', filters.billType)
    if (filters?.status) params.set('status', filters.status)
    if (filters?.search) params.set('search', filters.search)
    const qs = params.toString()
    return request<{ bills: unknown[] }>(`/bills${qs ? `?${qs}` : ''}`)
  },
  getBill: (id: string) => request<{ bill: Record<string, unknown> }>(`/bills/${id}`),
  createBill: (data: Record<string, unknown>) =>
    request<{ bill: Record<string, unknown> }>('/bills', { method: 'POST', body: JSON.stringify(data) }),
  updateBill: (id: string, data: Record<string, unknown>) =>
    request<{ bill: Record<string, unknown> }>(`/bills/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBill: (id: string) =>
    request<{ message: string }>(`/bills/${id}`, { method: 'DELETE' }),

  // Reports
  // Optional filters: { month?: 'YYYY-MM', from?: 'YYYY-MM-DD', to?: 'YYYY-MM-DD' }
  getReport: (type: string, filters?: { month?: string; from?: string; to?: string }) => {
    const params = new URLSearchParams({ type })
    if (filters?.month) params.set('month', filters.month)
    if (filters?.from) params.set('from', filters.from)
    if (filters?.to) params.set('to', filters.to)
    return request<Record<string, unknown>>(`/reports?${params.toString()}`)
  },

  // Import
  importData: (module: string, data: Record<string, unknown>[]) =>
    request<{ success: boolean; imported: number; total: number; errors?: string[] }>('/import', {
      method: 'POST',
      body: JSON.stringify({ module, data }),
    }),

  // Company Settings
  getCompany: () => request<{ company: Record<string, unknown> }>('/company'),
  updateCompany: (data: Record<string, unknown>) =>
    request<{ company: Record<string, unknown> }>('/company', { method: 'PUT', body: JSON.stringify(data) }),

  // User Management
  getUsers: () => request<{ users: Record<string, unknown>[] }>('/users'),
  createUser: (data: Record<string, unknown>) =>
    request<{ user: Record<string, unknown> }>('/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id: string, data: Record<string, unknown>) =>
    request<{ user: Record<string, unknown> }>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUser: (id: string) =>
    request<{ message: string }>(`/users/${id}`, { method: 'DELETE' }),
  bulkDeleteUsers: (ids: string[]) =>
    request<{ message: string; deletedCount: number; requestedCount: number }>('/users/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),
  bulkUpdateUsers: (ids: string[], active: boolean) =>
    request<{ message: string; modifiedCount: number; matchedCount: number; requestedCount: number; active: boolean }>('/users/bulk-update', {
      method: 'POST',
      body: JSON.stringify({ ids, active }),
    }),

  // Database Management
  exportBackup: () => request<{
    version?: number
    exportedAt?: string
    data: Record<string, unknown[]>
    counts: Record<string, number>
  }>('/database'),
  clearData: () => request<{
    message: string
    cleared?: Record<string, number>
  }>('/database', { method: 'DELETE' }),
  getClearableSections: () => request<{
    sections: { key: string; label: string; count: number }[]
  }>('/database/clear-section'),
  clearSection: (collection: string) =>
    request<{ message: string; collection: string; label: string; deletedCount: number }>('/database/clear-section', {
      method: 'POST',
      body: JSON.stringify({ collection }),
    }),
  restoreBackup: (data: Record<string, unknown>) =>
    request<{
      message: string
      mode?: 'merge'
      counts: { inserted: number; replaced: number }
      perCollection?: Record<string, { inserted: number; replaced: number; skipped: number }>
      errors?: Record<string, string>
    }>('/database', { method: 'PUT', body: JSON.stringify({ data }) }),

  // AI Form-Fill
  aiParse: (module: string, text: string) =>
    request<{ fields: Record<string, unknown>; raw: Record<string, unknown> }>('/ai/parse', {
      method: 'POST',
      body: JSON.stringify({ module, text }),
    }),
  getAiConfig: () =>
    request<{ provider: 'openai' | 'groq'; enabled: boolean; model: string; hasKey: boolean; keyMasked: string }>('/ai/config'),
  updateAiConfig: (data: { provider?: 'openai' | 'groq'; openaiApiKey?: string; enabled?: boolean; model?: string }) =>
    request<{ provider: 'openai' | 'groq'; enabled: boolean; model: string; hasKey: boolean; keyMasked: string }>('/ai/config', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
}
