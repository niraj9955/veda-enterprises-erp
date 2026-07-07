'use client'

import * as React from 'react'
import { api } from '@/lib/api'

// ─── useAiConfig ────────────────────────────────────────────────────────────
//
// Shared hook that fetches the AI config once and exposes a `isEnabled`
// boolean the UI can use to conditionally show/hide AI buttons.
//
// Uses a tiny pub-sub so when one component (e.g. the Admin Panel config
// form) refreshes the cache, ALL mounted components instantly re-render
// with the new value — no page reload needed.

interface AiConfigState {
  enabled: boolean
  model: string
  hasKey: boolean
  keyMasked: string
}

// Module-level cache + subscriber set (pub-sub)
let cachedConfig: AiConfigState | null = null
let inflight: Promise<AiConfigState | null> | null = null
const subscribers = new Set<(c: AiConfigState | null) => void>()

function notify(c: AiConfigState | null) {
  subscribers.forEach((fn) => fn(c))
}

async function fetchAiConfig(force = false): Promise<AiConfigState | null> {
  if (!force && cachedConfig) return cachedConfig
  if (!force && inflight) return inflight
  inflight = (async () => {
    try {
      const res = await api.getAiConfig()
      cachedConfig = {
        enabled: res.enabled,
        model: res.model,
        hasKey: res.hasKey,
        keyMasked: res.keyMasked,
      }
      notify(cachedConfig)
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
    // Subscribe to cache updates so we re-render when another component
    // refreshes the cache (e.g. admin saves new API key in Admin Panel).
    const unsub = (c: AiConfigState | null) => {
      setConfig(c)
      setLoading(false)
    }
    subscribers.add(unsub)

    if (cachedConfig) {
      setConfig(cachedConfig)
      setLoading(false)
    } else {
      fetchAiConfig().then((c) => {
        setConfig(c)
        setLoading(false)
      })
    }

    return () => {
      subscribers.delete(unsub)
    }
  }, [])

  const refresh = React.useCallback(async () => {
    setLoading(true)
    await fetchAiConfig(true)
    // fetchAiConfig(true) already calls notify() which updates our state
    setLoading(false)
  }, [])

  return {
    config,
    loading,
    isEnabled: !!config?.enabled && !!config?.hasKey,
    refresh,
  }
}
