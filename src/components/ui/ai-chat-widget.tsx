'use client'

import * as React from 'react'
import { VoiceInput } from '@/components/ui/voice-input'
import { Sparkles, X, Loader2, Send, Bot, User, Zap, Trash2, Mic, MicOff } from 'lucide-react'
import { useAiConfig } from '@/hooks/use-ai-config'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  action?: { type: string; summary: string }
}

const QUICK_ACTIONS = [
  { label: 'Dashboard dekho', prompt: 'aaj ka dashboard dikhao' },
  { label: 'Quotation banao', prompt: 'ek quotation banao' },
  { label: 'Customer add karo', prompt: 'naya customer add karo' },
  { label: 'Daily sell record karo', prompt: 'aaj ki sale record karo' },
  { label: 'Production enter karo', prompt: 'aaj ki production enter karo' },
  { label: 'Recent sales', prompt: 'recent daily sales dikhao' },
]

// Check if browser supports speech recognition
function isSpeechSupported(): boolean {
  if (typeof window === 'undefined') return false
  return !!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition
}

export function AiChatWidget() {
  const { isEnabled, loading: configLoading } = useAiConfig()
  const [open, setOpen] = React.useState(false)
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Namaste! Main Veda ERP AI assistant hoon. Mujhse kuch bhi poochein ya bol dein - main kar dunga!',
    },
  ])
  const [input, setInput] = React.useState('')
  const [interim, setInterim] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [conversationId, setConversationId] = React.useState('')
  const [voiceSupported, setVoiceSupported] = React.useState(true)
  const [voiceListening, setVoiceListening] = React.useState(false)
  const messagesEndRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Check speech support on mount
  React.useEffect(() => {
    setVoiceSupported(isSpeechSupported())
  }, [])

  if (configLoading) return null
  if (!isEnabled) return null

  const displayInput = input + (interim ? (input.endsWith(' ') || !input ? '' : ' ') + interim : '')

  const handleSend = async (overrideText?: string) => {
    const text = (overrideText || input).trim()
    if (!text || loading) return
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setInput('')
    setInterim('')
    setLoading(true)
    try {
      const res = await fetch('/api/ai/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, conversationId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${data.error || 'Something went wrong'}` }])
        return
      }
      setConversationId(data.conversationId)
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply, action: data.action || undefined }])
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Network error. Internet connection check karein.' }])
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => {
    setMessages([{ role: 'assistant', content: 'Namaste! Main Veda ERP AI assistant hoon. Mujhse kuch bhi poochein ya bol dein - main kar dunga!' }])
    setConversationId('')
  }

  const handleVoiceResult = (finalText: string) => {
    setInput((prev) => {
      const sep = prev && !prev.endsWith(' ') ? ' ' : ''
      return prev + sep + finalText
    })
    setInterim('')
    setVoiceListening(false)
  }

  const showQuick = messages.length < 2 && !loading

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'fixed bottom-5 right-5 z-50 size-14 rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 flex items-center justify-center transition-all duration-200 hover:bg-emerald-700 hover:scale-105 active:scale-95',
          open && 'rotate-0',
        )}
        title="AI Agent"
        aria-label="AI Agent"
      >
        {open ? <X className="size-6" /> : <Sparkles className="size-6" />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-5 z-50 w-[calc(100vw-2.5rem)] sm:w-[420px] h-[600px] sm:h-[65vh] flex flex-col bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-border overflow-hidden animate-in slide-in-from-bottom-5 fade-in-0 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between bg-gradient-to-r from-emerald-600 to-emerald-500 text-white px-4 py-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-full bg-white/20 flex items-center justify-center">
                <Bot className="size-5" />
              </div>
              <div>
                <p className="font-semibold text-sm tracking-tight">Veda AI Agent</p>
                <p className="text-[10px] opacity-90 flex items-center gap-1">
                  <Zap className="size-2.5" /> Full access - sab modules
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={handleClear} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors" title="Clear chat">
                <Trash2 className="size-3.5" />
              </button>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors" aria-label="Close">
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-muted/30">
            {messages.map((msg, i) => (
              <div key={i} className={cn('flex gap-2', msg.role === 'user' && 'flex-row-reverse')}>
                <div className={cn('size-7 rounded-full flex items-center justify-center shrink-0', msg.role === 'user' ? 'bg-emerald-600 text-white' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200')}>
                  {msg.role === 'user' ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
                </div>
                <div className={cn('flex-1 max-w-[85%] rounded-xl p-3 text-[13px] leading-relaxed', msg.role === 'user' ? 'bg-emerald-600 text-white rounded-2xl rounded-tr-sm' : 'bg-white dark:bg-zinc-800 border border-border shadow-sm')}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {msg.action?.type === 'tool_call' && (
                    <div className="mt-2 pt-2 border-t border-emerald-200 dark:border-emerald-700">
                      <div className="flex items-start gap-1.5">
                        <Zap className="size-3 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-emerald-700 dark:text-emerald-400 whitespace-pre-wrap">{msg.action.summary}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {showQuick && (
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-1">Quick Actions</p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_ACTIONS.map((qa) => (
                    <button key={qa.label} type="button" onClick={() => handleSend(qa.prompt)} className="text-[11px] px-2.5 py-1.5 rounded-full bg-white dark:bg-zinc-800 border border-border hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors text-foreground">
                      {qa.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {loading && (
              <div className="flex gap-2">
                <div className="size-7 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center shrink-0"><Bot className="size-3.5" /></div>
                <div className="bg-white dark:bg-zinc-800 border border-border rounded-xl p-3 flex items-center gap-2 shadow-sm">
                  <Loader2 className="size-3.5 animate-spin text-emerald-600" />
                  <span className="text-xs text-muted-foreground">Agent kaam kar raha hai...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Voice Recording Banner */}
          {voiceListening && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-950/40 border-t border-red-200 dark:border-red-800/40">
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                </span>
                <span className="text-[11px] font-medium text-red-700 dark:text-red-400">
                  {interim ? interim : 'Sun raha hoon...'}
                </span>
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="border-t border-border bg-white dark:bg-zinc-900 p-2 flex items-end gap-1.5 shrink-0">
            <textarea
              value={displayInput}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              placeholder={voiceListening ? 'Boltein raho...' : 'Kuch bhi bolo... (Enter to send)'}
              rows={1}
              disabled={loading}
              className="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm max-h-20 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
            />
            {voiceSupported ? (
              <VoiceInput
                onResult={handleVoiceResult}
                onInterim={setInterim}
                onError={(err) => {
                  setVoiceListening(false)
                  setInterim('')
                  setMessages((prev) => [...prev, { role: 'assistant', content: `Mic error: ${err}` }])
                }}
                onListeningChange={setVoiceListening}
                disabled={loading}
                language="hi-IN"
                className="shrink-0"
              />
            ) : (
              <button
                type="button"
                disabled
                className="shrink-0 inline-flex items-center justify-center rounded-md p-2 text-muted-foreground/40 cursor-not-allowed"
                title="Voice not supported in this browser. Use Chrome or Edge."
              >
                <MicOff className="size-4" />
              </button>
            )}
            <Button size="icon" onClick={() => handleSend()} disabled={loading || !input.trim()} className="shrink-0 bg-emerald-600 hover:bg-emerald-700 rounded-lg">
              <Send className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  )
}

// Backward-compatible exports
const PENDING_AI_RESULTS: Record<string, Record<string, unknown>> = {}
export function setPendingAiResult(module: string, fields: Record<string, unknown>) { PENDING_AI_RESULTS[module] = fields }
export function consumePendingAiResult(module: string): Record<string, unknown> | null { const v = PENDING_AI_RESULTS[module]; if (v) { delete PENDING_AI_RESULTS[module]; return v } return null }
export default AiChatWidget
