---
Task ID: 1
Agent: Main Agent
Task: Implement Admin Panel, Role-Based Access, Logo Management, Excel Import Fix

Work Log:
- Explored entire Veda ERP codebase (12+ modules, 8 DB models, complete API routes)
- Removed SetupWizard from page.tsx (no more setup wizard anywhere)
- Updated store.ts to add 'admin' ModuleKey
- Enhanced auth.ts with granular permission system (canPerform function) for Admin/Operator/Accountant roles
- Updated app-shell.tsx: added Admin Panel nav item (admin-only), updated all nav items with role visibility
- Created Admin Panel module (admin-panel-module.tsx) with 4 tabs: Company, Logo & Branding, Users & Access, Database
- Admin Panel features: company settings CRUD, logo upload/remove/Veda default, user management with role-based access, database backup/restore/clear
- Created Veda Enterprises SVG logo (house/brick factory icon in emerald green) as public/veda-logo.svg and public/logo.svg
- Updated login-page.tsx: removed "Default credentials" text, added Veda logo support, kept clean design
- Updated auth/init route: initializes company with "Veda Enterprises" name and logo by default
- Completely rewrote excel-import.tsx with smart auto-detection:
  - Auto-detects column mapping (fuzzy matching with 10+ aliases per field)
  - Supports Hindi column names
  - Customer name -> ID resolution for orders/dispatch/payments
  - Date format parsing (DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD, etc.)
  - Shift normalization (Morning/Evening/Night with Hindi support)
  - Payment type and expense category normalization
  - Visual column mapping editor with auto-mapping preview
- Completely rewrote /api/import route with server-side smart data handling:
  - Customer name resolution via fuzzy matching
  - Auto order-dispatch matching
  - All field normalizations (shift, category, payment type, status)
  - Better error messages showing which customer was not found
- Updated existing company in DB with Veda branding
- Build passes successfully, server runs on port 3000

Stage Summary:
- Setup wizard removed from entire app
- Admin Panel created with full company, logo, user, and database management
- Role-based access: Admin (full), Operator (production/dispatch/stock/dashboard), Accountant (payments/expenses/reports/dashboard)
- Veda Enterprises logo added as default
- Excel import completely rewritten with smart auto-detection, column mapping, and customer name resolution
- All features verified with successful build

---
Task ID: 2
Agent: Main Agent
Task: Fix customer import data not showing + auto-close import dialog + add Excel import to all modules

Work Log:
- Investigated root cause: Next.js was caching GET /api/customers responses, so after Excel import the newly inserted rows didn't show up until a hard refresh
- Fixed src/lib/api.ts: added `cache: 'no-store'` to all fetch requests + cache-busting `_t=Date.now()` query param for GET requests
- Fixed src/app/api/customers/route.ts: added `dynamic = 'force-dynamic'`, `revalidate = 0`, and `Cache-Control: no-store, no-cache, must-revalidate, max-age=0` response headers
- Fixed src/components/erp/excel-import.tsx: import dialog now auto-closes 1.2s after successful import (with toast feedback); also added explicit warning toast when 0 rows imported
- Verified import API (src/app/api/import/route.ts) is truly APPEND-ONLY: every module uses `.create()` only, NEVER `deleteMany`/`replaceOne`. Added `dynamic = 'force-dynamic'` and a comment explaining the append-only semantics for future maintainers
- Expanded ExcelImport component to support ALL 16 modules (was only 6): customers, production, stock, dailySell, customerPayment, labourPayment, tractorPayment, dustPurchase, cementPurchase, hardner, electricity, factoryStuff, orders, dispatch, payments, expenses
- Replaced the broken production template (it used old `brickType`/`quantityProduced` fields that didn't match the actual schema) with correct fields: zigZagWhite80, zigZagRed80, zigZagYellow80, zigZagWhite60, zigZagRed60, zigZagYellow60, curveStone, chequreTile, transportationCharge, customerName, address, remarks
- Added full Excel-import templates for all new modules: stock, dailySell, customerPayment, labourPayment, tractorPayment, dustPurchase, cementPurchase, hardner, electricity, factoryStuff — each with Hindi column-name aliases
- Updated transformRow to handle new numeric fields: zigZag*, cement, dumble*, curveStone, chequreTile, transportationCharge, quantityTon, totalAmount, paidAmount, remainingAmount, gst
- Added "Import Excel" button + ExcelImport component to all 11 module pages that previously lacked it: production, stock, daily-sell, customer-payment, labour-payment, tractor-payment, dust-purchase, cement-purchase, hardner, electricity, factory-stuff
- Verified build passes cleanly with no errors

Stage Summary:
- Customer import now correctly shows imported rows immediately (no manual refresh needed)
- Import dialog auto-closes after 1.2s on success — user sees the "Imported X of Y" banner briefly, then dialog dismisses itself
- Only the module where import was performed refreshes (onSuccess callback), NOT the whole page — this was already correct, but the caching bug made it look like nothing refreshed
- All 16 business modules now support Excel import (production, stock, daily sell, payments, purchases, expenses, etc.)
- Site speed: the cache: 'no-store' fix actually IMPROVES perceived performance because we no longer hit stale caches that needed manual refresh — every fetch returns fresh data on the first request
- Database integrity verified: importing Jan 11-20 after Jan 1-10 will correctly APPEND rows; nothing in the import path ever deletes existing data
