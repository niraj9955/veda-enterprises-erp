'use client'

import * as React from 'react'
import { Mic, Square, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

import { activeVoiceControllerLike } from '@/components/ui/voice-active-controller'
import { useVoiceRecorder } from '@/hooks/use-voice-recorder'
import { APP_VERSION } from '@/lib/version'

interface VoiceInputProps {
  onResult: (text: string) => void
  /** Kept for API compatibility — live interim text is not possible with
   *  server-side ASR; called with '' when transcription completes. */
  onInterim?: (text: string) => void
  onError?: (error: string) => void
  onListeningChange?: (listening: boolean) => void
  disabled?: boolean
  /** Language preference (hi-IN / en-IN). Server ASR auto-detects — kept for UI hints. */
  language?: 'hi-IN' | 'en-IN'
  className?: string
}

let _voiceInputIdCounter = 0
function nextVoiceInputId(): string {
  _voiceInputIdCounter += 1
  return `voice-${_voiceInputIdCounter}`
}

/** Live 5-bar mic level indicator — heights driven by real mic loudness. */
function LevelBars({ level }: { level: number }) {
  const factors = [1, 0.72, 0.5, 0.72, 1]
  return (
    <span className="flex items-end gap-[2px] h-4 shrink-0" aria-hidden>
      {factors.map((f, i) => (
        <span
          key={i}
          className="w-[3px] rounded-sm bg-emerald-400 transition-[height] duration-100"
          style={{ height: `${Math.max(3, Math.min(16, level * f * 0.16))}px` }}
        />
      ))}
    </span>
  )
}

export function VoiceInput({
  onResult,
  onInterim,
  onError,
  onListeningChange,
  disabled,
  language = 'en-IN',
  className,
}: VoiceInputProps) {
  const instanceIdRef = React.useRef<string>(nextVoiceInputId())
  const onInterimRef = React.useRef(onInterim)
  const onListeningChangeRef = React.useRef(onListeningChange)

  React.useEffect(() => {
    onInterimRef.current = onInterim
    onListeningChangeRef.current = onListeningChange
  }, [onInterim, onListeningChange])

  const handleResult = React.useCallback(
    (text: string) => {
      try { onInterimRef.current?.('') } catch { /* ignore */ }
      onResult(text)
    },
    [onResult]
  )

  const handleError = React.useCallback(
    (message: string) => {
      onError?.(message)
    },
    [onError]
  )

  const { status, isRecording, isBusy, level, start, stop } = useVoiceRecorder({
    onResult: handleResult,
    onError: handleError,
  })

  // Keep latest stop available for the controller callback (avoids stale closure)
  const stopRef = React.useRef(stop)
  React.useEffect(() => {
    stopRef.current = stop
  }, [stop])

  // Notify parent about listening state changes
  React.useEffect(() => {
    onListeningChangeRef.current?.(isRecording)
  }, [isRecording])

  // While recording we own the global voice slot; when another mic takes over
  // the controller calls our stop(), and on stop we release the slot.
  React.useEffect(() => {
    if (isRecording) {
      activeVoiceControllerLike.takeOver(instanceIdRef.current, () => stopRef.current())
    } else {
      activeVoiceControllerLike.release(instanceIdRef.current)
    }
    return () => {
      if (isRecording) activeVoiceControllerLike.release(instanceIdRef.current)
    }
  }, [isRecording])

  // Final cleanup on unmount
  React.useEffect(() => {
    const id = instanceIdRef.current
    return () => activeVoiceControllerLike.release(id)
  }, [])

  const toggle = () => {
    if (disabled || isBusy) return
    if (isRecording) stop()
    else void start()
  }

  const listening = isRecording
  // Mic pulse scale follows live loudness (subtle 1.0–1.15x)
  const pulse = listening ? 1 + Math.min(0.15, level * 0.0015) : 1

  return (
    <div className="relative shrink-0">
      {/* Live "mic is hearing you" pill — real level bars prove sound is reaching us */}
      {listening && (
        <div className="absolute bottom-full right-0 mb-2 z-40 flex items-center gap-2 whitespace-nowrap rounded-full bg-zinc-900/95 dark:bg-zinc-100/95 text-white dark:text-zinc-900 pl-2.5 pr-3 py-1.5 shadow-xl backdrop-blur-sm">
          <LevelBars level={level} />
          <span className="text-[11px] leading-none font-medium">
            {level >= 6
              ? 'Sun raha hoon... chup hone par apne aap bhej dunga'
              : 'Sun raha hoon... bolo (thoda chup hone par bhi bhej dunga)'}
          </span>
        </div>
      )}
      {/* Version chip removed from here — shown in login card + chat header only */}
      <Button
        type="button"
        variant={listening ? 'destructive' : 'outline'}
        size="icon"
        onClick={toggle}
        disabled={disabled || isBusy}
        title={
          status === 'processing'
            ? 'Samajh rahe hain...'
            : listening
              ? 'Stop karo (ya chup ho jao — apne aap ho jayega)'
              : `Bolo (${language === 'hi-IN' ? 'Hindi' : 'English'})`
        }
        className={className}
        style={listening ? { transform: `scale(${pulse.toFixed(3)})` } : undefined}
      >
        {status === 'requesting' || status === 'processing' ? (
          <Loader2 className="size-4 animate-spin" />
        ) : listening ? (
          <Square className="size-4" />
        ) : (
          <Mic className="size-4" />
        )}
      </Button>
    </div>
  )
}

export default VoiceInput
