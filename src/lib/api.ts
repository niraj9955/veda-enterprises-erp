const BASE = '/api'

// Wrapper around fetch that:
//  1. Disables Next.js caching for ALL requests (we always want fresh data
//     after an import / mutation). This fixes the bug where newly imported
//     rows didn't show up until a hard refresh.
//  2. Adds a cache-busting query param as an extra safety net so even
//     browser/proxy caches can't serve stale responses.
//  3. Reuses the caller-supplied options intact.
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  // Build a URL with a cache-busting _t param for GET requests
  let fullUrl = `${BASE}${url}`
  const method = (options?.method || 'GET').toUpperCase()
  if (method === 'GET') {
    const sep = fullUrl.includes('?') ? '&' : '?'
    fullUrl = `${fullUrl}${sep}_t=${Date.now()}`
  }

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
        zigZagWhite80?: number
        zigZagRed80?: number
        zigZagYellow80?: number
        zigZagWhite60?: number
        zigZagRed60?: number
        zigZagYellow60?: number
        curveStone?: number
        chequreTile?: number
        transportationCharge?: number
        remarks?: string
      }>
      dispatches: unknown[]
      bills: unknown[]
      productFields: Array<{ key: string; label: string; hsn: string }>
      summary: {
        productionCount: number
        dispatchCount: number
        billCount: number
        totalDispatchedQty: number
        totalPreviouslyBilled: number
        totalPreviouslyPaid: number
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

  // Stock
  getStock: () => request<{ stocks: unknown[] }>('/stock'),
  createStock: (data: Record<string, unknown>) =>
    request<{ stock: unknown }>('/stock', { method: 'POST', body: JSON.stringify(data) }),
  updateStock: (id: string, data: Record<string, unknown>) =>
    request<{ stock: unknown }>(`/stock/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteStock: (id: string) =>
    request<{ message: string }>(`/stock/${id}`, { method: 'DELETE' }),

  // Orders
  getOrders: () => request<{ orders: unknown[] }>('/orders'),
  createOrder: (data: Record<string, unknown>) =>
    request<{ order: unknown }>('/orders', { method: 'POST', body: JSON.stringify(data) }),
  updateOrder: (id: string, data: Record<string, unknown>) =>
    request<{ order: unknown }>(`/orders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteOrder: (id: string) =>
    request<{ message: string }>(`/orders/${id}`, { method: 'DELETE' }),

  // Dispatch
  getDispatches: () => request<{ dispatches: unknown[] }>('/dispatch'),
  createDispatch: (data: Record<string, unknown>) =>
    request<{ dispatch: unknown }>('/dispatch', { method: 'POST', body: JSON.stringify(data) }),
  updateDispatch: (id: string, data: Record<string, unknown>) =>
    request<{ dispatch: unknown }>(`/dispatch/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDispatch: (id: string) =>
    request<{ message: string }>(`/dispatch/${id}`, { method: 'DELETE' }),

  // Payments
  getPayments: () => request<{ payments: unknown[] }>('/payments'),
  createPayment: (data: Record<string, unknown>) =>
    request<{ payment: unknown }>('/payments', { method: 'POST', body: JSON.stringify(data) }),
  updatePayment: (id: string, data: Record<string, unknown>) =>
    request<{ payment: unknown }>(`/payments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePayment: (id: string) =>
    request<{ message: string }>(`/payments/${id}`, { method: 'DELETE' }),

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

  // Daily Sell
  getDailySells: () => request<{ dailySells: unknown[] }>('/daily-sell'),
  createDailySell: (data: Record<string, unknown>) =>
    request<{ dailySell: unknown }>('/daily-sell', { method: 'POST', body: JSON.stringify(data) }),
  updateDailySell: (id: string, data: Record<string, unknown>) =>
    request<{ dailySell: unknown }>(`/daily-sell/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDailySell: (id: string) =>
    request<{ message: string }>(`/daily-sell/${id}`, { method: 'DELETE' }),

  // Customer Payment
  getCustomerPayments: () => request<{ customerPayments: unknown[] }>('/customer-payment'),
  createCustomerPayment: (data: Record<string, unknown>) =>
    request<{ customerPayment: unknown }>('/customer-payment', { method: 'POST', body: JSON.stringify(data) }),
  updateCustomerPayment: (id: string, data: Record<string, unknown>) =>
    request<{ customerPayment: unknown }>(`/customer-payment/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCustomerPayment: (id: string) =>
    request<{ message: string }>(`/customer-payment/${id}`, { method: 'DELETE' }),

  // Labour Payment
  getLabourPayments: () => request<{ labourPayments: unknown[] }>('/labour-payment'),
  createLabourPayment: (data: Record<string, unknown>) =>
    request<{ labourPayment: unknown }>('/labour-payment', { method: 'POST', body: JSON.stringify(data) }),
  updateLabourPayment: (id: string, data: Record<string, unknown>) =>
    request<{ labourPayment: unknown }>(`/labour-payment/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteLabourPayment: (id: string) =>
    request<{ message: string }>(`/labour-payment/${id}`, { method: 'DELETE' }),

  // Tractor Payment
  getTractorPayments: () => request<{ tractorPayments: unknown[] }>('/tractor-payment'),
  createTractorPayment: (data: Record<string, unknown>) =>
    request<{ tractorPayment: unknown }>('/tractor-payment', { method: 'POST', body: JSON.stringify(data) }),
  updateTractorPayment: (id: string, data: Record<string, unknown>) =>
    request<{ tractorPayment: unknown }>(`/tractor-payment/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTractorPayment: (id: string) =>
    request<{ message: string }>(`/tractor-payment/${id}`, { method: 'DELETE' }),

  // Dust Purchase
  getDustPurchases: () => request<{ dustPurchases: unknown[] }>('/dust-purchase'),
  createDustPurchase: (data: Record<string, unknown>) =>
    request<{ dustPurchase: unknown }>('/dust-purchase', { method: 'POST', body: JSON.stringify(data) }),
  updateDustPurchase: (id: string, data: Record<string, unknown>) =>
    request<{ dustPurchase: unknown }>(`/dust-purchase/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDustPurchase: (id: string) =>
    request<{ message: string }>(`/dust-purchase/${id}`, { method: 'DELETE' }),

  // Cement Purchase
  getCementPurchases: () => request<{ cementPurchases: unknown[] }>('/cement-purchase'),
  createCementPurchase: (data: Record<string, unknown>) =>
    request<{ cementPurchase: unknown }>('/cement-purchase', { method: 'POST', body: JSON.stringify(data) }),
  updateCementPurchase: (id: string, data: Record<string, unknown>) =>
    request<{ cementPurchase: unknown }>(`/cement-purchase/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCementPurchase: (id: string) =>
    request<{ message: string }>(`/cement-purchase/${id}`, { method: 'DELETE' }),

  // Hardner
  getHardners: () => request<{ hardners: unknown[] }>('/hardner'),
  createHardner: (data: Record<string, unknown>) =>
    request<{ hardner: unknown }>('/hardner', { method: 'POST', body: JSON.stringify(data) }),
  updateHardner: (id: string, data: Record<string, unknown>) =>
    request<{ hardner: unknown }>(`/hardner/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteHardner: (id: string) =>
    request<{ message: string }>(`/hardner/${id}`, { method: 'DELETE' }),

  // Electricity
  getElectricitys: () => request<{ electricitys: unknown[] }>('/electricity'),
  createElectricity: (data: Record<string, unknown>) =>
    request<{ electricity: unknown }>('/electricity', { method: 'POST', body: JSON.stringify(data) }),
  updateElectricity: (id: string, data: Record<string, unknown>) =>
    request<{ electricity: unknown }>(`/electricity/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteElectricity: (id: string) =>
    request<{ message: string }>(`/electricity/${id}`, { method: 'DELETE' }),

  // Factory Stuff
  getFactoryStuffs: () => request<{ factoryStuffs: unknown[] }>('/factory-stuff'),
  createFactoryStuff: (data: Record<string, unknown>) =>
    request<{ factoryStuff: unknown }>('/factory-stuff', { method: 'POST', body: JSON.stringify(data) }),
  updateFactoryStuff: (id: string, data: Record<string, unknown>) =>
    request<{ factoryStuff: unknown }>(`/factory-stuff/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteFactoryStuff: (id: string) =>
    request<{ message: string }>(`/factory-stuff/${id}`, { method: 'DELETE' }),

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
  getReport: (type: string) => request<Record<string, unknown>>(`/reports?type=${type}`),

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
  restoreBackup: (data: Record<string, unknown>) =>
    request<{
      message: string
      counts: Record<string, number>
      errors?: Record<string, string>
    }>('/database', { method: 'PUT', body: JSON.stringify({ data }) }),
}
