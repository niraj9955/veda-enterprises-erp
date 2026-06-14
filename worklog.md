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
