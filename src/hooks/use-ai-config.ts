'use client'

import * as React from 'react'
import { api } from '@/lib/api'

// ─── useAiConfig ────────────────────────────────────────────────────────────
//
// Shared hook that fetches the AI config once on mount and exposes a
// `isEnabled` boolean the UI can use to conditionally show/hide AI buttons.
//
// Multiple components can call this hook — the fetch is deduped by React
// Query-style caching in a module-level promise.

interface AiConfigState {
  enabled: boolean
  model: string
  hasKey: boolean
  keyMasked: string
}

// Module-level cache so multiple components share one fetch
let cachedConfig: AiConfigState | null = null
let inflight: Promise<AiConfigState | null> | null = null

async function fetchAiConfig(): Promise<AiConfigState | null> {
  if (cachedConfig) return cachedConfig
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const res = await api.getAiConfig()
      cachedConfig = {
        enabled: res.enabled,
        model: res.model,
        hasKey: res.hasKey,
        keyMasked: res.keyMasked,
      }
      return cachedConfig
    } catch (err) {
      console.error('[useAiConfig] Failed to fetch AI config:', err)
      return null
    } finally {
      inflight = null
    }
  })()
  return inflight
}

export function useAiConfig() {
  const [config, setConfig] = React.useState<AiConfigState | null>(cachedConfig)
  const [loading, setLoading] = React.useState(!cachedConfig)

  React.useEffect(() => {
    if (cachedConfig) {
      setConfig(cachedConfig)
      setLoading(false)
      return
    }
    let cancelled = false
    fetchAiConfig().then((c) => {
      if (cancelled) return
      setConfig(c)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const refresh = React.useCallback(async () => {
    cachedConfig = null
    setLoading(true)
    const c = await fetchAiConfig()
    setConfig(c)
    setLoading(false)
  }, [])

  return {
    config,
    loading,
    isEnabled: !!config?.enabled && !!config?.hasKey,
    refresh,
  }
}
