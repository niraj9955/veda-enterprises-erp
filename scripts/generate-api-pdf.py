"""Generate Veda ERP API Reference PDF using ReportLab."""

import os, sys
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, HRFlowable, ListFlowable, ListItem,
    NextPageTemplate, PageTemplate, Frame, BaseDocTemplate
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.lib.colors import HexColor

# ── Fonts ──
FONT_DIR = '/usr/share/fonts'
pdfmetrics.registerFont(TTFont('Inter', f'{FONT_DIR}/truetype/liberation/LiberationSerif-Regular.ttf'))
pdfmetrics.registerFont(TTFont('Inter-Bold', f'{FONT_DIR}/truetype/liberation/LiberationSerif-Bold.ttf'))
pdfmetrics.registerFont(TTFont('Inter-Italic', f'{FONT_DIR}/truetype/liberation/LiberationSerif-Italic.ttf'))
pdfmetrics.registerFont(TTFont('Inter-BoldItalic', f'{FONT_DIR}/truetype/liberation/LiberationSerif-BoldItalic.ttf'))
registerFontFamily('Inter', normal='Inter', bold='Inter-Bold', italic='Inter-Italic', boldItalic='Inter-BoldItalic')

# ── Palette ──
PAGE_BG       = HexColor('#f7f7f6')
HEADER_FILL   = HexColor('#786b44')
COVER_BLOCK   = HexColor('#6a6145')
BORDER        = HexColor('#d2d0c8')
ACCENT        = HexColor('#97781b')
TEXT_PRIMARY   = HexColor('#23221f')
TEXT_MUTED     = HexColor('#797770')
SEM_INFO      = HexColor('#567593')
SEM_SUCCESS   = HexColor('#538a65')
SEM_WARNING   = HexColor('#a3864d')
SEM_ERROR     = HexColor('#954e47')
TABLE_STRIPE  = HexColor('#f1f0ee')
CARD_BG       = HexColor('#e8e7e4')

# ── Page dimensions ──
PAGE_W, PAGE_H = A4
LEFT_M = 22*mm
RIGHT_M = 22*mm
TOP_M = 25*mm
BOT_M = 25*mm
CONTENT_W = PAGE_W - LEFT_M - RIGHT_M

# ── Styles ──
styles = getSampleStyleSheet()

style_body = ParagraphStyle(
    'ApiBody', fontName='Inter', fontSize=9.5, leading=14,
    textColor=TEXT_PRIMARY, alignment=TA_JUSTIFY, spaceAfter=4,
)

style_h1 = ParagraphStyle(
    'ApiH1', fontName='Inter-Bold', fontSize=18, leading=24,
    textColor=HEADER_FILL, spaceBefore=16, spaceAfter=8,
    borderWidth=0, borderPadding=0,
)

style_h2 = ParagraphStyle(
    'ApiH2', fontName='Inter-Bold', fontSize=12, leading=16,
    textColor=ACCENT, spaceBefore=12, spaceAfter=4,
)

style_method = ParagraphStyle(
    'ApiMethod', fontName='Inter-Bold', fontSize=10.5, leading=14,
    textColor=TEXT_PRIMARY, spaceBefore=8, spaceAfter=2,
)

style_field = ParagraphStyle(
    'ApiField', fontName='Inter', fontSize=8, leading=11.5,
    textColor=TEXT_MUTED, leftIndent=8, rightIndent=4, spaceAfter=1,
    autoLeading='max',
)

style_table_header = ParagraphStyle(
    'TableHeader', fontName='Inter-Bold', fontSize=9, leading=12,
    textColor=colors.white, alignment=TA_CENTER,
)

style_table_cell = ParagraphStyle(
    'TableCell', fontName='Inter', fontSize=8.5, leading=12,
    textColor=TEXT_PRIMARY,
)

style_table_cell_muted = ParagraphStyle(
    'TableCellMuted', fontName='Inter-Italic', fontSize=8.5, leading=12,
    textColor=TEXT_MUTED,
)

style_cover_title = ParagraphStyle(
    'CoverTitle', fontName='Inter-Bold', fontSize=36, leading=42,
    textColor=colors.white, alignment=TA_CENTER,
)

style_cover_sub = ParagraphStyle(
    'CoverSub', fontName='Inter', fontSize=14, leading=20,
    textColor=HexColor('#d2d0c8'), alignment=TA_CENTER,
)

style_toc_h1 = ParagraphStyle(
    'TocH1', fontName='Inter-Bold', fontSize=12, leading=20,
    leftIndent=0, textColor=TEXT_PRIMARY,
)

style_toc_h2 = ParagraphStyle(
    'TocH2', fontName='Inter', fontSize=10, leading=16,
    leftIndent=16, textColor=TEXT_MUTED,
)

# ── Helper: method color ──
METHOD_COLORS = {
    'GET': SEM_SUCCESS,
    'POST': SEM_INFO,
    'PUT': SEM_WARNING,
    'DELETE': SEM_ERROR,
}

def method_tag(method, path):
    c = METHOD_COLORS.get(method, TEXT_PRIMARY)
    return f'<font color="{c.hexval()}"><b>{method}</b></font> <font color="{TEXT_PRIMARY.hexval()}">{path}</font>'

def field_line(label, value):
    return f'<font color="{ACCENT.hexval()}"><b>{label}:</b></font> {value}'

# ── Sections data ──
# We'll build the story from the markdown content

sections = [
    {
        'num': '1',
        'title': 'Authentication & Users',
        'endpoints': [
            ('POST', '/api/auth/login', 'Open',
             'User login with email+password; issues JWT in httpOnly cookie (maxAge 86400s/24h).',
             '{ email: string, password: string } (max 256 chars each)',
             "{ message: 'Login successful', user: { id, name, email, role } } + sets token cookie. 401 on bad creds. Uses dummy bcrypt compare to prevent user enumeration via timing."),
            ('POST', '/api/auth/init', 'Open',
             'First-run system initialization. Seeds the initial admin and Veda Enterprises company record. Refuses if any users exist. Optional FIRST_RUN_KEY env gate via X-First-Run-Key header or ?key= query.',
             'none',
             "{ message, user: { id, name, email, role } } (201) or { message: 'Users already exist...' } (400)."),
            ('GET', '/api/auth/me', 'requireSession',
             'Returns the currently logged-in user session payload.',
             'none',
             '{ user: { userId, email, role, name } } or 401.'),
            ('POST', '/api/auth/reset-admin', 'EMERGENCY_RESET_KEY',
             'Emergency admin password reset. Resets admin user to admin123, reactivates account, or creates fresh admin if none exists. Gated by EMERGENCY_RESET_KEY env var via header or query.',
             'none',
             "{ message, credentials: { email, password: 'admin123' }, userId, action: 'reset'|'created', note? }."),
            ('POST', '/api/auth/forgot-password/request-otp', 'Open',
             'Generates 6-digit OTP, bcrypt-hashes it, stores in PasswordReset collection with 10-min TTL, emails it. Always returns 200 (no user enumeration). Rate-limited: 1 OTP/email/60s.',
             '{ email: string }',
             "{ message, email, expiryMinutes: 10, emailConfigured?, devPreview? } (200) or 429 with cooldownSeconds."),
            ('POST', '/api/auth/forgot-password/verify-otp', 'Open',
             'Validates OTP against latest unused PasswordReset doc. Max 5 attempts. On success issues 10-min signed resetToken JWT.',
             '{ email: string, otp: string } (6 digits)',
             '{ message, resetToken, email } or 401/410/429 with attemptsLeft.'),
            ('POST', '/api/auth/forgot-password/reset', 'Open (resetToken)',
             'Sets new password. Verifies resetToken JWT, checks PasswordReset doc is still verified && !used, updates password (bcrypt rounds=12), marks doc as used.',
             '{ email, resetToken, newPassword, confirmPassword } (min 6, max 256 chars)',
             '{ message, email } or 401/403/404.'),
            ('GET', '/api/users', 'requireAdmin',
             'List all users (passwords stripped), newest first.',
             'none',
             '{ users: User[] }.'),
            ('POST', '/api/users', 'requireAdmin',
             'Create a new user.',
             "{ name, email (valid), password (>=6 chars), role: 'admin'|'operator'|'accountant', active?: boolean }",
             '{ user: UserWithoutPassword } (201). 400 on duplicate email/invalid role/short password.'),
            ('GET', '/api/users/[id]', 'requireAdmin',
             'Fetch one user by ObjectId.', 'none', '{ user: UserWithoutPassword } or 404.'),
            ('PUT', '/api/users/[id]', 'requireAdmin',
             'Update user fields. Optional password change (re-hashed at rounds=12).',
             'partial { name?, email?, role?, active?, password? }',
             '{ user: UserWithoutPassword }.'),
            ('DELETE', '/api/users/[id]', 'requireAdmin',
             'Delete a user. Blocks self-delete and deleting the last active admin.', 'none',
             "{ message: 'User deleted successfully' } or 400 (self-delete / last admin)."),
            ('POST', '/api/users/bulk-delete', 'Admin only',
             'Bulk delete users. Blocks self-delete and last-admin deletion.',
             '{ ids: string[] } (non-empty)',
             '{ message, deletedCount, requestedCount } or 404.'),
            ('POST', '/api/users/bulk-update', 'Admin only',
             'Bulk activate/deactivate users. Blocks self-deactivation and last-admin deactivation.',
             '{ ids: string[], active: boolean }',
             '{ message, modifiedCount, matchedCount, requestedCount, active }.'),
        ]
    },
    {
        'num': '2',
        'title': 'Company & Settings',
        'endpoints': [
            ('GET', '/api/company', 'requireSession',
             'Fetch the single Company record (creates one with Veda defaults if missing; backfills empty contact fields; migrates stale tagline strings).',
             'none',
             '{ company: Company } (fields: name, tagline, address, city, state, pincode, phone, email, gstNumber, panNumber, logoUrl, primaryColor, bankName, bankAccount, bankIfsc, invoicePrefix, dispatchPrefix, orderPrefix, terms, signatureName, setupComplete).'),
            ('PUT', '/api/company', 'requireAdmin',
             'Update company fields. Auto-marks setupComplete=true once name+address+phone+gstNumber are all present.',
             'partial of any Company field',
             '{ company: Company }.'),
        ]
    },
    {
        'num': '3',
        'title': 'Dashboard & Reports',
        'endpoints': [
            ('GET', '/api/dashboard', 'requireSession',
             'Classic dashboard aggregate. Today production, total stock, today dispatch, pending orders, outstanding payments, monthly sales/profit/expense, recent productions + dispatches, monthly production + expense chart data.',
             'none',
             '{ todayProduction, totalStock, todayDispatch, pendingOrders, outstandingPayments, monthlySales, monthlyProfit, recentProductions, recentDispatches, monthlyProductionData, monthlyExpenseData }.'),
            ('GET', '/api/dashboard/stats', 'requireSession',
             'Single-call KPI endpoint (replaces 11 separate dashboard calls). Aggregates today production/sales/labour/customer-payments/tractor-remaining/dust/cement/hardner/electricity/factory-stuff + stock totals + net cash flow.',
             'none',
             '{ todayProduction, todaySales, todayLabourPayments, todayCustomerPayments, totalTractorRemaining, todayDustPurchase, todayCementPurchase, todayHardner, todayElectricity, todayFactoryStuff, totalStock, totalStockCement, totalExpensesToday, netCashFlow }.'),
            ('GET', '/api/reports', 'requireSession',
             'Multi-mode report generator. Switch on ?type= (sales|production|stock|profit-loss|outstanding|customer-ledger). Optional month/from/to date filters.',
             '?type=, ?month=YYYY-MM, ?from=YYYY-MM-DD, ?to=YYYY-MM-DD',
             'Response varies by type: sales={data,totalSales}, production={data,totalProduced,byBrickType}, stock={data,totalCurrentStock,totalOpeningStock,lowStockItems}, profit-loss={reportType,month,totalRevenue,totalExpenses,netProfit,expensesByCategory}, outstanding={data,totalOutstanding}, customer-ledger={customerLedger}.'),
            ('GET', '/api (root)', 'Open',
             'Health check endpoint.', 'none',
             "{ status: 'ok', message: 'Veda Enterprises ERP API is running' }."),
        ]
    },
    {
        'num': '4',
        'title': 'Customers',
        'endpoints': [
            ('GET', '/api/customers', 'requireSession',
             'Paginated customer list with search.',
             '?search= (regex on name/mobile), ?page= (default 1), ?limit= (default 100, max 500)',
             '{ customers: Customer[], total, page, limit, totalPages }.'),
            ('POST', '/api/customers', "requireRole(['admin','operator'])",
             'Create a new customer.',
             '{ name, mobile, gstNumber?, address?, creditLimit? }',
             '{ customer: Customer } (201).'),
            ('GET', '/api/customers/[id]', 'requireSession', 'Fetch one customer by ObjectId.', 'none', '{ customer: Customer } or 404.'),
            ('PUT', '/api/customers/[id]', "requireRole(['admin','operator'])",
             'Update customer fields.', 'partial { name?, mobile?, gstNumber?, address?, creditLimit? }', '{ customer: Customer }.'),
            ('DELETE', '/api/customers/[id]', "requireRole(['admin','operator'])",
             'Delete a customer.', 'none', "{ message: 'Customer deleted successfully' }."),
            ('POST', '/api/customers/bulk-delete', 'Admin/Operator',
             'Bulk delete customers; nulls out customerId references in Order/Payment/CustomerPayment/Production/Dispatch.',
             '{ ids: string[] }', '{ message, deletedCount, requestedCount }.'),
            ('GET', '/api/customers/[id]/history', 'requireSession',
             'Customer ledger: orders, dispatches, payments, customer payments + merged sorted timeline[] and summary aggregations.',
             'none', '{ customer, summary, orders, dispatches, payments, customerPayments, timeline }.'),
            ('GET', '/api/customers/[id]/bill-history', 'requireSession',
             'Bill generation context: customer record, productions, dispatches, bills, orders, payments, aggregated product totals.',
             'none', '{ customer, productions, dispatches, bills, orders, payments, productFields, summary: {...} }.'),
        ]
    },
    {
        'num': '5',
        'title': 'Production & Stock',
        'endpoints': [
            ('GET', '/api/production', 'requireSession',
             'List all production entries (date-desc).', '?date=YYYY-MM-DD', '{ productions: Production[] }.'),
            ('POST', '/api/production', "requireRole(['admin','operator'])",
             'Create production entry. Calls syncStockForDate(date) to update Stock snapshot.',
             '{ date, customerId?, cement?, zigZagGrey80?, zigZagRed80?, zigZagYellow80?, zigZagGrey60?, zigZagRed60?, zigZagYellow60?, curveStone?, chequreTile?, dumbleGrey80?, dumbleRed80?, dumbleYellow80?, transportationCharge?, remarks? }',
             '{ production: Production } (201).'),
            ('DELETE', '/api/production?all=true', 'requireAdmin',
             'Wipes ALL production + ALL stock entries. ?all=true REQUIRED.', '?all=true', '{ message, deletedCount }.'),
            ('GET', '/api/production/[id]', 'requireSession', 'Fetch one production entry.', 'none', '{ production: Production } or 404.'),
            ('PUT', '/api/production/[id]', "requireRole(['admin','operator'])",
             'Update production entry. Re-syncs Stock snapshot for the date.', 'partial Production fields', '{ production: Production }.'),
            ('DELETE', '/api/production/[id]', "requireRole(['admin','operator'])",
             'Delete production entry. Re-syncs Stock snapshot for the date.', 'none',
             "{ message: 'Production entry deleted successfully' }."),
            ('POST', '/api/production/bulk-delete', 'Admin/Operator',
             'Bulk delete production. Re-aggregates Stock snapshots for every touched date.', '{ ids: string[] }',
             '{ message, deletedCount, requestedCount, stockResyncedDates }.'),
            ('GET', '/api/stock', 'requireSession', 'List all stock entries (date-desc).', 'none', '{ stocks: Stock[] }.'),
            ('POST', '/api/stock', 'requireAdmin',
             'Create stock entry OR bulk-delete (dispatches by body shape).',
             'Create: { date, cement?, ... } / Bulk-delete: { ids: string[] }',
             '{ stock: Stock } (201) or { message, deletedCount }.'),
            ('DELETE', '/api/stock?all=true', 'requireAdmin',
             'Wipe every stock entry. ?all=true REQUIRED.', '?all=true', '{ message, deletedCount }.'),
            ('GET', '/api/stock/[id]', 'requireSession', 'Fetch one stock entry.', 'none', '{ stock: Stock } or 404.'),
            ('PUT', '/api/stock/[id]', "requireRole(['admin','operator'])",
             'Update stock entry. Accepts backward-compat aliases like zigZagGrey80mm.', 'partial Stock fields', '{ stock: Stock }.'),
            ('DELETE', '/api/stock/[id]', "requireRole(['admin','operator'])",
             'Delete stock entry.', 'none', "{ message: 'Stock entry deleted successfully' }."),
            ('GET', '/api/stock/summary', 'requireSession',
             'Item-wise stock summary: one row per product (12 products) showing totalProduction, sellItem, availableQuantity, previousYearStock, latestDate, latestQuantity, productionDays. Single-pass aggregation.',
             'none', '{ summary: SummaryRow[] }.'),
        ]
    },
    {
        'num': '6',
        'title': 'Orders & Dispatch',
        'endpoints': [
            ('GET', '/api/orders', 'requireSession',
             'List all orders with populated customer field.', 'none', '{ orders: Order[] }.'),
            ('POST', '/api/orders', "requireRole(['admin','operator'])",
             'Create order. Generates orderNumber ORD-####. Supports single brickType or multi-item orders.',
             '{ customerId, deliveryDate, status?, brickType?, quantity?, rate?, amount?, items?: [{ description, hsn?, unit?, quantity, rate, amount? }] }',
             '{ order: Order } (201).'),
            ('GET', '/api/orders/[id]', 'requireSession', 'Fetch one order.', 'none', '{ order: Order }.'),
            ('PUT', '/api/orders/[id]', "requireRole(['admin','operator'])",
             'Update order. If items[] provided, recomputes summary fields.',
             'partial { customerId?, brickType?, quantity?, rate?, amount?, deliveryDate?, status?, items? }',
             '{ order: Order }.'),
            ('DELETE', '/api/orders/[id]', "requireRole(['admin','operator'])",
             'Delete order. Does NOT cascade-delete linked Bills/Dispatches.', 'none',
             "{ message: 'Order deleted successfully' }."),
            ('POST', '/api/orders/bulk-delete', 'Admin/Operator',
             'Bulk delete orders.', '{ ids: string[] }', '{ message, deletedCount, requestedCount }.'),
            ('GET', '/api/dispatch', 'requireSession',
             'List all dispatches with customer + order populated.', 'none', '{ dispatches: Dispatch[] }.'),
            ('POST', '/api/dispatch', "requireRole(['admin','operator'])",
             'Create dispatch. Auto-decrements Stock.currentStock for the matching brickType.',
             '{ customerId, orderId?, truckNumber, driverName?, quantity, brickType, date }',
             '{ dispatch: Dispatch } (201).'),
            ('GET', '/api/dispatch/[id]', 'requireSession', 'Fetch one dispatch.', 'none', '{ dispatch: Dispatch }.'),
            ('PUT', '/api/dispatch/[id]', "requireRole(['admin','operator'])",
             'Update dispatch.', 'partial dispatch fields', '{ dispatch: Dispatch }.'),
            ('DELETE', '/api/dispatch/[id]', "requireRole(['admin','operator'])",
             'Delete dispatch. Restores Stock.currentStock by the deleted quantity.', 'none',
             "{ message: 'Dispatch deleted successfully' }."),
            ('POST', '/api/dispatch/bulk-delete', 'Admin/Operator',
             'Bulk delete dispatches.', '{ ids: string[] }', '{ message, deletedCount, requestedCount }.'),
        ]
    },
    {
        'num': '7',
        'title': 'Daily Sell & Payments',
        'endpoints': [
            ('GET', '/api/daily-sell', "requireRole(['admin','operator','accountant'])",
             'List all daily sell entries (date-desc).', 'none', '{ dailySells: DailySell[] }.'),
            ('POST', '/api/daily-sell', "requireRole(['admin','operator','accountant'])",
             'Create daily sell entry OR bulk-delete (admin-only branch). Create triggers syncAllFromDailySell() which mirrors into Customer, Order, CustomerPayment, Payment, TractorPayment + Stock.',
             'Create: { date, customerName, address?, contactNumber?, product?, quantity?, rate?, amount, transporterName?, transporterFair?, receivedAmount?, remarks? } / Bulk-delete: { ids: string[] } (admin only)',
             '{ dailySell: DailySell } (201) or { message, deletedCount }.'),
            ('DELETE', '/api/daily-sell?all=true', 'requireAdmin',
             'Wipe all daily sell entries. Runs cleanupDailySellLinks() for every record. ?all=true REQUIRED.', '?all=true',
             '{ message, deletedCount }.'),
            ('GET', '/api/daily-sell/[id]', 'requireSession', 'Fetch one daily sell entry.', 'none', '{ dailySell: DailySell } or 404.'),
            ('PUT', '/api/daily-sell/[id]', "requireRole(['admin','operator','accountant'])",
             'Update daily sell entry. Auto-recomputes pendingAmount. Re-runs cleanup+sync so mirrors stay fresh.',
             'partial { date, customerName, address, contactNumber, product, quantity, rate, amount, transporterName, transporterFair, receivedAmount, remarks }',
             '{ dailySell: DailySell }.'),
            ('DELETE', '/api/daily-sell/[id]', "requireRole(['admin','operator','accountant'])",
             'Delete daily sell entry. Runs cleanupDailySellLinks() to remove mirrored records.', 'none',
             "{ message: 'Daily sell entry deleted successfully' }."),
            ('GET', '/api/customer-payment', 'requireSession', 'List all customer payments (date-desc).', 'none', '{ customerPayments: CustomerPayment[] }.'),
            ('POST', '/api/customer-payment', "requireRole(['admin','operator','accountant'])",
             'Create customer payment.', '{ date, name, address?, amount, remarks? }', '{ customerPayment: CustomerPayment } (201).'),
            ('GET', '/api/customer-payment/[id]', 'requireSession', 'Fetch one customer payment.', 'none', '{ customerPayment: CustomerPayment }.'),
            ('PUT', '/api/customer-payment/[id]', "requireRole(['admin','operator','accountant'])",
             'Update customer payment.', 'partial { date?, name?, address?, amount?, remarks? }', '{ customerPayment: CustomerPayment }.'),
            ('DELETE', '/api/customer-payment/[id]', "requireRole(['admin','operator','accountant'])",
             'Delete customer payment.', 'none', "{ message: 'customerPayment entry deleted successfully' }."),
            ('POST', '/api/customer-payment/bulk-delete', 'Admin/Operator',
             'Bulk delete customer payments.', '{ ids: string[] }', '{ message, deletedCount, requestedCount }.'),
            ('GET', '/api/labour-payment', 'requireSession', 'List all labour payments (date-desc).', 'none', '{ labourPayments: LabourPayment[] }.'),
            ('POST', '/api/labour-payment', "requireRole(['admin','operator','accountant'])",
             'Create labour payment.', '{ date, name, address?, amount, remarks? }', '{ labourPayment: LabourPayment } (201).'),
            ('GET', '/api/labour-payment/[id]', 'requireSession', 'Fetch one.', 'none', '{ labourPayment: LabourPayment }.'),
            ('PUT', '/api/labour-payment/[id]', "requireRole(['admin','operator','accountant'])",
             'Update labour payment.', 'partial { date?, name?, address?, amount?, remarks? }', '{ labourPayment: LabourPayment }.'),
            ('DELETE', '/api/labour-payment/[id]', "requireRole(['admin','operator','accountant'])",
             'Delete labour payment.', 'none', "{ message: 'labourPayment entry deleted successfully' }."),
            ('POST', '/api/labour-payment/bulk-delete', 'Admin/Operator',
             'Bulk delete labour payments.', '{ ids: string[] }', '{ message, deletedCount, requestedCount }.'),
            ('GET', '/api/tractor-payment', 'requireSession', 'List all tractor payments (date-desc).', 'none', '{ tractorPayments: TractorPayment[] }.'),
            ('POST', '/api/tractor-payment', "requireRole(['admin','operator','accountant'])",
             'Create tractor payment. Computes totalAmount = quantityTon x rate and remainingAmount = totalAmount - paidAmount.',
             '{ date, vendorName, quantityTon, rate, paidAmount?, remarks?, type?: "tractor"|"transporter", linkedDailySellId? }',
             '{ tractorPayment: TractorPayment } (201).'),
            ('GET', '/api/tractor-payment/[id]', 'requireSession', 'Fetch one.', 'none', '{ tractorPayment: TractorPayment }.'),
            ('PUT', '/api/tractor-payment/[id]', "requireRole(['admin','operator','accountant'])",
             'Update tractor payment.', 'partial tractor payment fields', '{ tractorPayment: TractorPayment }.'),
            ('DELETE', '/api/tractor-payment/[id]', "requireRole(['admin','operator','accountant'])",
             'Delete tractor payment.', 'none', "{ message: 'tractorPayment entry deleted successfully' }."),
            ('POST', '/api/tractor-payment/bulk-delete', 'Admin/Operator',
             'Bulk delete tractor payments.', '{ ids: string[] }', '{ message, deletedCount, requestedCount }.'),
            ('GET', '/api/payments', 'requireSession',
             'List all payments with customer populated. Links to Bill via billId/billNumber and mirrors to CustomerPayment via customerPaymentId.',
             'none', '{ payments: Payment[] }.'),
            ('POST', '/api/payments', "requireRole(['admin','accountant'])",
             'Create payment. If billId provided, recomputes Bills paidAmount/balanceAmount/status. Mirrors into CustomerPayment.',
             '{ customerId, paymentType, amount, date, remarks?, billId? }', '{ payment: Payment } (201).'),
            ('GET', '/api/payments/[id]', 'requireSession', 'Fetch one payment.', 'none', '{ payment: Payment }.'),
            ('PUT', '/api/payments/[id]', "requireRole(['admin','accountant'])",
             'Update payment. If billId changed, re-syncs both old and new Bills. Mirrors update into CustomerPayment.',
             'partial { customerId?, paymentType?, amount?, date?, remarks?, billId? }', '{ payment: Payment }.'),
            ('DELETE', '/api/payments/[id]', "requireRole(['admin','accountant'])",
             'Delete payment. Runs syncDeleteCustomerPayment(id) to remove mirror. Re-syncs linked Bills paidAmount.',
             'none', "{ message: 'Payment deleted successfully' }."),
            ('POST', '/api/payments/bulk-delete', 'Admin/Operator',
             'Bulk delete payments. Runs syncDeleteCustomerPayment(id) for each.', '{ ids: string[] }',
             '{ message, deletedCount, requestedCount }.'),
        ]
    },
    {
        'num': '8',
        'title': 'Purchases',
        'endpoints': [
            ('GET', '/api/dust-purchase', 'requireSession', 'List dust purchases (date-desc).', 'none', '{ dustPurchases: DustPurchase[] }.'),
            ('POST', '/api/dust-purchase', "requireRole(['admin','operator','accountant'])",
             'Create dust purchase. Computes totalAmount = quantity x rate.',
             '{ date, vendorName, cementName?, quantity, rate, paidAmount?, transportationCharge?, gst?, remarks? }',
             '{ dustPurchase: DustPurchase } (201).'),
            ('GET', '/api/dust-purchase/[id]', 'requireSession', 'Fetch one.', 'none', '{ dustPurchase: DustPurchase }.'),
            ('PUT', '/api/dust-purchase/[id]', "requireRole(['admin','operator','accountant'])",
             'Update dust purchase.', 'partial fields', '{ dustPurchase: DustPurchase }.'),
            ('DELETE', '/api/dust-purchase/[id]', "requireRole(['admin','operator','accountant'])",
             'Delete dust purchase.', 'none', "{ message: 'dustPurchase entry deleted successfully' }."),
            ('POST', '/api/dust-purchase/bulk-delete', 'Admin/Operator',
             'Bulk delete dust purchases.', '{ ids: string[] }', '{ message, deletedCount, requestedCount }.'),
            ('GET', '/api/cement-purchase', 'requireSession', 'List cement purchases (date-desc).', 'none', '{ cementPurchases: CementPurchase[] }.'),
            ('POST', '/api/cement-purchase', "requireRole(['admin','operator','accountant'])",
             'Create cement purchase. Computes totalAmount = quantity x rate.',
             '{ date, vendorName, itemName?, quantity, rate, paidAmount?, transportationCharge?, gst?, remarks? }',
             '{ cementPurchase: CementPurchase } (201).'),
            ('GET', '/api/cement-purchase/[id]', 'requireSession', 'Fetch one.', 'none', '{ cementPurchase: CementPurchase }.'),
            ('PUT', '/api/cement-purchase/[id]', "requireRole(['admin','operator','accountant'])",
             'Update cement purchase.', 'partial fields', '{ cementPurchase: CementPurchase }.'),
            ('DELETE', '/api/cement-purchase/[id]', "requireRole(['admin','operator','accountant'])",
             'Delete cement purchase.', 'none', "{ message: 'cementPurchase entry deleted successfully' }."),
            ('POST', '/api/cement-purchase/bulk-delete', 'Admin/Operator',
             'Bulk delete cement purchases.', '{ ids: string[] }', '{ message, deletedCount, requestedCount }.'),
        ]
    },
    {
        'num': '9',
        'title': 'Misc Expenses',
        'endpoints': [
            ('GET', '/api/hardner', 'requireSession', 'List hardners (date-desc).', 'none', '{ hardners: Hardner[] }.'),
            ('POST', '/api/hardner', "requireRole(['admin','operator','accountant'])",
             'Create hardner entry (only 2 fields!).', '{ date, amount }', '{ hardner: Hardner } (201).'),
            ('GET', '/api/hardner/[id]', 'requireSession', 'Fetch one.', 'none', '{ hardner: Hardner }.'),
            ('PUT', '/api/hardner/[id]', "requireRole(['admin','operator','accountant'])",
             'Update hardner.', 'partial { date?, amount? }', '{ hardner: Hardner }.'),
            ('DELETE', '/api/hardner/[id]', "requireRole(['admin','operator','accountant'])",
             'Delete hardner.', 'none', "{ message: 'hardner entry deleted successfully' }."),
            ('POST', '/api/hardner/bulk-delete', 'Admin/Operator',
             'Bulk delete hardners.', '{ ids: string[] }', '{ message, deletedCount, requestedCount }.'),
            ('GET', '/api/electricity', 'requireSession',
             'List electricity entries (date-desc). Note: response key is electricitys (not electricities).',
             'none', '{ electricitys: Electricity[] }.'),
            ('POST', '/api/electricity', "requireRole(['admin','operator','accountant'])",
             'Create electricity entry.', '{ date, name?, work?, amount, remarks? }', '{ electricity: Electricity } (201).'),
            ('GET', '/api/electricity/[id]', 'requireSession', 'Fetch one.', 'none', '{ electricity: Electricity }.'),
            ('PUT', '/api/electricity/[id]', "requireRole(['admin','operator','accountant'])",
             'Update electricity.', 'partial { date?, name?, work?, amount?, remarks? }', '{ electricity: Electricity }.'),
            ('DELETE', '/api/electricity/[id]', "requireRole(['admin','operator','accountant'])",
             'Delete electricity.', 'none', "{ message: 'electricity entry deleted successfully' }."),
            ('POST', '/api/electricity/bulk-delete', 'Admin/Operator',
             'Bulk delete electricity entries.', '{ ids: string[] }', '{ message, deletedCount, requestedCount }.'),
            ('GET', '/api/factory-stuff', 'requireSession', 'List factory stuff entries (date-desc).', 'none', '{ factoryStuffs: FactoryStuff[] }.'),
            ('POST', '/api/factory-stuff', "requireRole(['admin','operator','accountant'])",
             'Create factory stuff entry.', '{ date, itemName, quantity?, amount, remarks? }', '{ factoryStuff: FactoryStuff } (201).'),
            ('GET', '/api/factory-stuff/[id]', 'requireSession', 'Fetch one.', 'none', '{ factoryStuff: FactoryStuff }.'),
            ('PUT', '/api/factory-stuff/[id]', "requireRole(['admin','operator','accountant'])",
             'Update factory stuff.', 'partial { date?, itemName?, quantity?, amount?, remarks? }', '{ factoryStuff: FactoryStuff }.'),
            ('DELETE', '/api/factory-stuff/[id]', "requireRole(['admin','operator','accountant'])",
             'Delete factory stuff.', 'none', "{ message: 'factoryStuff entry deleted successfully' }."),
            ('POST', '/api/factory-stuff/bulk-delete', 'Admin/Operator',
             'Bulk delete factory stuff entries.', '{ ids: string[] }', '{ message, deletedCount, requestedCount }.'),
            ('GET', '/api/expenses', 'requireSession',
             'List expenses (date-desc). Supports category and date filters.',
             '?category= (exact), ?date= (single OR from,to comma-pair)', '{ expenses: Expense[] }.'),
            ('POST', '/api/expenses', "requireRole(['admin','accountant'])",
             'Create expense. Note: operators NOT allowed (admin+accountant only).',
             '{ category, amount, date, description? }', '{ expense: Expense } (201).'),
            ('GET', '/api/expenses/[id]', 'requireSession', 'Fetch one.', 'none', '{ expense: Expense }.'),
            ('PUT', '/api/expenses/[id]', "requireRole(['admin','accountant'])",
             'Update expense.', 'partial { category?, amount?, date?, description? }', '{ expense: Expense }.'),
            ('DELETE', '/api/expenses/[id]', "requireRole(['admin','accountant'])",
             'Delete expense.', 'none', "{ message: 'Expense deleted successfully' }."),
            ('POST', '/api/expenses/bulk-delete', 'Admin/Operator',
             'Bulk delete expenses.', '{ ids: string[] }', '{ message, deletedCount, requestedCount }.'),
        ]
    },
    {
        'num': '10',
        'title': 'Bills / Invoicing',
        'endpoints': [
            ('GET', '/api/bills', 'requireSession',
             'List bills (createdAt-desc). Supports billType, status, search filters.',
             '?billType=, ?status= (draft|partial|paid|sent), ?search= (regex on billNumber/toName/toPhone)',
             '{ bills: Bill[] }.'),
            ('POST', '/api/bills', 'requireSession',
             'Create bill. Generates billNumber = BILL-YYYYMM-####. Computes subTotal, taxableAmount, GST amounts, grandTotal, roundOff, balanceAmount. Auto-status. Pulls "from" defaults from Company. If customerId + paidAmount>0, auto-creates linked Payment.',
             '{ billType?, date?, dueDate?, customerId?, fromName?, fromAddress?, fromGst?, fromPhone?, toName, toAddress?, toGst?, toPhone?, items: [{ description, hsn?, quantity, unit?, rate, amount? }], discountPercent?, discountAmount?, cgstPercent?, cgstAmount?, sgstPercent?, sgstAmount?, igstPercent?, igstAmount?, paidAmount?, paymentMode?, notes?, terms?, status? }',
             '{ bill: Bill } (201).'),
            ('GET', '/api/bills/[id]', 'requireSession', 'Fetch one bill.', 'none', '{ bill: Bill } or 404.'),
            ('PUT', '/api/bills/[id]', 'requireSession',
             'Update bill. If items[] provided, recomputes all amounts. Keeps linked Payment mirror in sync.',
             'partial Bill fields', '{ bill: Bill }.'),
            ('DELETE', '/api/bills/[id]', 'requireAdmin',
             'Delete bill. Cascades: deletes auto-synced Payment mirror. Manual Payments never touched.',
             'none', "{ message: 'Bill deleted successfully' }."),
        ]
    },
    {
        'num': '11',
        'title': 'Excel Import',
        'endpoints': [
            ('GET', '/api/import', 'Open',
             'Returns the import template schema. Lists all 12 importable modules and their required fields.',
             'none',
             '{ modules: [{ id, label, fields: string[] }] }.'),
            ('POST', '/api/import', "requireRole(['admin','operator'])",
             'Bulk-import rows for the specified module. Max 5000 rows. Server-side date normalization. Duplicate detection by natural key (duplicates skipped). Uses insertMany. Re-syncs Stock for touched production dates.',
             '{ module: string, data: Array<RowObject> }',
             '{ imported, skipped, duplicatesSkipped, errors: string[], skippedReasons: string[] }.'),
        ]
    },
    {
        'num': '12',
        'title': 'Admin & Debug',
        'endpoints': [
            ('GET', '/api/admin/fix-indexes', 'requireAdmin',
             'One-shot DB fix. Drops stale indexes from stocks and productions, recreates date_-1 index. Idempotent.',
             'none', '{ collections: { stocks: { indexesBefore, stale, dropped, indexesAfter }, productions: {...} }, timestamp }.'),
            ('GET', '/api/admin/sync-all-stock', 'requireAdmin',
             'One-shot backfill. Finds all distinct production dates and re-syncs each into Stock collection.',
             'none', '{ timestamp, datesFound, dates, succeeded, failed, failures: [{ date, error }] }.'),
            ('GET', '/api/database', 'requireAdmin',
             'Export full backup of all 19 collections. User passwords STRIPPED.',
             'none', '{ version: 2, exportedAt, data: { ...collections... }, counts }.'),
            ('PUT', '/api/database', 'requireAdmin',
             'MERGE restore (not REPLACE). Same-_id docs replaced, new-_id inserted, missing docs preserved. Users collection SKIPPED. Uses bulkWrite replaceOne + upsert.',
             'Backup file (v2/unwrapped/raw shapes)', '{ message, mode: "merge", counts: { inserted, replaced }, perCollection, errors? }.'),
            ('DELETE', '/api/database', 'requireAdmin',
             'Clears ALL transactional data (17 collections). Preserves only companies and users.',
             'none', '{ message, cleared: { customers: N, productions: N, ... } }.'),
            ('GET', '/api/database/clear-section', 'Admin',
             'Lists the 17 clearable collections with current counts.', 'none', '{ sections: [{ key, label, count }] }.'),
            ('POST', '/api/database/clear-section', 'Admin',
             'Clears one specific collection.', '{ collection: string }', '{ message, collection, label, deletedCount }.'),
            ('GET', '/api/debug/sync', 'requireAdmin',
             'Runs syncStockForDate(date) and returns step-by-step debug info.', '?date=YYYY-MM-DD REQUIRED',
             '{ input_date, steps: [{ step, ok, ... }] }.'),
            ('GET', '/api/debug/payment-sync', 'requireAdmin',
             'Diagnostic snapshot of Payment-CustomerPayment link state. Up to 20 recent records each, summary counts, unlinked payments.',
             'none', '{ summary, unlinkedPayments, recentPayments, recentCustomerPayments }.'),
            ('POST', '/api/debug/payment-sync/backfill', 'requireAdmin',
             'One-time backfill. For every Payment missing customerPaymentId, creates missing CustomerPayment mirror and links it.',
             'none', '{ totalScanned, successCount, failureCount, results: [{ paymentId, ok, error? }] }.'),
        ]
    },
    {
        'num': '13',
        'title': 'AI',
        'endpoints': [
            ('GET', '/api/ai/config', 'requireSession',
             'Returns AI config with API key MASKED (last 4 chars only). Defaults if no config exists.',
             'none', "{ provider: 'openai'|'groq', enabled, model, hasKey, keyMasked }."),
            ('PUT', '/api/ai/config', 'requireAdmin',
             'Upserts AiConfig doc. Never echoes full key back (always masked).',
             "{ provider?, openaiApiKey? (empty clears), enabled?, model? }",
             'Same shape as GET (masked).'),
            ('POST', '/api/ai/parse', 'getSession (AI enabled)',
             'Calls OpenAI/Groq with module system prompt + user text. temperature=0, max_tokens=500, response_format: json_object, 12s timeout, 1 retry.',
             '{ module: string, text: string }',
             '{ fields: Record<string, unknown>, raw: Record<string, unknown> }. 403 if AI disabled. 502 if invalid JSON.'),
            ('POST', '/api/ai/test', 'Admin',
             'Test Connection button. Sends tiny ping to configured AI provider. 10s timeout, no retries.',
             'none',
             "{ ok: true, provider, model, latencyMs, responsePreview, parsedOk, message } or { ok: false, error, status }."),
        ]
    },
]

# ── Summary tables data ──

auth_table_data = [
    ['Open', '(none)', 'Anyone - /api, /api/auth/login, /api/auth/init, /api/auth/forgot-password/*, /api/import GET'],
    ['Session', 'requireSession / getSession', 'Any logged-in user'],
    ['Admin', 'requireAdmin or manual check', 'admin only'],
    ['Role', "requireRole(['admin','operator'])", 'admin + operator (accountants blocked)'],
    ['Role', "requireRole(['admin','operator','accountant'])", 'all roles (any logged-in user)'],
    ['Role', "requireRole(['admin','accountant'])", 'admin + accountant (operators blocked)'],
]

sync_table_data = [
    ['POST/PUT/DELETE /api/production/[id]', 'Re-syncs Stock snapshot for the touched date'],
    ['POST /api/daily-sell (create)', 'Mirrors into Customer + Order + CustomerPayment + Payment + TractorPayment + Stock'],
    ['PUT /api/daily-sell/[id]', 'Cleans up old mirrors, re-creates with new data'],
    ['DELETE /api/daily-sell/[id]', 'Cleans up linked mirrors (Customer preserved)'],
    ['POST /api/dispatch (create)', 'Decrements Stock.currentStock for the brickType'],
    ['DELETE /api/dispatch/[id]', 'Restores Stock.currentStock'],
    ['POST /api/bills (create)', 'If paidAmount>0 + customerId set, auto-creates linked Payment'],
    ['PUT /api/bills/[id]', 'Keeps Payment mirror in sync (upsert/delete)'],
    ['DELETE /api/bills/[id]', 'Cascades - deletes auto-synced Payment mirror'],
    ['POST/PUT/DELETE /api/payments/[id]', 'Mirrors into CustomerPayment + re-syncs linked Bills paidAmount/status'],
]

query_params_data = [
    ['?search=', '/api/customers, /api/bills', 'Case-insensitive regex (ReDoS-escaped)'],
    ['?page=, ?limit=', '/api/customers', 'Pagination (default 1/100, max 500)'],
    ['?date=YYYY-MM-DD', '/api/production, /api/debug/sync', 'Filter by exact date'],
    ['?all=true', 'DELETE /api/production, /api/stock, /api/daily-sell', 'Confirms bulk-wipe intent'],
    ['?month=YYYY-MM', '/api/reports', 'Month filter (sales/production/P&L)'],
    ['?from=, ?to=', '/api/reports', 'Date-range filter'],
    ['?type=', '/api/reports', 'Report mode switch (6 modes)'],
    ['?category=', '/api/expenses', 'Exact category match'],
    ['?date=from,to', '/api/expenses', 'Comma-pair date range (or single date)'],
    ['?billType=, ?status=', '/api/bills', 'Filter by bill type / payment status'],
    ['?key=', '/api/auth/init, /api/auth/reset-admin', 'Env-gate key (header or query alt)'],
]

# ── Build story ──
story = []

# Cover page
story.append(Spacer(1, 100*mm))
story.append(Paragraph('Veda ERP', ParagraphStyle('ct', fontName='Inter-Bold', fontSize=48, leading=52, textColor=HEADER_FILL, alignment=TA_CENTER)))
story.append(Spacer(1, 6*mm))
story.append(Paragraph('Complete API Reference', ParagraphStyle('cs', fontName='Inter', fontSize=22, leading=28, textColor=TEXT_MUTED, alignment=TA_CENTER)))
story.append(Spacer(1, 12*mm))
story.append(HRFlowable(width='40%', thickness=1.5, color=ACCENT, spaceAfter=12*mm, spaceBefore=0, hAlign='CENTER'))
story.append(Paragraph('79 Route Files | 13 Logical Sections', ParagraphStyle('ci', fontName='Inter-Italic', fontSize=12, leading=16, textColor=TEXT_MUTED, alignment=TA_CENTER)))
story.append(Spacer(1, 6*mm))
story.append(Paragraph('Base URL: /api | Auth: JWT in httpOnly cookie', ParagraphStyle('ci2', fontName='Inter', fontSize=10, leading=14, textColor=TEXT_MUTED, alignment=TA_CENTER)))
story.append(Spacer(1, 6*mm))
story.append(Paragraph('Roles: admin, operator, accountant', ParagraphStyle('ci3', fontName='Inter', fontSize=10, leading=14, textColor=TEXT_MUTED, alignment=TA_CENTER)))
story.append(PageBreak())

# Overview section
story.append(Paragraph('Overview', style_h1))
story.append(Spacer(1, 2*mm))
story.append(Paragraph(
    'This document provides a comprehensive reference for all API endpoints in the Veda Enterprises ERP system. '
    'The API follows a consistent RESTful pattern across all modules. Every collection module exposes a standard set of CRUD endpoints: '
    'a base route for listing (GET) and creating (POST), an [id] route for fetching (GET), updating (PUT), and deleting (DELETE) individual records, '
    'and a bulk-delete sub-route (POST) for batch operations. All routes use force-dynamic rendering with Cache-Control: no-store headers, '
    'ensuring that every request reflects the latest database state without any caching layer interference.',
    style_body
))
story.append(Spacer(1, 2*mm))
story.append(Paragraph(
    'Authentication is handled via JWT tokens stored in httpOnly cookies. The system supports three roles with graduated permissions: '
    'admin (full access to all operations including destructive ones), operator (can create and edit records but is restricted from certain '
    'financial and administrative operations), and accountant (read-mostly role that is explicitly blocked from most destructive operations '
    'like bulk-delete and data clearing). Several modules implement cross-module auto-sync logic, where creating, updating, or deleting '
    'a record in one module automatically triggers side effects in related modules to maintain data consistency.',
    style_body
))
story.append(Spacer(1, 2*mm))
story.append(Paragraph(
    'The API is built on Next.js App Router with MongoDB as the data store. Path parameters using [id] accept MongoDB ObjectId strings. '
    'Date normalization handles multiple formats including DD-MM-YYYY, DD/MM/YY, Excel serial numbers, and ISO strings. '
    'The system also includes an AI integration layer supporting OpenAI and Groq providers for intelligent data parsing, '
    'a full database backup and restore system with merge semantics, and a comprehensive Excel import pipeline supporting 12 modules.',
    style_body
))
story.append(Spacer(1, 4*mm))

# Table of Contents
story.append(Paragraph('Table of Contents', style_h1))
story.append(Spacer(1, 3*mm))
for sec in sections:
    story.append(Paragraph(f"Section {sec['num']}: {sec['title']}", style_toc_h1))
story.append(Spacer(1, 2*mm))
story.append(Paragraph('Summary Tables', style_toc_h1))
story.append(PageBreak())

# Sections
for sec in sections:
    story.append(Paragraph(f"Section {sec['num']}: {sec['title']}", style_h1))
    story.append(Spacer(1, 2*mm))
    
    for ep in sec['endpoints']:
        method, path, auth, purpose, body, response = ep
        story.append(Paragraph(method_tag(method, path), style_method))
        story.append(Paragraph(field_line('Auth', auth), style_field))
        story.append(Paragraph(field_line('Purpose', purpose), style_field))
        if body and body != 'none':
            story.append(Paragraph(field_line('Body', body), style_field))
        story.append(Paragraph(field_line('Response', response), style_field))
        story.append(Spacer(1, 3*mm))
    
    story.append(Spacer(1, 4*mm))

# Summary Tables section
story.append(Paragraph('Summary Tables', style_h1))
story.append(Spacer(1, 3*mm))

# Auth Quick Reference table
story.append(Paragraph('Authentication Quick Reference', style_h2))
story.append(Spacer(1, 2*mm))

auth_table = Table(
    [[Paragraph(h, style_table_header) for h in ['Auth Level', 'Function', 'Who']] + 
     [Paragraph(f'<b>{r[0]}</b>', style_table_cell), Paragraph(r[1], style_table_cell), Paragraph(r[2], style_table_cell)] 
     for r in auth_table_data],
    colWidths=[CONTENT_W*0.15, CONTENT_W*0.35, CONTENT_W*0.50],
    repeatRows=1,
)
auth_table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL),
    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
    ('FONTSIZE', (0, 0), (-1, -1), 8.5),
    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ('TOPPADDING', (0, 0), (-1, -1), 4),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, TABLE_STRIPE]),
]))
story.append(auth_table)
story.append(Spacer(1, 6*mm))

# Cross-Module Sync table
story.append(Paragraph('Cross-Module Auto-Sync Web', style_h2))
story.append(Spacer(1, 2*mm))
sync_table = Table(
    [[Paragraph(h, style_table_header) for h in ['Trigger', 'Effect']] + 
     [Paragraph(f'<b>{r[0]}</b>', style_table_cell), Paragraph(r[1], style_table_cell)] 
     for r in sync_table_data],
    colWidths=[CONTENT_W*0.40, CONTENT_W*0.60],
    repeatRows=1,
)
sync_table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL),
    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
    ('FONTSIZE', (0, 0), (-1, -1), 8.5),
    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ('TOPPADDING', (0, 0), (-1, -1), 4),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, TABLE_STRIPE]),
]))
story.append(sync_table)
story.append(Spacer(1, 6*mm))

# Query Params table
story.append(Paragraph('Special Query Parameters', style_h2))
story.append(Spacer(1, 2*mm))
query_table = Table(
    [[Paragraph(h, style_table_header) for h in ['Parameter', 'Routes', 'Description']] + 
     [Paragraph(f'<b>{r[0]}</b>', style_table_cell), Paragraph(r[1], style_table_cell), Paragraph(r[2], style_table_cell)] 
     for r in query_params_data],
    colWidths=[CONTENT_W*0.20, CONTENT_W*0.38, CONTENT_W*0.42],
    repeatRows=1,
)
query_table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL),
    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
    ('FONTSIZE', (0, 0), (-1, -1), 8.5),
    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ('TOPPADDING', (0, 0), (-1, -1), 4),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, TABLE_STRIPE]),
]))
story.append(query_table)
story.append(Spacer(1, 6*mm))

# Bulk-Delete pattern note
story.append(Paragraph('Bulk-Delete Pattern', style_h2))
story.append(Spacer(1, 2*mm))
story.append(Paragraph(
    'All bulk-delete routes accept <font face="Inter-Bold">{ ids: string[] }</font> and return '
    '<font face="Inter-Bold">{ message, deletedCount, requestedCount }</font>. They use getSession() + manual role check '
    'so admin/operator can call while accountant gets 403. Modules with dedicated bulk-delete sub-routes: customers, production, '
    'orders, dispatch, customer-payment, labour-payment, tractor-payment, payments, dust-purchase, cement-purchase, hardner, '
    'electricity, factory-stuff, expenses, users. Exceptions: daily-sell uses POST /api/daily-sell with { ids } body (admin-only branch); '
    'stock uses POST /api/stock with { ids } body; bills have no bulk-delete route (admin must delete one at a time via DELETE /api/bills/[id]).',
    style_body
))
story.append(Spacer(1, 4*mm))

# Delete-All pattern note
story.append(Paragraph('Delete-All Pattern (Admin Only)', style_h2))
story.append(Spacer(1, 2*mm))
story.append(Paragraph(
    'Several admin-only endpoints allow wiping entire collections. DELETE /api/production?all=true wipes all production entries '
    'and also wipes all stock entries since Stock is derived from Production. DELETE /api/stock?all=true wipes every stock entry independently. '
    'DELETE /api/daily-sell?all=true cleans up all linked mirrors before deleting. DELETE /api/database wipes all 17 transactional collections '
    'while preserving users and companies. POST /api/database/clear-section with { collection } allows wiping one specific collection at a time.',
    style_body
))
story.append(Spacer(1, 4*mm))

# Pluralization quirks
story.append(Paragraph('Pluralization Quirks', style_h2))
story.append(Spacer(1, 2*mm))
story.append(Paragraph(
    'Response JSON keys have inconsistent pluralization that developers should be aware of: /api/electricity returns '
    '{ electricitys: [...] } (not electricities), while other modules follow standard patterns like { customerPayments: [...] }, '
    '{ labourPayments: [...] }, { hardners: [...] }, and { factoryStuffs: [...] }. Single-item responses always use the singular form: '
    '{ customer: {...} }, { hardner: {...} }, { electricity: {...} }, { factoryStuff: {...} }, { dustPurchase: {...} }, { cementPurchase: {...} }, etc.',
    style_body
))

# ── Build PDF ──
output_path = '/home/z/my-project/download/Veda-ERP-API-Reference.pdf'

doc = SimpleDocTemplate(
    output_path,
    pagesize=A4,
    leftMargin=LEFT_M,
    rightMargin=RIGHT_M,
    topMargin=TOP_M,
    bottomMargin=BOT_M,
    title='Veda ERP - Complete API Reference',
    author='Z.ai',
    subject='API Reference Document',
    creator='Z.ai PDF Generator',
)

# Page number footer
def add_page_number(canvas, doc):
    page_num = canvas.getPageNumber()
    if page_num > 1:  # skip cover
        canvas.saveState()
        canvas.setFont('Inter', 8)
        canvas.setFillColor(TEXT_MUTED)
        canvas.drawCentredString(PAGE_W / 2, 12*mm, f'Veda ERP API Reference  |  Page {page_num}')
        canvas.restoreState()

doc.build(story, onFirstPage=lambda c, d: None, onLaterPages=add_page_number)

# Print result
import os
size = os.path.getsize(output_path)
print(f'PDF generated: {output_path}')
print(f'Size: {size / 1024:.1f} KB')
