// ─── Centralized date normalization ─────────────────────────────────────────
//
// Single source of truth for parsing user-supplied dates into canonical
// YYYY-MM-DD strings. Used by:
//   • excel-import.tsx (client-side Excel row transform)
//   • /api/import/route.ts (server-side defense-in-depth)
//   • /api/<module>/route.ts (POST/PUT — manual form entries, AI fills)
//   • ai-schemas.ts coerceFieldValue (AI assistant extracted dates)
//
// IMPORTANT — This is an Indian ERP. DD-MM-YYYY (day-first) is the DEFAULT.
// We NEVER use native `new Date(string)` as a fallback because JS interprets
// "05-06-2026" as MM-DD-YYYY (US format), which silently swaps day/month.
//
// Supported input formats (ANY separator among - / . or space, both lengths):
//   • YYYY-MM-DD          (already canonical — returned as-is, zero-padded)
//   • YYYY/MM/DD  YYYY.MM.DD  YYYY MM DD  YYYY-MM-DD
//   • DD-MM-YYYY  DD/MM/YYYY  DD.MM.YYYY  DD MM YYYY   (Indian default — day first)
//   • DD-MM-YY    DD/MM/YY    DD.MM.YY    DD MM YY     (short year → 20XX)
//   • MM-DD-YYYY  (US format — ONLY when first number > 12 forces day-first
//                  interpretation to fail, e.g. 13/01/2024 → Jan 13)
//   • Datetime strings like "2024-01-15 10:30:00" or "15-01-2024 10:30"
//     (time portion stripped before parsing)
//   • Excel serial numbers (e.g. 46178) — converted using UTC midnight
//   • JavaScript Date objects — converted using LOCAL getters (NOT UTC, to
//     avoid the IST off-by-one where midnight local = previous day 18:30 UTC)
//   • Fallback: today's date in YYYY-MM-DD (using LOCAL getters, not UTC).
//     This ensures a row is still inserted so the user can fix the date
//     manually if needed — better than dropping the row silently.
//
// AMBIGUITY RESOLUTION (when both day and month ≤ 12):
//   Default to DD-MM (Indian day-first). This matches what an Indian user
//   means when they type "05-06-2026" — they mean 5 June, not May 6.

/**
 * Normalize ANY date-like input into canonical YYYY-MM-DD string.
 * Returns '' for null/undefined. Returns today's date for unparseable input
 * (so a row is still inserted — user can fix the date manually).
 */
export function normalizeDate(value: unknown): string {
  // ── null / undefined ──
  if (value == null) return ''

  // ── JavaScript Date object (e.g. from XLSX cellDates:true) ──
  // Use LOCAL getters — Date objects represent local moments, and
  // toISOString() would shift the date back by one day in IST (UTC+5:30).
  if (value instanceof Date && !isNaN(value.getTime())) {
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  // ── Excel serial number (e.g. 46178 = 2026-06-05) ──
  // Excel epoch = 1899-12-30 (serial 0). Unix epoch = 1970-01-01 (serial 25569).
  // Use UTC getters because the serial represents a UTC midnight, and we want
  // that exact date without timezone shifting.
  if (typeof value === 'number' && Number.isFinite(value) && value > 59 && value < 60000) {
    const ms = Math.round((value - 25569) * 86400 * 1000)
    const d = new Date(ms)
    if (!isNaN(d.getTime())) {
      const y = d.getUTCFullYear()
      const m = String(d.getUTCMonth() + 1).padStart(2, '0')
      const day = String(d.getUTCDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    }
  }

  // ── String parsing ──
  // Also accept numeric strings like "46178" → Excel serial.
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '') return ''

    // Numeric string → try Excel serial conversion
    if (/^\d{4,6}(\.\d+)?$/.test(trimmed)) {
      const num = Number(trimmed)
      if (Number.isFinite(num) && num > 59 && num < 60000) {
        const ms = Math.round((num - 25569) * 86400 * 1000)
        const d = new Date(ms)
        if (!isNaN(d.getTime())) {
          const y = d.getUTCFullYear()
          const m = String(d.getUTCMonth() + 1).padStart(2, '0')
          const day = String(d.getUTCDate()).padStart(2, '0')
          return `${y}-${m}-${day}`
        }
      }
    }

    // Strip any time portion (e.g. " 10:30:00", "T10:30", " 10:30 AM")
    const dateOnly = trimmed
      .replace(/[Tt]\s*\d{1,2}:\d{2}.*$/, '')
      .replace(/\s+\d{1,2}:\d{2}.*$/, '')
      .trim()
    if (dateOnly === '') return todayLocal()

    // YYYY-MM-DD (already canonical — just zero-pad)
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(dateOnly)) {
      const [y, m, d] = dateOnly.split('-')
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }

    // YYYY/MM/DD or YYYY.MM.DD or YYYY MM DD
    const ymdMatch = dateOnly.match(/^(\d{4})[/.\s](\d{1,2})[/.\s](\d{1,2})$/)
    if (ymdMatch) {
      const [, y, m, d] = ymdMatch
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }

    // DD-MM-YYYY / DD/MM/YYYY / DD.MM.YYYY / DD MM YYYY (Indian default — day first)
    // Also matches MM-DD-YYYY (US) — disambiguated by the heuristic below.
    //
    // Heuristic:
    //   • If FIRST number > 12 → first must be day → DD-MM (Indian)
    //   • If SECOND number > 12 → second must be day → MM-DD (US)
    //   • Otherwise (both ≤ 12) → ambiguous → default to DD-MM (Indian)
    const dmyMatch = dateOnly.match(/^(\d{1,2})[/.\s-](\d{1,2})[/.\s-](\d{4})$/)
    if (dmyMatch) {
      const [, a, b, y] = dmyMatch
      let d: string, m: string
      if (Number(a) > 12 && Number(b) <= 12) {
        d = a; m = b   // DD-MM (Indian)
      } else if (Number(b) > 12 && Number(a) <= 12) {
        m = a; d = b   // MM-DD (US)
      } else {
        d = a; m = b   // Default DD-MM (Indian)
      }
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }

    // DD-MM-YY / DD/MM/YY / DD.MM.YY / DD MM YY (short year → 20XX)
    const dmyShortMatch = dateOnly.match(/^(\d{1,2})[/.\s-](\d{1,2})[/.\s-](\d{2})$/)
    if (dmyShortMatch) {
      const [, a, b, y] = dmyShortMatch
      let d: string, m: string
      if (Number(a) > 12 && Number(b) <= 12) {
        d = a; m = b
      } else if (Number(b) > 12 && Number(a) <= 12) {
        m = a; d = b
      } else {
        d = a; m = b
      }
      return `20${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }

    // NO native new Date(string) fallback — it silently interprets DD-MM as MM-DD.
    // Last resort — return today's date so the user can see a row was imported
    // and fix the date manually if needed.
    return todayLocal()
  }

  // Numbers outside the Excel-serial range, booleans, objects, etc. → today
  return todayLocal()
}

/**
 * Returns today's date as YYYY-MM-DD using LOCAL timezone (not UTC).
 * Using toISOString().split('T')[0] causes off-by-one in IST (UTC+5:30)
 * because toISOString() returns UTC, and midnight IST = previous day 18:30 UTC.
 */
export function todayLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
