# Veda ERP — Complete API Reference

> **Base URL**: `/api`
> **Auth model**: JWT in `token` httpOnly cookie, validated via `requireSession()` (any logged-in user), `requireAdmin()` (role=admin), `requireRole([...])` (whitelisted roles), or `getSession()` (manual check).
> **Roles**: `admin`, `operator`, `accountant` (accountant is read-only for most destructive ops).
> **`[id]` path params** are MongoDB ObjectId strings unless otherwise noted.
> All routes use `force-dynamic` + `Cache-Control: no-store` so they reflect the latest DB state.

**Quick stats**: 79 route files, 13 logical sections. Every collection module follows the pattern `/<module>` (GET list + POST create), `/<module>/[id]` (GET / PUT / DELETE), `/<module>/bulk-delete` (POST with `{ ids: string[] }`).

---

## Section 1: Authentication & Users

### POST /api/auth/login
- **Auth**: Open
- **Purpose**: User login with email+password; issues JWT in httpOnly cookie (maxAge 86400s/24h).
- **Body**: `{ email: string, password: string }` (max 256 chars each)
- **Response**: `{ message: 'Login successful', user: { id, name, email, role } }` + sets `token` cookie. 401 on bad creds. Uses dummy bcrypt compare to prevent user enumeration via timing.

### POST /api/auth/init
- **Auth**: Open (but refuses if any users exist; optional `FIRST_RUN_KEY` env gate via `X-First-Run-Key` header or `?key=` query)
- **Purpose**: First-run system initialization — seeds the initial admin (`dataanalogydirector@gmail.com` / `admin123`) and Veda Enterprises company record. Refuses if `User.countDocuments > 0`.
- **Body**: none
- **Response**: `{ message, user: { id, name, email, role } }` (201) or `{ message: 'Users already exist...' }` (400).

### GET /api/auth/me
- **Auth**: `requireSession` (getSession)
- **Purpose**: Returns the currently logged-in user's session payload.
- **Response**: `{ user: { userId, email, role, name } }` or 401.

### POST /api/auth/reset-admin
- **Auth**: Gated by `EMERGENCY_RESET_KEY` env var (≥8 chars) supplied via `X-Emergency-Reset-Key` header or `?key=` query. Timing-safe comparison. Returns 503 if env var unset.
- **Purpose**: Emergency admin password reset — resets `admin@veda.com` (or first admin user) to `admin123`, reactivates account, or creates a fresh admin if none exists.
- **Body**: none
- **Response**: `{ message, credentials: { email, password: 'admin123' }, userId, action: 'reset'|'created', note? }`.

### POST /api/auth/forgot-password/request-otp
- **Auth**: Open
- **Purpose**: Generates a 6-digit OTP, bcrypt-hashes it, stores in `PasswordReset` collection with 10-min TTL, emails it. Always returns 200 (no user enumeration). Rate-limited: 1 OTP/email/60s.
- **Body**: `{ email: string }`
- **Response**: `{ message, email, expiryMinutes: 10, emailConfigured?, devPreview? }` (200) or 429 with `cooldownSeconds` if rate-limited.

### POST /api/auth/forgot-password/verify-otp
- **Auth**: Open
- **Purpose**: Validates OTP against latest unused `PasswordReset` doc for the email. Max 5 attempts. On success issues a 10-min signed `resetToken` JWT (`purpose: 'password-reset'`).
- **Body**: `{ email: string, otp: string }` (otp = 6 digits)
- **Response**: `{ message, resetToken, email }` or 401/410/429 with `attemptsLeft`.

### POST /api/auth/forgot-password/reset
- **Auth**: Open (requires valid `resetToken` from verify-otp step)
- **Purpose**: Sets new password. Verifies resetToken JWT, checks `PasswordReset` doc is still `verified && !used`, updates password (bcrypt rounds=12), marks doc as used (no replay).
- **Body**: `{ email, resetToken, newPassword, confirmPassword }` (min 6, max 256 chars; newPassword must equal confirmPassword)
- **Response**: `{ message, email }` or 401/403/404.

### GET /api/users
- **Auth**: `requireAdmin`
- **Purpose**: List all users (passwords stripped), newest first.
- **Response**: `{ users: User[] }`.

### POST /api/users
- **Auth**: `requireAdmin`
- **Purpose**: Create a new user.
- **Body**: `{ name: string, email: string (valid email), password: string (≥6 chars), role: 'admin'|'operator'|'accountant', active?: boolean }`
- **Response**: `{ user: UserWithoutPassword }` (201). 400 on duplicate email/invalid role/short password.

### GET /api/users/[id]
- **Auth**: `requireAdmin`
- **Purpose**: Fetch one user by ObjectId.
- **Response**: `{ user: UserWithoutPassword }` or 404.

### PUT /api/users/[id]
- **Auth**: `requireAdmin`
- **Purpose**: Update user fields. Optional password change (re-hashed at rounds=12).
- **Body**: partial `{ name?, email?, role?, active?, password? }`
- **Response**: `{ user: UserWithoutPassword }`.

### DELETE /api/users/[id]
- **Auth**: `requireAdmin`
- **Purpose**: Delete a user. Blocks self-delete. Blocks deleting the last active admin.
- **Response**: `{ message: 'User deleted successfully' }` or 400 (self-delete / last admin).

### POST /api/users/bulk-delete
- **Auth**: `getSession` + manual `role === 'admin'` check (admin only)
- **Body**: `{ ids: string[] }` (non-empty)
- **Purpose**: Bulk delete users. Blocks self-delete and last-admin deletion.
- **Response**: `{ message, deletedCount, requestedCount }` or 404 if none matched.

### POST /api/users/bulk-update
- **Auth**: `getSession` + manual `role === 'admin'` check (admin only)
- **Body**: `{ ids: string[], active: boolean }`
- **Purpose**: Bulk activate/deactivate users. Blocks self-deactivation and last-admin deactivation.
- **Response**: `{ message, modifiedCount, matchedCount, requestedCount, active }`.

---

## Section 2: Company & Settings

### GET /api/company
- **Auth**: `requireSession`
- **Purpose**: Fetch the single Company record (creates one with Veda defaults if missing; backfills empty contact fields; migrates stale tagline strings like "Paper Block ERP" → "Paver Block ERP").
- **Response**: `{ company: Company }` (fields: name, tagline, address, city, state, pincode, phone, email, gstNumber, panNumber, logoUrl, primaryColor, bankName, bankAccount, bankIfsc, invoicePrefix, dispatchPrefix, orderPrefix, terms, signatureName, setupComplete).

### PUT /api/company
- **Auth**: `requireAdmin`
- **Purpose**: Update company fields. Auto-marks `setupComplete=true` once name+address+phone+gstNumber are all present.
- **Body**: partial of any of the fields above.
- **Response**: `{ company: Company }`.

---

## Section 3: Dashboard & Reports

### GET /api/dashboard
- **Auth**: `requireSession`
- **Purpose**: "Classic" dashboard aggregate — today's production, total stock, today's dispatch, pending orders, outstanding payments, monthly sales/profit/expense, recent productions + dispatches, monthly production + expense chart data. Uses parallel queries + `$group` aggregations.
- **Response**: `{ todayProduction, totalStock, todayDispatch, pendingOrders, outstandingPayments, monthlySales, monthlyProfit, recentProductions, recentDispatches, monthlyProductionData, monthlyExpenseData }`.

### GET /api/dashboard/stats
- **Auth**: `requireSession`
- **Purpose**: Single-call KPI endpoint (replaces 11 separate dashboard calls). Aggregates today's production/sales/labour/customer-payments/tractor-remaining/dust/cement/hardner/electricity/factory-stuff + stock totals + net cash flow.
- **Response**: `{ todayProduction, todaySales, todayLabourPayments, todayCustomerPayments, totalTractorRemaining, todayDustPurchase, todayCementPurchase, todayHardner, todayElectricity, todayFactoryStuff, totalStock, totalStockCement, totalExpensesToday, netCashFlow }`.

### GET /api/reports
- **Auth**: `requireSession`
- **Purpose**: Multi-mode report generator (switch on `?type=`).
- **Query params**: `type` ∈ `sales`|`production`|`stock`|`profit-loss`|`outstanding`|`customer-ledger` (default `sales`); optional `month=YYYY-MM`, `from=YYYY-MM-DD`, `to=YYYY-MM-DD` for date filtering.
- **Response** varies by `type`:
  - `sales`: `{ data: SalesRow[], totalSales }` — source `DailySell`
  - `production`: `{ data: ProductionRow[], totalProduced, byBrickType }` — flattens 12 product columns per Production row
  - `stock`: `{ data: StockRow[], totalCurrentStock, totalOpeningStock, lowStockItems }` — currentStock = totalProd − sold, lowStockAlert < 100
  - `profit-loss`: `{ reportType, month, totalRevenue, totalExpenses, netProfit, expensesByCategory, totalPaymentsReceived, outstanding }` — defaults to current month if no filter
  - `outstanding`: `{ data: OutstandingRow[], totalOutstanding }` — per-customer pending payments grouped by customerName
  - `customer-ledger`: `{ customerLedger: LedgerRow[] }` — legacy, groups by Customer._id

### GET /api  (root)
- **Auth**: Open
- **Purpose**: Health check.
- **Response**: `{ status: 'ok', message: 'Veda Enterprises ERP API is running' }`.

---

## Section 4: Customers

### GET /api/customers
- **Auth**: `requireSession`
- **Query params**: `search=` (case-insensitive regex on name/mobile, ReDoS-escaped), `page=` (default 1), `limit=` (default 100, max 500).
- **Purpose**: Paginated customer list.
- **Response**: `{ customers: Customer[], total, page, limit, totalPages }`.

### POST /api/customers
- **Auth**: `requireRole(['admin','operator'])`
- **Body**: `{ name: string, mobile: string, gstNumber?: string, address?: string, creditLimit?: number }`
- **Response**: `{ customer: Customer }` (201).

### GET /api/customers/[id]
- **Auth**: `requireSession`
- **Response**: `{ customer: Customer }` or 404.

### PUT /api/customers/[id]
- **Auth**: `requireRole(['admin','operator'])`
- **Body**: partial `{ name?, mobile?, gstNumber?, address?, creditLimit? }`
- **Response**: `{ customer: Customer }`.

### DELETE /api/customers/[id]
- **Auth**: `requireRole(['admin','operator'])`
- **Response**: `{ message: 'Customer deleted successfully' }`.

### POST /api/customers/bulk-delete
- **Auth**: `getSession` + role ≠ accountant (admin/operator only)
- **Body**: `{ ids: string[] }`
- **Purpose**: Bulk delete customers; nulls out `customerId` references in Order/Payment/CustomerPayment/Production/Dispatch (preserves audit trail).
- **Response**: `{ message, deletedCount, requestedCount }`.

### GET /api/customers/[id]/history
- **Auth**: `requireSession`
- **Purpose**: Customer ledger — orders, dispatches, legacy payments + customer payments, plus a merged sorted `timeline[]` and summary aggregations (totalOrderedAmount, totalOrderedQty, totalDispatchedQty, totalPaid, balance, etc.). Production/DailySell excluded per business rule.
- **Response**: `{ customer, summary, orders, dispatches, payments, customerPayments, timeline }`.

### GET /api/customers/[id]/bill-history
- **Auth**: `requireSession`
- **Purpose**: Bill generation context — customer record, all their productions, dispatches, bills, orders, payments, plus aggregated product totals (one-click "bill everything produced").
- **Response**: `{ customer, productions, dispatches, bills, orders, payments, productFields, summary: { productionCount, dispatchCount, billCount, orderCount, paymentCount, totalDispatchedQty, totalPreviouslyBilled, totalPreviouslyPaid, totalPaymentsReceived, outstanding, productTotals, dispatchedTotals } }`.

---

## Section 5: Production & Stock

### GET /api/production
- **Auth**: `requireSession`
- **Query params**: `date=YYYY-MM-DD` (filter by exact date)
- **Response**: `{ productions: Production[] }`.

### POST /api/production
- **Auth**: `requireRole(['admin','operator'])`
- **Body**: `{ date: string, customerId?: ObjectId, cement?, zigZagGrey80?, zigZagRed80?, zigZagYellow80?, zigZagGrey60?, zigZagRed60?, zigZagYellow60?, curveStone?, chequreTile?, dumbleGrey80?, dumbleRed80?, dumbleYellow80?, transportationCharge?, remarks? }` (all numeric, default 0)
- **Side effect**: calls `syncStockForDate(date)` to update Stock snapshot.
- **Response**: `{ production: Production }` (201).

### DELETE /api/production?all=true
- **Auth**: `requireAdmin`
- **Query params**: `all=true` or `all=1` REQUIRED (else 400)
- **Purpose**: Wipes ALL production entries + ALL stock entries (Stock is derived from Production).
- **Response**: `{ message: 'All production entries deleted', deletedCount }`.

### GET /api/production/[id]
- **Auth**: `requireSession`
- **Response**: `{ production: Production }` or 404.

### PUT /api/production/[id]
- **Auth**: `requireRole(['admin','operator'])`
- **Body**: partial of any Production field
- **Side effect**: re-syncs Stock snapshot for the production's date.
- **Response**: `{ production: Production }`.

### DELETE /api/production/[id]
- **Auth**: `requireRole(['admin','operator'])`
- **Side effect**: re-syncs Stock snapshot for the deleted row's date.
- **Response**: `{ message: 'Production entry deleted successfully' }`.

### POST /api/production/bulk-delete
- **Auth**: `getSession` + role ≠ accountant (admin/operator only)
- **Body**: `{ ids: string[] }`
- **Side effect**: re-aggregates Stock snapshots for every touched date.
- **Response**: `{ message, deletedCount, requestedCount, stockResyncedDates }`.

### GET /api/stock
- **Auth**: `requireSession`
- **Response**: `{ stocks: Stock[] }` (all stock entries, date-desc).

### POST /api/stock
- **Auth**: `requireAdmin`
- **Body (create)**: `{ date: string, cement?, zigZagGrey80?, ..., dumbleYellow80? }`
- **Body (bulk-delete)**: `{ ids: string[] }` — same endpoint dispatches by shape.
- **Response (create)**: `{ stock: Stock }` (201). **Response (bulk-delete)**: `{ message, deletedCount }`.

### DELETE /api/stock?all=true
- **Auth**: `requireAdmin`
- **Query params**: `all=true` to wipe every stock entry.
- **Response**: `{ message, deletedCount }` or 400 if `?all=true` missing.

### GET /api/stock/[id]
- **Auth**: `requireSession`
- **Response**: `{ stock: Stock }` or 404.

### PUT /api/stock/[id]
- **Auth**: `requireRole(['admin','operator'])`
- **Body**: partial of any Stock field. Accepts backward-compat aliases like `zigZagGrey80mm`.
- **Response**: `{ stock: Stock }`.

### DELETE /api/stock/[id]
- **Auth**: `requireRole(['admin','operator'])`
- **Response**: `{ message: 'Stock entry deleted successfully' }`.

### GET /api/stock/summary
- **Auth**: `requireSession`
- **Purpose**: Item-wise stock summary — one row per product (12 products) showing `totalProduction`, `sellItem`, `availableQuantity` (=totalProd − sold), `previousYearStock`, `latestDate`, `latestQuantity`, `productionDays`. Single-pass server-side aggregation over Production + Stock + DailySell.
- **Response**: `{ summary: SummaryRow[] }`.

---

## Section 6: Orders & Dispatch

### GET /api/orders
- **Auth**: `requireSession`
- **Response**: `{ orders: Order[] }` with populated `customer` (also extracts `customerId`/`customer` fields for legacy clients).

### POST /api/orders
- **Auth**: `requireRole(['admin','operator'])`
- **Body**: `{ customerId: ObjectId, deliveryDate: string, status?: 'Pending'|... (default 'Pending'), brickType?, quantity?, rate?, amount?, items?: [{ description, hsn?, unit?, quantity, rate, amount? }] }` — must provide either brickType+quantity+rate OR items[].
- **Purpose**: Generates orderNumber `ORD-####` (or company.orderPrefix). Computes summary fields (quantity/amount/weighted-avg rate) from items[] if provided.
- **Response**: `{ order: Order }` (201).

### GET /api/orders/[id]
- **Auth**: `requireSession`
- **Response**: `{ order: Order }`.

### PUT /api/orders/[id]
- **Auth**: `requireRole(['admin','operator'])`
- **Body**: partial `{ customerId?, brickType?, quantity?, rate?, amount?, deliveryDate?, status?, items? }`. If items[] provided, recomputes summary fields.
- **Response**: `{ order: Order }`.

### DELETE /api/orders/[id]
- **Auth**: `requireRole(['admin','operator'])`
- **Note**: Does NOT cascade-delete linked Bills/Dispatches (preserves audit trail).
- **Response**: `{ message: 'Order deleted successfully' }`.

### POST /api/orders/bulk-delete
- **Auth**: `getSession` + role ≠ accountant
- **Body**: `{ ids: string[] }`
- **Response**: `{ message, deletedCount, requestedCount }`.

### GET /api/dispatch
- **Auth**: `requireSession`
- **Response**: `{ dispatches: Dispatch[] }` with `customer` + `order` populated.

### POST /api/dispatch
- **Auth**: `requireRole(['admin','operator'])`
- **Body**: `{ customerId: ObjectId, orderId?: ObjectId, truckNumber: string, driverName?, quantity: number, brickType: string, date: string }`
- **Side effect**: auto-decrements `Stock.currentStock` for the matching brickType.
- **Response**: `{ dispatch: Dispatch }` (201).

### GET /api/dispatch/[id]
- **Auth**: `requireSession`
- **Response**: `{ dispatch: Dispatch }`.

### PUT /api/dispatch/[id]
- **Auth**: `requireRole(['admin','operator'])`
- **Body**: partial `{ customerId?, orderId?, truckNumber?, driverName?, quantity?, brickType?, date? }`
- **Response**: `{ dispatch: Dispatch }`.

### DELETE /api/dispatch/[id]
- **Auth**: `requireRole(['admin','operator'])`
- **Side effect**: restores `Stock.currentStock` by the deleted dispatch's quantity.
- **Response**: `{ message: 'Dispatch deleted successfully' }`.

### POST /api/dispatch/bulk-delete
- **Auth**: `getSession` + role ≠ accountant
- **Body**: `{ ids: string[] }`
- **Response**: `{ message, deletedCount, requestedCount }`.

---

## Section 7: Daily Sell & Payments

### GET /api/daily-sell
- **Auth**: `requireRole(['admin','operator','accountant'])` (all roles)
- **Response**: `{ dailySells: DailySell[] }` (date-desc).

### POST /api/daily-sell
- **Auth**: `requireRole(['admin','operator','accountant'])` (admin-only for bulk-delete branch)
- **Body (create)**: `{ date, customerName, address?, contactNumber?, product?, quantity?, rate?, amount, transporterName?, transporterFair?, receivedAmount?, remarks? }`
- **Body (bulk-delete)**: `{ ids: string[] }` (admin only — uses cleanup helper before delete).
- **Side effect (create)**: triggers `syncAllFromDailySell()` which mirrors into Customer, Order, CustomerPayment, Payment, TractorPayment + Stock. Links stored back on DailySell doc (`customerId`, `orderId`, `customerPaymentId`, `paymentId`, `tractorPaymentId`, `syncNotes`). Non-blocking on sync failure.
- **Response (create)**: `{ dailySell: DailySell }` (201). **Response (bulk-delete)**: `{ message, deletedCount }`.

### DELETE /api/daily-sell?all=true
- **Auth**: `requireRole(['admin'])` (admin only)
- **Query params**: `all=true` or `all=1` REQUIRED
- **Side effect**: runs `cleanupDailySellLinks()` for every record before delete.
- **Response**: `{ message, deletedCount }` or 400 if `?all=true` missing.

### GET /api/daily-sell/[id]
- **Auth**: `requireSession`
- **Response**: `{ dailySell: DailySell }` or 404.

### PUT /api/daily-sell/[id]
- **Auth**: `requireRole(['admin','operator','accountant'])`
- **Body**: partial of user-editable fields (`date, customerName, address, contactNumber, product, quantity, rate, amount, transporterName, transporterFair, receivedAmount, remarks` — NOT `customerId`/`orderId`/`customerPaymentId`/`syncNotes`, those are managed by sync engine).
- **Side effect**: auto-recomputes `pendingAmount = amount − receivedAmount`; re-runs `cleanupDailySellLinks()` then `syncAllFromDailySell()` so mirrors stay fresh after edits.
- **Response**: `{ dailySell: DailySell }`.

### DELETE /api/daily-sell/[id]
- **Auth**: `requireRole(['admin','operator','accountant'])`
- **Side effect**: runs `cleanupDailySellLinks()` (removes mirrored Order/CustomerPayment/Payment/TractorPayment; Customer record preserved).
- **Response**: `{ message: 'Daily sell entry deleted successfully' }`.

### GET /api/customer-payment
- **Auth**: `requireSession`
- **Response**: `{ customerPayments: CustomerPayment[] }` (date-desc).

### POST /api/customer-payment
- **Auth**: `requireRole(['admin','operator','accountant'])`
- **Body**: `{ date, name: string, address?, amount: number, remarks? }`
- **Response**: `{ customerPayment: CustomerPayment }` (201).

### GET /api/customer-payment/[id]
- **Auth**: `requireSession`
- **Response**: `{ customerPayment: CustomerPayment }`.

### PUT /api/customer-payment/[id]
- **Auth**: `requireRole(['admin','operator','accountant'])`
- **Body**: partial `{ date?, name?, address?, amount?, remarks? }`
- **Response**: `{ customerPayment: CustomerPayment }`.

### DELETE /api/customer-payment/[id]
- **Auth**: `requireRole(['admin','operator','accountant'])`
- **Response**: `{ message: 'customerPayment entry deleted successfully' }`.

### POST /api/customer-payment/bulk-delete
- **Auth**: `getSession` + role ≠ accountant
- **Body**: `{ ids: string[] }`
- **Response**: `{ message, deletedCount, requestedCount }`.

### GET /api/labour-payment
- **Auth**: `requireSession`
- **Response**: `{ labourPayments: LabourPayment[] }` (date-desc).

### POST /api/labour-payment
- **Auth**: `requireRole(['admin','operator','accountant'])`
- **Body**: `{ date, name: string, address?, amount: number, remarks? }`
- **Response**: `{ labourPayment: LabourPayment }` (201).

### GET /api/labour-payment/[id]
- **Auth**: `requireSession`
- **Response**: `{ labourPayment: LabourPayment }`.

### PUT /api/labour-payment/[id]
- **Auth**: `requireRole(['admin','operator','accountant'])`
- **Body**: partial `{ date?, name?, address?, amount?, remarks? }`
- **Response**: `{ labourPayment: LabourPayment }`.

### DELETE /api/labour-payment/[id]
- **Auth**: `requireRole(['admin','operator','accountant'])`
- **Response**: `{ message: 'labourPayment entry deleted successfully' }`.

### POST /api/labour-payment/bulk-delete
- **Auth**: `getSession` + role ≠ accountant
- **Body**: `{ ids: string[] }`
- **Response**: `{ message, deletedCount, requestedCount }`.

### GET /api/tractor-payment
- **Auth**: `requireSession`
- **Response**: `{ tractorPayments: TractorPayment[] }` (date-desc).

### POST /api/tractor-payment
- **Auth**: `requireRole(['admin','operator','accountant'])`
- **Body**: `{ date, vendorName: string, quantityTon: number, rate: number, paidAmount?, remarks?, type?: 'tractor'|'transporter' (default 'tractor'), linkedDailySellId?: ObjectId }`
- **Side effect**: computes `totalAmount = quantityTon × rate` and `remainingAmount = totalAmount − paidAmount`.
- **Response**: `{ tractorPayment: TractorPayment }` (201).

### GET /api/tractor-payment/[id]
- **Auth**: `requireSession`
- **Response**: `{ tractorPayment: TractorPayment }`.

### PUT /api/tractor-payment/[id]
- **Auth**: `requireRole(['admin','operator','accountant'])`
- **Body**: partial `{ date?, vendorName?, quantityTon?, rate?, totalAmount?, paidAmount?, remainingAmount?, remarks?, type?, linkedDailySellId? }`
- **Response**: `{ tractorPayment: TractorPayment }`.

### DELETE /api/tractor-payment/[id]
- **Auth**: `requireRole(['admin','operator','accountant'])`
- **Response**: `{ message: 'tractorPayment entry deleted successfully' }`.

### POST /api/tractor-payment/bulk-delete
- **Auth**: `getSession` + role ≠ accountant
- **Body**: `{ ids: string[] }`
- **Response**: `{ message, deletedCount, requestedCount }`.

### GET /api/payments
- **Auth**: `requireSession`
- **Response**: `{ payments: Payment[] }` with `customer` populated. Payment links to Bill via `billId`/`billNumber` and mirrors to CustomerPayment via `customerPaymentId`.

### POST /api/payments
- **Auth**: `requireRole(['admin','accountant'])`
- **Body**: `{ customerId: ObjectId, paymentType: string, amount: number, date: string, remarks?, billId?: ObjectId }`
- **Side effects**: if `billId` provided, recomputes the Bill's `paidAmount`/`balanceAmount`/`status` via `resyncBillPaidAmount()` (paid if total ≥ grandTotal; partial if >0; draft if 0). Mirrors into CustomerPayment module via `syncCreateCustomerPayment()`.
- **Response**: `{ payment: Payment }` (201).

### GET /api/payments/[id]
- **Auth**: `requireSession`
- **Response**: `{ payment: Payment }`.

### PUT /api/payments/[id]
- **Auth**: `requireRole(['admin','accountant'])`
- **Body**: partial `{ customerId?, paymentType?, amount?, date?, remarks?, billId? }` (explicit `null` billId = unlink; `undefined` = no change).
- **Side effects**: if billId changed, re-syncs both old and new Bills. Mirrors update into CustomerPayment via `syncUpdateCustomerPayment()`.
- **Response**: `{ payment: Payment }`.

### DELETE /api/payments/[id]
- **Auth**: `requireRole(['admin','accountant'])`
- **Side effects**: captures `billId` before delete; runs `syncDeleteCustomerPayment(id)` to remove mirror; re-syncs the Bill's `paidAmount` (will drop by this payment's amount).
- **Response**: `{ message: 'Payment deleted successfully' }`.

### POST /api/payments/bulk-delete
- **Auth**: `getSession` + role ≠ accountant
- **Body**: `{ ids: string[] }`
- **Side effect**: runs `syncDeleteCustomerPayment(id)` for each Payment before deleting (so mirror is removed).
- **Response**: `{ message, deletedCount, requestedCount }`.

---

## Section 8: Purchases

### GET /api/dust-purchase
- **Auth**: `requireSession`
- **Response**: `{ dustPurchases: DustPurchase[] }` (date-desc).

### POST /api/dust-purchase
- **Auth**: `requireRole(['admin','operator','accountant'])`
- **Body**: `{ date, vendorName: string, cementName?, quantity: number, rate: number, paidAmount?, transportationCharge?, gst?, remarks? }`
- **Side effect**: computes `totalAmount = quantity × rate`.
- **Response**: `{ dustPurchase: DustPurchase }` (201).

### GET /api/dust-purchase/[id]
- **Auth**: `requireSession`
- **Response**: `{ dustPurchase: DustPurchase }`.

### PUT /api/dust-purchase/[id]
- **Auth**: `requireRole(['admin','operator','accountant'])`
- **Body**: partial `{ date?, vendorName?, cementName?, quantity?, rate?, totalAmount?, paidAmount?, transportationCharge?, gst?, remarks? }`
- **Response**: `{ dustPurchase: DustPurchase }`.

### DELETE /api/dust-purchase/[id]
- **Auth**: `requireRole(['admin','operator','accountant'])`
- **Response**: `{ message: 'dustPurchase entry deleted successfully' }`.

### POST /api/dust-purchase/bulk-delete
- **Auth**: `getSession` + role ≠ accountant
- **Body**: `{ ids: string[] }`
- **Response**: `{ message, deletedCount, requestedCount }`.

### GET /api/cement-purchase
- **Auth**: `requireSession`
- **Response**: `{ cementPurchases: CementPurchase[] }` (date-desc).

### POST /api/cement-purchase
- **Auth**: `requireRole(['admin','operator','accountant'])`
- **Body**: `{ date, vendorName: string, itemName?, quantity: number, rate: number, paidAmount?, transportationCharge?, gst?, remarks? }`
- **Side effect**: computes `totalAmount = quantity × rate`.
- **Response**: `{ cementPurchase: CementPurchase }` (201).

### GET /api/cement-purchase/[id]
- **Auth**: `requireSession`
- **Response**: `{ cementPurchase: CementPurchase }`.

### PUT /api/cement-purchase/[id]
- **Auth**: `requireRole(['admin','operator','accountant'])`
- **Body**: partial `{ date?, vendorName?, itemName?, quantity?, rate?, totalAmount?, paidAmount?, transportationCharge?, gst?, remarks? }`
- **Response**: `{ cementPurchase: CementPurchase }`.

### DELETE /api/cement-purchase/[id]
- **Auth**: `requireRole(['admin','operator','accountant'])`
- **Response**: `{ message: 'cementPurchase entry deleted successfully' }`.

### POST /api/cement-purchase/bulk-delete
- **Auth**: `getSession` + role ≠ accountant
- **Body**: `{ ids: string[] }`
- **Response**: `{ message, deletedCount, requestedCount }`.

---

## Section 9: Misc Expenses

### GET /api/hardner
- **Auth**: `requireSession`
- **Response**: `{ hardners: Hardner[] }` (date-desc).

### POST /api/hardner
- **Auth**: `requireRole(['admin','operator','accountant'])`
- **Body**: `{ date: string, amount: number }` (only 2 fields!)
- **Response**: `{ hardner: Hardner }` (201).

### GET /api/hardner/[id]
- **Auth**: `requireSession`
- **Response**: `{ hardner: Hardner }`.

### PUT /api/hardner/[id]
- **Auth**: `requireRole(['admin','operator','accountant'])`
- **Body**: partial `{ date?, amount? }`
- **Response**: `{ hardner: Hardner }`.

### DELETE /api/hardner/[id]
- **Auth**: `requireRole(['admin','operator','accountant'])`
- **Response**: `{ message: 'hardner entry deleted successfully' }`.

### POST /api/hardner/bulk-delete
- **Auth**: `getSession` + role ≠ accountant
- **Body**: `{ ids: string[] }`
- **Response**: `{ message, deletedCount, requestedCount }`.

### GET /api/electricity
- **Auth**: `requireSession`
- **Response**: `{ electricitys: Electricity[] }` (note the plural key `electricitys`).

### POST /api/electricity
- **Auth**: `requireRole(['admin','operator','accountant'])`
- **Body**: `{ date: string, name?, work?, amount: number, remarks? }`
- **Response**: `{ electricity: Electricity }` (201).

### GET /api/electricity/[id]
- **Auth**: `requireSession`
- **Response**: `{ electricity: Electricity }`.

### PUT /api/electricity/[id]
- **Auth**: `requireRole(['admin','operator','accountant'])`
- **Body**: partial `{ date?, name?, work?, amount?, remarks? }`
- **Response**: `{ electricity: Electricity }`.

### DELETE /api/electricity/[id]
- **Auth**: `requireRole(['admin','operator','accountant'])`
- **Response**: `{ message: 'electricity entry deleted successfully' }`.

### POST /api/electricity/bulk-delete
- **Auth**: `getSession` + role ≠ accountant
- **Body**: `{ ids: string[] }`
- **Response**: `{ message, deletedCount, requestedCount }`.

### GET /api/factory-stuff
- **Auth**: `requireSession`
- **Response**: `{ factoryStuffs: FactoryStuff[] }` (date-desc).

### POST /api/factory-stuff
- **Auth**: `requireRole(['admin','operator','accountant'])`
- **Body**: `{ date: string, itemName: string, quantity?, amount: number, remarks? }`
- **Response**: `{ factoryStuff: FactoryStuff }` (201).

### GET /api/factory-stuff/[id]
- **Auth**: `requireSession`
- **Response**: `{ factoryStuff: FactoryStuff }`.

### PUT /api/factory-stuff/[id]
- **Auth**: `requireRole(['admin','operator','accountant'])`
- **Body**: partial `{ date?, itemName?, quantity?, amount?, remarks? }`
- **Response**: `{ factoryStuff: FactoryStuff }`.

### DELETE /api/factory-stuff/[id]
- **Auth**: `requireRole(['admin','operator','accountant'])`
- **Response**: `{ message: 'factoryStuff entry deleted successfully' }`.

### POST /api/factory-stuff/bulk-delete
- **Auth**: `getSession` + role ≠ accountant
- **Body**: `{ ids: string[] }`
- **Response**: `{ message, deletedCount, requestedCount }`.

### GET /api/expenses
- **Auth**: `requireSession`
- **Query params**: `category=` (exact match), `date=` (single date OR `from,to` comma-pair for range).
- **Response**: `{ expenses: Expense[] }` (date-desc).

### POST /api/expenses
- **Auth**: `requireRole(['admin','accountant'])` (note: operators NOT allowed — admin+accountant only)
- **Body**: `{ category: string, amount: number, date: string, description? }`
- **Response**: `{ expense: Expense }` (201).

### GET /api/expenses/[id]
- **Auth**: `requireSession`
- **Response**: `{ expense: Expense }`.

### PUT /api/expenses/[id]
- **Auth**: `requireRole(['admin','accountant'])`
- **Body**: partial `{ category?, amount?, date?, description? }`
- **Response**: `{ expense: Expense }`.

### DELETE /api/expenses/[id]
- **Auth**: `requireRole(['admin','accountant'])`
- **Response**: `{ message: 'Expense deleted successfully' }`.

### POST /api/expenses/bulk-delete
- **Auth**: `getSession` + role ≠ accountant
- **Body**: `{ ids: string[] }`
- **Response**: `{ message, deletedCount, requestedCount }`.

---

## Section 10: Bills / Invoicing

### GET /api/bills
- **Auth**: `requireSession`
- **Query params**: `billType=`, `status=` (draft|partial|paid|sent), `search=` (case-insensitive regex on billNumber/toName/toPhone; capped to 50 results when searching).
- **Response**: `{ bills: Bill[] }` (createdAt-desc).

### POST /api/bills
- **Auth**: `requireSession` (any logged-in user can create bills)
- **Body**: `{ billType?: 'sales'|'purchase'|'quotation'|'service'|'other', date?, dueDate?, customerId?: ObjectId|null, fromName?, fromAddress?, fromGst?, fromPhone?, toName: string, toAddress?, toGst?, toPhone?, items: [{ description, hsn?, quantity, unit?, rate, amount? }], discountPercent?, discountAmount?, cgstPercent?, cgstAmount?, sgstPercent?, sgstAmount?, igstPercent?, igstAmount?, paidAmount?, paymentMode?: string (default 'Cash'), notes?, terms?, status? }`
- **Side effects**: generates `billNumber = BILL-YYYYMM-####`; computes subTotal, taxableAmount, all GST amounts, grandTotal (rounded), roundOff, balanceAmount, and auto-status (paid/partial/draft). Pulls "from" defaults from Company record. If `customerId` + `paidAmount>0`, auto-creates a linked Payment row.
- **Response**: `{ bill: Bill }` (201).

### GET /api/bills/[id]
- **Auth**: `requireSession`
- **Response**: `{ bill: Bill }` or 404.

### PUT /api/bills/[id]
- **Auth**: `requireSession`
- **Body**: partial Bill fields. If `items[]` provided, recomputes all amounts.
- **Side effects**: keeps the linked Payment mirror in sync (creates/updates/deletes the auto-synced Payment based on paidAmount + customerId). If `customerId` is unlinked or `paidAmount=0`, the mirror Payment is deleted.
- **Response**: `{ bill: Bill }`.

### DELETE /api/bills/[id]
- **Auth**: `requireAdmin` (only admins can delete bills)
- **Side effect**: cascades — deletes any auto-synced Payment mirror (`billId = bill._id`). Manual Payments (created via /api/payments) with billId=null are never touched.
- **Response**: `{ message: 'Bill deleted successfully' }`.

---

## Section 11: Excel Import

### GET /api/import
- **Auth**: Open (no auth check) — returns the import template schema.
- **Purpose**: Lists all 12 importable modules and their required fields for the Excel template.
- **Response**: `{ modules: [{ id, label, fields: string[] }] }` — modules: `customers`, `production`, `stock`, `dailySell`, `customerPayment`, `labourPayment`, `tractorPayment`, `dustPurchase`, `cementPurchase`, `hardner`, `electricity`, `factoryStuff`.

### POST /api/import
- **Auth**: `requireRole(['admin','operator'])`
- **Body**: `{ module: string, data: Array<RowObject> }` (max 5000 rows per call → 413 if exceeded).
- **Purpose**: Bulk-imports rows for the specified module. Server-side date normalization (handles DD-MM-YYYY, DD/MM/YY, Excel serial numbers, datetime strings, etc.). Duplicate detection by natural key — duplicates are SKIPPED with a message but non-duplicates are still imported. Uses `insertMany` for single round-trip. Re-syncs Stock snapshots for touched dates when importing production.
- **Response**: `{ imported: number, skipped: number, duplicatesSkipped: number, errors: string[], skippedReasons: string[] }`.

---

## Section 12: Admin & Debug

### GET /api/admin/fix-indexes
- **Auth**: `requireAdmin`
- **Purpose**: One-shot DB fix — drops stale indexes from `stocks` and `productions` collections (e.g. the old `stocks.brickType_1`), recreates the `date_-1` index. Idempotent.
- **Response**: `{ collections: { stocks: { indexesBefore, stale, dropped, indexesAfter }, productions: {...} }, timestamp }`.

### GET /api/admin/sync-all-stock
- **Auth**: `requireAdmin`
- **Purpose**: One-shot backfill — finds all distinct production dates and re-syncs each one into the Stock collection. Used after schema changes or to populate Stock Overview retroactively.
- **Response**: `{ timestamp, datesFound, dates: string[], succeeded: number, failed: number, failures: [{ date, error }] }`.

### GET /api/database
- **Auth**: `requireAdmin`
- **Purpose**: Export a full backup of all 19 collections (companies, users, customers, productions, stocks, dailySells, customerPayments, labourPayments, tractorPayments, dustPurchases, cementPurchases, hardners, electricities, factoryStuffs, orders, dispatches, payments, expenses, bills). User passwords are STRIPPED before export.
- **Response**: `{ version: 2, exportedAt, data: { ...collections... }, counts }` with `Cache-Control: no-store`.

### PUT /api/database
- **Auth**: `requireAdmin`
- **Body**: Backup file (supports 3 shapes: double-wrapped v2 file `{ data: { data, counts, version } }`, unwrapped `{ data: { customers, ... } }`, or raw `{ customers, ... }`).
- **Purpose**: MERGE restore (not REPLACE). Same-`_id` docs are REPLACED, new-`_id` docs are INSERTED, docs not in backup are PRESERVED. `users` collection is intentionally SKIPPED (auth state never restored from backup — would lock users out). Uses `bulkWrite replaceOne + upsert`.
- **Response**: `{ message, mode: 'merge', counts: { inserted, replaced }, perCollection, errors? }`.

### DELETE /api/database
- **Auth**: `requireAdmin`
- **Purpose**: Clears ALL transactional data (17 collections) — preserves only `companies` and `users` so the admin can log back in and branding stays intact.
- **Response**: `{ message, cleared: { customers: N, productions: N, ... } }`.

### GET /api/database/clear-section
- **Auth**: `getSession` + role === 'admin'
- **Purpose**: Lists the 17 clearable collections with current counts (for the Database tab dropdown). Excludes `companies` and `users`.
- **Response**: `{ sections: [{ key, label, count }] }`.

### POST /api/database/clear-section
- **Auth**: `getSession` + role === 'admin'
- **Body**: `{ collection: string }` (one of the 17 keys: customers, productions, stocks, dailySells, customerPayments, labourPayments, tractorPayments, dustPurchases, cementPurchases, hardners, electricities, factoryStuffs, orders, dispatches, payments, expenses, bills)
- **Response**: `{ message, collection, label, deletedCount }`.

### GET /api/debug/sync?date=YYYY-MM-DD
- **Auth**: `requireAdmin`
- **Query params**: `date=YYYY-MM-DD` REQUIRED (regex-validated)
- **Purpose**: Runs `syncStockForDate(date)` and returns step-by-step debug info (productions found, existing stock, sync result, post-sync verification).
- **Response**: `{ input_date, steps: [{ step, ok, ... }] }`.

### GET /api/debug/payment-sync
- **Auth**: `requireAdmin`
- **Purpose**: Diagnostic snapshot of Payment ↔ CustomerPayment link state. Returns up to 20 recent records of each, summary counts, and the list of unlinked payments.
- **Response**: `{ summary: { totalPayments, linkedToCustomerPayment, unlinked, totalCustomerPayments }, unlinkedPayments, recentPayments, recentCustomerPayments }`.

### POST /api/debug/payment-sync/backfill
- **Auth**: `requireAdmin`
- **Purpose**: One-time backfill — for every Payment missing a `customerPaymentId`, creates the missing CustomerPayment mirror and links it. Safe to run repeatedly.
- **Response**: `{ totalScanned, successCount, failureCount, results: [{ paymentId, ok, error? }] }`.

---

## Section 13: AI

### GET /api/ai/config
- **Auth**: `requireSession` (any logged-in user — UI needs to know if AI is enabled)
- **Purpose**: Returns the AI config with the API key MASKED (only last 4 chars). Masked as `sk-...abcd` for OpenAI or `gsk_...abcd` for Groq. Returns defaults if no config exists yet.
- **Response**: `{ provider: 'openai'|'groq', enabled: boolean, model: string, hasKey: boolean, keyMasked: string }`.

### PUT /api/ai/config
- **Auth**: `requireAdmin`
- **Body**: `{ provider?: 'openai'|'groq', openaiApiKey?: string (empty string clears), enabled?: boolean, model?: string }`
- **Purpose**: Upserts the AiConfig doc. Never echoes the full key back (always masked).
- **Response**: same shape as GET (masked).

### POST /api/ai/parse
- **Auth**: `getSession` (any logged-in user, but AI must be enabled + key configured)
- **Body**: `{ module: string, text: string }` — `module` must be a key in `AI_MODULE_MAP`.
- **Purpose**: Calls OpenAI/Groq with the module's system prompt and the user's text. Uses `temperature=0`, `max_tokens=500`, `response_format: json_object`, 12s timeout, 1 retry. Coerces returned values to the schema's expected types.
- **Response**: `{ fields: Record<string, unknown>, raw: Record<string, unknown> }` — `fields` contains only schema-recognized keys with coerced values. 403 if AI disabled or no key. 502 if AI returns invalid JSON.

### POST /api/ai/test
- **Auth**: `getSession` + role === 'admin' (admin only)
- **Purpose**: "Test Connection" button — sends a tiny `{"status":"ok"}` ping to the configured AI provider using the saved key+model. 10s timeout, no retries.
- **Body**: none
- **Response**: `{ ok: true, provider, model, latencyMs, responsePreview, parsedOk, message }` or `{ ok: false, error, status }` on failure (parses HTTP status from SDK error message like "401 Incorrect API key").

---

## Summary Tables

### Auth Quick Reference

| Auth level | Function | Who |
|---|---|---|
| Open | (none) | Anyone — `/api`, `/api/auth/login`, `/api/auth/init`, `/api/auth/forgot-password/*`, `/api/import` GET |
| Session | `requireSession` / `getSession` | Any logged-in user |
| Admin | `requireAdmin` or manual `role==='admin'` check | admin only |
| Role | `requireRole(['admin','operator'])` | admin + operator (accountants blocked) |
| Role | `requireRole(['admin','operator','accountant'])` | all roles (effectively any logged-in user) |
| Role | `requireRole(['admin','accountant'])` | admin + accountant (operators blocked) — used by `/api/payments` and `/api/expenses` |

### Bulk-Delete Pattern (consistent across modules)

All bulk-delete routes accept `{ ids: string[] }` and return `{ message, deletedCount, requestedCount }`. They use `getSession()` + manual `role !== 'accountant'` check (so admin/operator can call, accountant gets 403). The following modules have a dedicated `bulk-delete` sub-route:

- customers, production, orders, dispatch, customer-payment, labour-payment, tractor-payment, payments, dust-purchase, cement-purchase, hardner, electricity, factory-stuff, expenses, users

**Exceptions**:
- `daily-sell` — no dedicated bulk-delete route; uses `POST /api/daily-sell` with `{ ids: [...] }` body (admin-only branch).
- `stock` — no dedicated bulk-delete route; uses `POST /api/stock` with `{ ids: [...] }` body.
- `bills` — no bulk-delete route at all (admin must delete bills one at a time via `DELETE /api/bills/[id]`).

### Delete-All Pattern (admin-only, wipes entire collection)

- `DELETE /api/production?all=true` — also wipes Stock
- `DELETE /api/stock?all=true`
- `DELETE /api/daily-sell?all=true` — cleans up linked mirrors first
- `DELETE /api/database` — wipes 17 collections (preserves users + companies)
- `POST /api/database/clear-section` with `{ collection }` — wipes one specific collection

### Cross-Module Auto-Sync Web (important to know)

| Trigger | Effect |
|---|---|
| POST/PUT/DELETE `/api/production/[id]?` | Re-syncs Stock snapshot for the touched date |
| POST `/api/daily-sell` (create) | Mirrors into Customer + Order + CustomerPayment + Payment + TractorPayment + Stock |
| PUT `/api/daily-sell/[id]` | Cleans up old mirrors, re-creates them with new data |
| DELETE `/api/daily-sell/[id]` | Cleans up linked mirrors (Customer preserved) |
| POST `/api/dispatch` (create) | Decrements Stock.currentStock for the brickType |
| DELETE `/api/dispatch/[id]` | Restores Stock.currentStock |
| POST `/api/bills` (create) | If paidAmount>0 + customerId set → auto-creates linked Payment |
| PUT `/api/bills/[id]` | Keeps Payment mirror in sync (upsert/delete) |
| DELETE `/api/bills/[id]` | Cascades — deletes auto-synced Payment mirror |
| POST/PUT/DELETE `/api/payments/[id]?` | Mirrors into CustomerPayment + re-syncs linked Bill's paidAmount/status |

### Special Query Params Cheatsheet

| Param | Routes | Meaning |
|---|---|---|
| `?search=` | `/api/customers`, `/api/bills` | Case-insensitive regex (ReDoS-escaped) |
| `?page=`, `?limit=` | `/api/customers` | Pagination (default 1/100, max 500) |
| `?date=YYYY-MM-DD` | `/api/production`, `/api/debug/sync` | Filter by exact date |
| `?all=true` | `DELETE /api/production`, `DELETE /api/stock`, `DELETE /api/daily-sell` | Confirms bulk-wipe intent |
| `?month=YYYY-MM` | `/api/reports` | Month filter (sales/production/P&L) |
| `?from=`, `?to=YYYY-MM-DD` | `/api/reports` | Date-range filter |
| `?type=` | `/api/reports` | Report mode switch (sales/production/stock/profit-loss/outstanding/customer-ledger) |
| `?category=` | `/api/expenses` | Exact category match |
| `?date=from,to` | `/api/expenses` | Comma-pair date range (or single date) |
| `?billType=`, `?status=` | `/api/bills` | Filter by bill type / payment status |
| `?key=` | `/api/auth/init`, `/api/auth/reset-admin` | Env-gate key (alternative to `X-First-Run-Key` / `X-Emergency-Reset-Key` header) |

### Notes on Pluralization Quirks

The response JSON keys are inconsistent — watch for these:
- `/api/electricity` → `{ electricitys: [...] }` (not `electricities`)
- `/api/customer-payment` → `{ customerPayments: [...] }`
- `/api/labour-payment` → `{ labourPayments: [...] }`
- `/api/hardner` → `{ hardners: [...] }`
- `/api/factory-stuff` → `{ factoryStuffs: [...] }`
- Single-item responses use the singular: `{ customer: {...} }`, `{ hardner: {...} }`, `{ electricity: {...} }`, `{ factoryStuff: {...} }`, `{ dustPurchase: {...} }`, `{ cementPurchase: {...} }`, etc.

---

**End of Reference.** 79 route files documented across 13 sections.
