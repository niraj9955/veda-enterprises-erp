'use client'

import * as React from 'react'
import { api } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { useAppStore, type ModuleKey } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { VoiceInput } from '@/components/ui/voice-input'
import { Sparkles, X, Loader2, Mic, Send, Bot, User, Check, Lightbulb, ChevronRight } from 'lucide-react'
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

// List of (label, aiKey, storeKey, examplePrompt) tuples — used to render the
// quick-pick module chips when the user is on a tab without AI mapping
// (e.g. Dashboard) or when the AI can't detect the module from text.
const MODULE_CHIPS: { label: string; aiKey: string; storeKey: ModuleKey; example: string }[] = [
  { label: 'Daily Sell', aiKey: 'dailySell', storeKey: 'dailySell', example: 'aaj Ramesh ne 500 Zig Zag Grey 80mm liya, rate 35, total 17500, 10000 received' },
  { label: 'Production', aiKey: 'production', storeKey: 'production', example: 'aaj 1000 Zig Zag Grey 80mm banaye, 500 Red 60mm' },
  { label: 'Customer Payment', aiKey: 'customerPayment', storeKey: 'customerPayment', example: 'Suresh ne 5000 rupee payment diya, UPI se' },
  { label: 'Labour Payment', aiKey: 'labourPayment', storeKey: 'labourPayment', example: '2 labour the, 800 rupee diye, maze ka kaam' },
  { label: 'Tractor Payment', aiKey: 'tractorPayment', storeKey: 'tractorPayment', example: 'tractor bhada 1500 rupee diya, maal laane ka' },
  { label: 'Dust Purchase', aiKey: 'dustPurchase', storeKey: 'dustPurchase', example: '10 ton dust khareeda, 5000 rupee' },
  { label: 'Cement Purchase', aiKey: 'cementPurchase', storeKey: 'cementPurchase', example: '50 bag cement liya, 380 per bag' },
  { label: 'Hardner', aiKey: 'hardner', storeKey: 'hardner', example: 'hardner 20 litre liya, 2000 rupee' },
  { label: 'Electricity', aiKey: 'electricity', storeKey: 'electricity', example: 'bijli ka bill 3500 rupee aaya' },
  { label: 'Factory Stuff', aiKey: 'factoryStuff', storeKey: 'factoryStuff', example: 'factory samagri 1500 rupee khareedi' },
  { label: 'Customer', aiKey: 'customer', storeKey: 'customers', example: 'naya customer Suresh, mobile 9876543210, address Muzaffarpur' },
]

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
      content: 'Namaste! Main AI assistant hoon. Niche koi module chuno ya seedha type karein — main form fields auto-fill kar dunga.',
    },
  ])
  const [input, setInput] = React.useState('')
  const [interim, setInterim] = React.useState('')
  const [parsing, setParsing] = React.useState(false)
  const [activeModule, setActiveModule] = React.useState<ModuleKey>(useAppStore.getState().activeModule)
  // Picked module overrides the active-module-derived one when the user
  // taps a chip — e.g. while sitting on Dashboard the user can still pick
  // "Daily Sell" to send the prompt to the right parser.
  const [pickedModule, setPickedModule] = React.useState<string | null>(null)
  // Show the quick-pick chip row + example prompts when the user hasn't
  // picked anything yet AND we're not currently parsing.
  const [showHelp, setShowHelp] = React.useState(true)

  // Subscribe to module changes so the chat knows the user's current context
  const currentModule = useAppStore((s) => s.activeModule)
  const setStoreModule = useAppStore((s) => s.setActiveModule)
  React.useEffect(() => {
    setActiveModule(currentModule)
    // When the user switches module tab, reset the picked override so the
    // chat falls back to the new active module's mapping.
    setPickedModule(null)
  }, [currentModule])

  const messagesEndRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, parsing])

  // Don't render anything while config is loading or if AI is disabled
  if (configLoading) return null
  if (!isEnabled) return null

  // Effective AI module key = picked chip override → active module mapping → null
  const aiModuleKey = pickedModule || MODULE_KEY_TO_AI_KEY[activeModule] || null
  // For the chip row highlight + example prompt
  const activeChip = MODULE_CHIPS.find((c) => c.aiKey === aiModuleKey) || null

  const handleSend = async () => {
    const text = input.trim()
    if (!text || parsing) return

    // Add user message to chat
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setInput('')
    setInterim('')
    setShowHelp(false)

    // Determine target module — picked chip → active module → AI-detected → null
    const targetModule = aiModuleKey || detectModuleFromText(text)
    if (!targetModule) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            'Mujhe samajh nahi aaya ki kis module ke liye entry karni hai. Niche koi module chip select karein (Daily Sell, Production, Customer Payment, etc.) ya input me specify karein — jaise "aaj 500 bricks banaye" ya "customer Suresh ne 5000 rupee diya".',
        },
      ])
      setShowHelp(true)
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
              'Mujhe kuch extract nahi hua. Thoda aur specific ho sake toh try karein — date, naam, amount, product ka naam etc. mention karein. Example: "aaj Ramesh ne 500 bricks liye, rate 35, total 17500".',
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
      // Surface the actual server error message — previously we only showed
      // a generic message which made debugging impossible.
      let errMsg = err instanceof Error ? err.message : 'Failed to parse'
      // Add a friendlier hint for the most common failure modes
      let hint = ''
      if (/401|Incorrect API key|invalid api key/i.test(errMsg)) {
        hint = '\n\nYeh API key ka issue lagta hai. Admin Panel → AI Assistant me jakar key check karein ya "Test Connection" button dabayein.'
      } else if (/404|model.*does not exist|model not found/i.test(errMsg)) {
        hint = '\n\nYeh model shayad unavailable hai. Admin Panel me jakar koi aur model select karein (jaise gpt-4o-mini ya llama-3.3-70b-versatile).'
      } else if (/429|rate limit|quota/i.test(errMsg)) {
        hint = '\n\nRate limit exceed ho gaya. Thodi der baad try karein ya provider dashboard check karein.'
      } else if (/ENOTFOUND|ECONNREFUSED|fetch failed|network/i.test(errMsg)) {
        hint = '\n\nNetwork issue lagta hai. Internet connection check karein.'
      } else if (/disabled|not enabled/i.test(errMsg)) {
        hint = '\n\nAI abhi disabled hai. Admin Panel me jakar enable karein.'
      }
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${errMsg}${hint}` },
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
                  {activeChip ? `Target: ${activeChip.label}` : `Active: ${activeModule}${aiModuleKey ? '' : ' — pick a module'}`}
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

          {/* Module chip row — always visible so user can switch target */}
          <div className="bg-white dark:bg-zinc-900 border-b border-border px-2 py-2 flex flex-wrap gap-1 max-h-24 overflow-y-auto">
            {MODULE_CHIPS.map((chip) => (
              <button
                key={chip.aiKey}
                type="button"
                onClick={() => {
                  setPickedModule(chip.aiKey)
                  setShowHelp(true)
                }}
                className={cn(
                  'text-[11px] px-2 py-1 rounded-full border transition-colors',
                  aiModuleKey === chip.aiKey
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-transparent text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Example prompt strip (shown when help is visible) */}
          {showHelp && activeChip && (
            <div className="bg-emerald-50/50 dark:bg-emerald-900/10 border-b border-emerald-100 dark:border-emerald-800 px-3 py-2">
              <div className="flex items-start gap-1.5">
                <Lightbulb className="size-3.5 text-amber-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Example for {activeChip.label}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setInput(activeChip.example)
                      // Focus the textarea by defer
                      setTimeout(() => {
                        const ta = document.querySelector<HTMLTextAreaElement>('textarea[placeholder*="Type or speak"]')
                        ta?.focus()
                      }, 0)
                    }}
                    className="text-xs text-left text-emerald-700 dark:text-emerald-300 hover:underline break-words"
                  >
                    <ChevronRight className="inline size-3 mr-0.5" />
                    {activeChip.example}
                  </button>
                </div>
              </div>
            </div>
          )}

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
