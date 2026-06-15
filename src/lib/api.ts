const BASE = '/api'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    credentials: 'same-origin',
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

  // Dashboard
  getDashboard: () => request<Record<string, unknown>>('/dashboard'),

  // Customers
  getCustomers: (search?: string) =>
    request<{ customers: unknown[] }>(`/customers${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  createCustomer: (data: Record<string, unknown>) =>
    request<{ customer: unknown }>('/customers', { method: 'POST', body: JSON.stringify(data) }),
  updateCustomer: (id: string, data: Record<string, unknown>) =>
    request<{ customer: unknown }>(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCustomer: (id: string) =>
    request<{ message: string }>(`/customers/${id}`, { method: 'DELETE' }),

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

  // Stock
  getStock: () => request<{ stocks: unknown[] }>('/stock'),

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
  exportBackup: () => request<Record<string, unknown>>('/database'),
  clearData: () => request<{ message: string }>('/database', { method: 'DELETE' }),
  restoreBackup: (data: Record<string, unknown>) =>
    request<{ message: string; counts: Record<string, number> }>('/database', { method: 'PUT', body: JSON.stringify({ data }) }),
}
