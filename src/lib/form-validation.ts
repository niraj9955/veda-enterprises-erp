// ─── form-validation ────────────────────────────────────────────────────────
//
// Shared form-validation helpers used by every ERP module's create/edit form.
//
// The #1 user complaint: when someone clicks "Create" on an empty form, they
// see a confusing chain of toasts ("Date is required", then "Name is
// required", etc.). The user wants a SINGLE, simple popup instead:
//
//     "Please fill the Data"
//
// `isFormEmpty(values)` returns true if EVERY provided field is blank
// (empty string, null, undefined, or whitespace-only). Modules use it at the
// top of their handleSubmit to short-circuit with the unified message.

/**
 * Returns true if every value in `values` is "empty" — i.e., one of:
 *   - undefined / null
 *   - empty string after trim
 *   - the literal string "0" is considered EMPTY only if `treatZeroAsEmpty`
 *     is true (defaults to false — 0 is a valid quantity/amount)
 *
 * Typical usage:
 *
 *   if (isFormEmpty([formData.date, formData.name, formData.amount])) {
 *     toast({ title: 'Please fill the Data', description: 'Enter at least one field before saving.', variant: 'destructive' })
 *     return
 *   }
 */
export function isFormEmpty(
  values: Array<string | number | null | undefined>,
  options: { treatZeroAsEmpty?: boolean } = {}
): boolean {
  const { treatZeroAsEmpty = false } = options
  return values.every((v) => {
    if (v === null || v === undefined) return true
    if (typeof v === 'number') {
      return treatZeroAsEmpty ? v === 0 : false
    }
    const s = String(v).trim()
    if (s === '') return true
    if (treatZeroAsEmpty && s === '0') return true
    return false
  })
}

/**
 * Show a unified "Please fill the Data" toast.
 *
 * Returns the toast payload so the caller can pass it directly:
 *   toast(showPleaseFillDataToast())
 */
export function showPleaseFillDataToast() {
  return {
    title: 'Please fill the Data',
    description: 'Enter at least one field before saving.',
    variant: 'destructive' as const,
  }
}
