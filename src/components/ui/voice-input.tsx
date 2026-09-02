'use client'

import * as React from 'react'
import { Mic, Square, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

import { activeVoiceControllerLike } from '@/components/ui/voice-active-controller'
import { useVoiceRecorder } from '@/hooks/use-voice-recorder'

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

  const { status, isRecording, isBusy, start, stop } = useVoiceRecorder({
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

  return (
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
            ? 'Stop karo'
            : `Bolo (${language === 'hi-IN' ? 'Hindi' : 'English'})`
      }
      className={className}
    >
      {status === 'requesting' || status === 'processing' ? (
        <Loader2 className="size-4 animate-spin" />
      ) : listening ? (
        <Square className="size-4 animate-pulse" />
      ) : (
        <Mic className="size-4" />
      )}
    </Button>
  )
}

export default VoiceInput
