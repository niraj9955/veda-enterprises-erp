'use client'

import { ArrowLeft } from 'lucide-react'
import { useAppStore, type ModuleKey } from '@/lib/store'
import { cn } from '@/lib/utils'

// Display metadata for each module so the back button can show a
// friendly "Back to Dashboard" subtitle when relevant, and so we can
// render the *current* section name next to the back arrow.
const MODULE_LABEL: Record<Exclude<ModuleKey, 'dashboard'>, string> = {
  customers:        'Customers',
  production:       'Production',
  stock:            'Stock Overview',
  orders:           'Orders',
  dispatch:         'Dispatch',
  payments:         'Payments',
  expenses:         'Expenses',
  reports:          'Reports',
  settings:         'Settings',
  users:            'Users',
  admin:            'Admin Panel',
  dailySell:        'Daily Sell',
  customerPayment:  'Customer Payment',
  labourPayment:    'Labour Payment',
  tractorPayment:   'Tractor Payment',
  dustPurchase:     'Dust Purchase',
  cementPurchase:   'Cement Purchase',
  hardner:          'Hardner',
  electricity:      'Electricity',
  factoryStuff:     'Factory Stuff',
  bills:            'Billing',
}

interface Props {
  /**
   * Optional override for the "back" target. Defaults to Dashboard.
   * Use this when a section is logically a sub-page of another module
   * (e.g. Customer History should go back to Customers).
   */
  fallback?: ModuleKey
  className?: string
}

/**
 * SectionBackButton  (build: 2026-07-14 v2)
 *
 * A sticky, compact back button that sits at the top of every non-dashboard
 * section. Clicking it navigates the user back to the Dashboard (or to the
 * `fallback` module if provided).
 *
 * Why a single shared component instead of one button per module:
 *  - Zero risk of any section forgetting to include a back button.
 *  - Consistent styling and behaviour across all 20+ modules.
 *  - The current section name is shown next to the arrow so the user
 *    always knows where they are.
 */
export function SectionBackButton({ fallback = 'dashboard', className }: Props) {
  const { activeModule, setActiveModule } = useAppStore()

  // Never render on the dashboard — there's nowhere to go "back" to.
  if (activeModule === 'dashboard') return null

  const handleBack = () => {
    // If a fallback is provided and it isn't the current module, go there.
    // Otherwise default to dashboard.
    if (fallback && fallback !== activeModule) {
      setActiveModule(fallback)
    } else {
      setActiveModule('dashboard')
    }
  }

  const currentLabel = MODULE_LABEL[activeModule as Exclude<ModuleKey, 'dashboard'>] || ''
  const targetLabel = fallback === 'dashboard' ? 'Dashboard' : (MODULE_LABEL[fallback as Exclude<ModuleKey, 'dashboard'>] || fallback)

  return (
    <div
      className={cn(
        'sticky top-0 z-30 -mx-4 md:-mx-6 mb-3 md:mb-4 px-4 md:px-6 py-3',
        'bg-gradient-to-r from-emerald-50 to-white dark:from-emerald-950/40 dark:to-zinc-900',
        'border-b-2 border-emerald-200 dark:border-emerald-900/60 shadow-sm',
        className,
      )}
    >
      <div className="flex items-center gap-3 text-sm">
        <button
          type="button"
          onClick={handleBack}
          className={cn(
            'group inline-flex items-center gap-2 rounded-lg',
            'px-3 py-2 font-semibold text-sm',
            'bg-white dark:bg-zinc-800 text-emerald-700 dark:text-emerald-300',
            'border border-emerald-200 dark:border-emerald-800',
            'shadow-sm hover:shadow hover:bg-emerald-50 dark:hover:bg-emerald-950/50',
            'transition-all duration-150',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40',
          )}
          aria-label={`Back to ${targetLabel}`}
        >
          <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" />
          <span>Back to {targetLabel}</span>
        </button>
        {currentLabel && (
          <>
            <span className="text-zinc-300 dark:text-zinc-600 select-none" aria-hidden>·</span>
            <span className="px-2.5 py-1.5 rounded-md bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 font-bold text-xs uppercase tracking-wide shadow-sm">
              {currentLabel}
            </span>
          </>
        )}
      </div>
    </div>
  )
}

export default SectionBackButton
