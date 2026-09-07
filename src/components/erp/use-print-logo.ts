'use client'

import { useEffect, useState } from 'react'

/**
 * usePrintLogo — company logo for printable documents (Bill / Quotation).
 *
 * WHY THIS EXISTS: if window.print() fires before the logo <img> bitmap has
 * been loaded AND decoded, the browser generates the print output without the
 * logo — the on-screen preview still shows it (it paints later), but the
 * saved PDF is missing the logo. A completed network fetch is NOT enough;
 * the image must be decoded too. So this hook:
 *   1. fetches /api/company → logoUrl
 *   2. preloads the image via `new Image()`
 *   3. waits for full bitmap decode via img.decode()
 *   4. renders two frames (React commit + layout) before auto-printing
 * A 2s hard cap ensures a slow/huge logo can never block printing forever.
 *
 * Returns [logoUrl, printNow] — printNow opens the print dialog (logo is
 * guaranteed on-screen by then for the manual Print button too).
 */
export function usePrintLogo(): [string, () => void] {
  const [logoUrl, setLogoUrl] = useState('')

  useEffect(() => {
    let cancelled = false

    const minDelay = new Promise<void>((res) => setTimeout(res, 300))

    // Fetch + preload + decode the logo; resolves early (idempotent res) if
    // there is no logo, the fetch fails, or the 2s cap elapses.
    const logoSettled = new Promise<void>((res) => {
      // 2s hard cap — never block the print dialog on a slow logo
      setTimeout(res, 2000)
      fetch('/api/company')
        .then((r) => r.json())
        .then(async (d: { company?: { logoUrl?: string } }) => {
          const url = d?.company?.logoUrl
          if (cancelled || !url) return res()
          // Preload + full decode — the step that fixes logos vanishing
          // from saved PDFs.
          await new Promise<void>((res2) => {
            const probe = new Image()
            probe.onload = () => {
              if (typeof probe.decode === 'function') {
                probe.decode().then(() => res2()).catch(() => res2())
              } else {
                res2()
              }
            }
            probe.onerror = () => res2() // broken logo — don't block printing
            probe.src = url
          })
          if (cancelled) return res()
          setLogoUrl(url)
          // Two frames so React commits the <img> and layout settles before
          // the print snapshot is generated.
          await new Promise<void>((res2) =>
            requestAnimationFrame(() => requestAnimationFrame(() => res2())),
          )
          res()
        })
        .catch(() => res())
    })

    Promise.all([minDelay, logoSettled]).then(() => {
      if (!cancelled) window.print()
    })

    return () => {
      cancelled = true
    }
  }, [])

  // Manual Print button — the logo is already on screen and decoded by then.
  const printNow = () => window.print()

  return [logoUrl, printNow]
}
