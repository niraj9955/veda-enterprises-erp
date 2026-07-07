'use client'

import * as React from 'react'
import { api } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { useAppStore, type ModuleKey } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { VoiceInput } from '@/components/ui/voice-input'
import { Sparkles, X, Loader2, Mic, Send, Bot, User, Check } from 'lucide-react'
import { useAiConfig } from '@/hooks/use-ai-config'
import { AI_MODULE_SCHEMAS } from '@/lib/ai-schemas'
import { cn } from '@/lib/utils'

// ─── AiChatWidget ───────────────────────────────────────────────────────────
//
// Floating chat button (bottom-right) that opens a WhatsApp-style chat panel.
// The user can type or speak natural language and AI will:
//   1. Detect which module the input is about (or use the active module)
//   2. Parse the input into structured fields
//   3. Show a preview card with the extracted fields
//   4. On confirm, navigate the user to the right module + open its add form
//      with the fields pre-filled
//
// Implementation note: instead of triggering module-specific form opens from
// this widget (which would require tight coupling to every module's state),
// we use a simpler approach — the widget stores the last parsed result in
// a module-level variable that each module's "Add" button checks on mount.
// If a pending AI result exists for that module, it auto-applies the fields.
//
// This keeps the widget decoupled and lets each module own its form state.

// Module-level pending AI results — when a user clicks "Open Form" in the
// chat widget, the parsed fields land here. The target module's add-dialog
// opener reads & clears this on next render.
const PENDING_AI_RESULTS: Record<string, Record<string, unknown>> = {}

export function setPendingAiResult(module: string, fields: Record<string, unknown>) {
  PENDING_AI_RESULTS[module] = fields
}

export function consumePendingAiResult(module: string): Record<string, unknown> | null {
  const v = PENDING_AI_RESULTS[module]
  if (v) {
    delete PENDING_AI_RESULTS[module]
    return v
  }
  return null
}

// Map of ModuleKey → AI module schema key. Most are 1:1 but some differ
// (e.g., customerPayment module is 'customerPayment' in both).
const MODULE_KEY_TO_AI_KEY: Partial<Record<ModuleKey, string>> = {
  dailySell: 'dailySell',
  production: 'production',
  customerPayment: 'customerPayment',
  customers: 'customer',
  labourPayment: 'labourPayment',
  tractorPayment: 'tractorPayment',
  dustPurchase: 'dustPurchase',
  cementPurchase: 'cementPurchase',
  hardner: 'hardner',
  electricity: 'electricity',
  factoryStuff: 'factoryStuff',
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  // Optional: parsed fields to show as a preview card
  parsedFields?: Record<string, unknown>
  parsedModule?: string
}

export function AiChatWidget() {
  const { isEnabled, loading: configLoading } = useAiConfig()
  const [open, setOpen] = React.useState(false)
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Namaste! Main AI assistant hoon. Boliye kya entry karni hai?',
    },
  ])
  const [input, setInput] = React.useState('')
  const [interim, setInterim] = React.useState('')
  const [parsing, setParsing] = React.useState(false)
  const [activeModule, setActiveModule] = React.useState<ModuleKey>(useAppStore.getState().activeModule)

  // Subscribe to module changes so the chat knows the user's current context
  const currentModule = useAppStore((s) => s.activeModule)
  const setStoreModule = useAppStore((s) => s.setActiveModule)
  React.useEffect(() => {
    setActiveModule(currentModule)
  }, [currentModule])

  const messagesEndRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, parsing])

  // Don't render anything while config is loading or if AI is disabled
  if (configLoading) return null
  if (!isEnabled) return null

  const aiModuleKey = MODULE_KEY_TO_AI_KEY[activeModule]

  const handleSend = async () => {
    const text = input.trim()
    if (!text || parsing) return

    // Add user message to chat
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setInput('')
    setInterim('')

    // If no AI module mapped for the active tab, ask AI to detect module from text
    const targetModule = aiModuleKey || detectModuleFromText(text)
    if (!targetModule) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            'Mujhe samajh nahi aaya ki kis module ke liye entry karni hai. Pehle koi module select karein (Daily Sell, Production, Customer Payment, etc.) ya input me specify karein.',
        },
      ])
      return
    }

    setParsing(true)
    try {
      const res = await api.aiParse(targetModule, text)
      if (Object.keys(res.fields).length === 0) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content:
              'Mujhe kuch extract nahi hua. Thoda aur specific ho sake toh try karein — date, naam, amount, product ka naam etc. mention karein.',
          },
        ])
      } else {
        const schema = AI_MODULE_SCHEMAS.find((s) => s.key === targetModule)
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `Maine ${schema?.label || targetModule} ke liye ${Object.keys(res.fields).length} field extract kiye. Niche preview dekhein — "Open Form" dabane par form me auto-fill ho jayega.`,
            parsedFields: res.fields,
            parsedModule: targetModule,
          },
        ])
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to parse'
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${message}` },
      ])
    } finally {
      setParsing(false)
    }
  }

  const handleOpenForm = (moduleKey: string) => {
    // Store the parsed fields as pending for the target module
    const msg = messages.find((m) => m.parsedModule === moduleKey && m.parsedFields)
    if (msg?.parsedFields) {
      setPendingAiResult(moduleKey, msg.parsedFields)
    }
    // Navigate to the module — the module's add button will auto-consume
    // the pending result on next render
    const storeKey = (Object.entries(MODULE_KEY_TO_AI_KEY).find(
      ([, v]) => v === moduleKey
    )?.[0] || moduleKey) as ModuleKey
    setStoreModule(storeKey)
    setOpen(false)
    toast({
      title: 'Form ready',
      description: `Open the Add form in ${moduleKey} — fields will be auto-filled.`,
    })
  }

  // Voice handlers
  const handleVoiceResult = (finalText: string) => {
    setInput((prev) => {
      const sep = prev && !prev.endsWith(' ') ? ' ' : ''
      return prev + sep + finalText
    })
    setInterim('')
  }

  const displayInput = input + (interim ? (input.endsWith(' ') || !input ? '' : ' ') + interim : '')

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'fixed bottom-5 right-5 z-50 size-14 rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 flex items-center justify-center transition-all hover:bg-emerald-700 hover:scale-105',
          open && 'rotate-90'
        )}
        title="AI Assistant"
        aria-label="AI Assistant"
      >
        {open ? <X className="size-6" /> : <Sparkles className="size-6" />}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-5 z-50 w-[calc(100vw-2.5rem)] sm:w-96 max-h-[70vh] flex flex-col bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-border overflow-hidden animate-in slide-in-from-bottom-5">
          {/* Header */}
          <div className="flex items-center justify-between bg-emerald-600 text-white px-4 py-3">
            <div className="flex items-center gap-2">
              <Bot className="size-5" />
              <div>
                <p className="font-semibold text-sm">AI Assistant</p>
                <p className="text-[10px] opacity-90">
                  Active: {activeModule}
                </p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-white/80 hover:text-white"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-muted/30">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  'flex gap-2',
                  msg.role === 'user' && 'flex-row-reverse'
                )}
              >
                <div
                  className={cn(
                    'size-7 rounded-full flex items-center justify-center shrink-0',
                    msg.role === 'user'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200'
                  )}
                >
                  {msg.role === 'user' ? <User className="size-4" /> : <Bot className="size-4" />}
                </div>
                <div
                  className={cn(
                    'flex-1 max-w-[80%] rounded-lg p-2.5 text-sm',
                    msg.role === 'user'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white dark:bg-zinc-800 border border-border'
                  )}
                >
                  <p>{msg.content}</p>
                  {/* Preview card for parsed fields */}
                  {msg.parsedFields && msg.parsedModule && (
                    <div className="mt-2 pt-2 border-t border-white/20 space-y-1">
                      {Object.entries(msg.parsedFields).slice(0, 6).map(([k, v]) => (
                        <div key={k} className="flex justify-between text-xs gap-2">
                          <span className="opacity-80">{k}:</span>
                          <span className="font-medium text-right">{String(v)}</span>
                        </div>
                      ))}
                      {Object.keys(msg.parsedFields).length > 6 && (
                        <p className="text-[10px] opacity-70 italic">
                          + {Object.keys(msg.parsedFields).length - 6} more
                        </p>
                      )}
                      <Button
                        size="sm"
                        className="mt-2 w-full bg-white text-emerald-700 hover:bg-emerald-50 text-xs h-7"
                        onClick={() => handleOpenForm(msg.parsedModule!)}
                      >
                        <Check className="size-3 mr-1" />
                        Open Form & Fill
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {parsing && (
              <div className="flex gap-2">
                <div className="size-7 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center shrink-0">
                  <Bot className="size-4" />
                </div>
                <div className="bg-white dark:bg-zinc-800 border border-border rounded-lg p-3 flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin text-emerald-600" />
                  <span className="text-sm text-muted-foreground">AI soch raha hai...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border bg-white dark:bg-zinc-900 p-2 flex items-end gap-1.5">
            <textarea
              value={displayInput}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder="Type or speak... (Enter to send)"
              rows={1}
              disabled={parsing}
              className="flex-1 resize-none rounded-md border border-input bg-background px-2.5 py-2 text-sm max-h-24 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
            <VoiceInput
              onResult={handleVoiceResult}
              onInterim={setInterim}
              disabled={parsing}
              className="shrink-0"
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={parsing || !input.trim()}
              className="shrink-0 bg-emerald-600 hover:bg-emerald-700"
            >
              <Send className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  )
}

// Try to detect which module the user is talking about based on keywords
function detectModuleFromText(text: string): string | null {
  const lower = text.toLowerCase()
  const checks: { keywords: string[]; module: string }[] = [
    { keywords: ['sell', 'bike', 'becha', 'sale', 'customer ne liya', 'khareeda'], module: 'dailySell' },
    { keywords: ['production', 'banaye', 'banaya', 'manufacture', 'produce', 'output'], module: 'production' },
    { keywords: ['payment', 'jama', 'paisa diya', 'paid', 'deposit', 'customer payment'], module: 'customerPayment' },
    { keywords: ['labour', 'mazdoor', 'worker', 'worker payment', 'vetan'], module: 'labourPayment' },
    { keywords: ['tractor', 'dumper', 'bhada'], module: 'tractorPayment' },
    { keywords: ['dust purchase', 'dust', 'mitti'], module: 'dustPurchase' },
    { keywords: ['cement purchase', 'cement kharida', 'cement bought'], module: 'cementPurchase' },
    { keywords: ['hardner'], module: 'hardner' },
    { keywords: ['electricity', 'bijli', 'current'], module: 'electricity' },
    { keywords: ['factory stuff', 'samagri'], module: 'factoryStuff' },
    { keywords: ['new customer', 'naya customer', 'add customer', 'customer add'], module: 'customer' },
  ]
  for (const c of checks) {
    if (c.keywords.some((k) => lower.includes(k))) return c.module
  }
  return null
}

export default AiChatWidget
