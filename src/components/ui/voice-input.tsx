'use client'

import * as React from 'react'
import { Mic, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'

import { activeVoiceControllerLike } from '@/components/ui/voice-active-controller'

interface VoiceInputProps {
  onResult: (text: string) => void
  onInterim?: (text: string) => void
  onError?: (error: string) => void
  onListeningChange?: (listening: boolean) => void
  disabled?: boolean
  language?: 'hi-IN' | 'en-IN'
  className?: string
}

interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: any) => void) | null
  onerror: ((event: any) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
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
  const [listening, setListening] = React.useState(false)
  const [supported, setSupported] = React.useState(true)

  const instanceIdRef = React.useRef<string>(nextVoiceInputId())
  const onResultRef = React.useRef(onResult)
  const onInterimRef = React.useRef(onInterim)
  const onErrorRef = React.useRef(onError)
  const onListeningChangeRef = React.useRef(onListeningChange)
  const userWantsToListenRef = React.useRef(false)
  const recognitionRef = React.useRef<SpeechRecognitionLike | null>(null)
  const restartTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const notifyListening = React.useCallback((val: boolean) => {
    setListening(val)
    onListeningChangeRef.current?.(val)
  }, [])

  React.useEffect(() => {
    onResultRef.current = onResult
    onInterimRef.current = onInterim
    onErrorRef.current = onError
    onListeningChangeRef.current = onListeningChange
  }, [onResult, onInterim, onError, onListeningChange])

  React.useEffect(() => {
    const SpeechRecognition =
      (typeof window !== 'undefined' &&
        ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) ||
      null
    if (!SpeechRecognition) {
      setSupported(false)
      return
    }

    const recognition = new SpeechRecognition() as SpeechRecognitionLike
    recognition.lang = language
    recognition.continuous = false
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      notifyListening(true)
    }

    recognition.onresult = (event: any) => {
      let interimText = ''
      let finalText = ''
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        const transcript = result[0].transcript
        if (result.isFinal) {
          finalText += (finalText ? ' ' : '') + transcript
        } else {
          interimText += transcript
        }
      }
      if (interimText && onInterimRef.current) onInterimRef.current(interimText)
      if (finalText) {
        if (onResultRef.current) onResultRef.current(finalText.trim())
        if (onInterimRef.current) onInterimRef.current('')
      }
    }

    recognition.onerror = (event: any) => {
      console.warn('[VoiceInput] error:', event.error)
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        userWantsToListenRef.current = false
        notifyListening(false)
        onErrorRef.current?.(event.error === 'not-allowed' ? 'Microphone permission denied. Browser settings se allow karo.' : 'Speech service not available. Chrome ya Edge use karo.')
      } else if (event.error === 'audio-capture') {
        userWantsToListenRef.current = false
        notifyListening(false)
        onErrorRef.current?.('Microphone nahi mila. Koi mic connected hai?')
      } else if (event.error === 'network') {
        onErrorRef.current?.('Network error. Internet connection check karo.')
      }
      // 'no-speech' and 'aborted' are non-fatal — onend handles them
    }

    recognition.onend = () => {
      if (userWantsToListenRef.current) {
        if (restartTimerRef.current) clearTimeout(restartTimerRef.current)
        restartTimerRef.current = setTimeout(() => {
          if (userWantsToListenRef.current && recognitionRef.current) {
            try {
              recognitionRef.current.start()
            } catch {
              restartTimerRef.current = setTimeout(() => {
                if (userWantsToListenRef.current && recognitionRef.current) {
                  try {
                    recognitionRef.current.start()
                  } catch {
                    userWantsToListenRef.current = false
                    notifyListening(false)
                  }
                }
              }, 300)
            }
          }
        }, 150)
      } else {
        notifyListening(false)
      }
    }

    recognitionRef.current = recognition

    return () => {
      userWantsToListenRef.current = false
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current)
        restartTimerRef.current = null
      }
      try {
        recognition.abort()
      } catch {
        // ignore
      }
      recognitionRef.current = null
      activeVoiceControllerLike.release(instanceIdRef.current)
    }
  }, [language, notifyListening])

  const toggle = () => {
    if (!recognitionRef.current) return
    if (listening) {
      userWantsToListenRef.current = false
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current)
        restartTimerRef.current = null
      }
      try {
        recognitionRef.current.stop()
      } catch {
        // ignore
      }
      notifyListening(false)
      activeVoiceControllerLike.release(instanceIdRef.current)
    } else {
      activeVoiceControllerLike.takeOver(instanceIdRef.current, () => {
        userWantsToListenRef.current = false
        if (restartTimerRef.current) {
          clearTimeout(restartTimerRef.current)
          restartTimerRef.current = null
        }
        try {
          recognitionRef.current?.stop()
        } catch {
          // ignore
        }
        notifyListening(false)
      })

      userWantsToListenRef.current = true
      try {
        recognitionRef.current.start()
        // onstart will call notifyListening(true)
      } catch {
        restartTimerRef.current = setTimeout(() => {
          if (userWantsToListenRef.current && recognitionRef.current) {
            try {
              recognitionRef.current.start()
            } catch {
              userWantsToListenRef.current = false
              notifyListening(false)
              activeVoiceControllerLike.release(instanceIdRef.current)
              onErrorRef.current?.('Microphone start nahi ho paya. Dobara try karo.')
            }
          }
        }, 250)
      }
    }
  }

  if (!supported) return null

  return (
    <Button
      type="button"
      variant={listening ? 'destructive' : 'outline'}
      size="icon"
      onClick={toggle}
      disabled={disabled}
      title={listening ? 'Stop listening' : `Bolo (${language === 'hi-IN' ? 'Hindi' : 'English'})`}
      className={className}
    >
      {listening ? (
        <Square className="size-4 animate-pulse" />
      ) : (
        <Mic className="size-4" />
      )}
    </Button>
  )
}

export default VoiceInput
