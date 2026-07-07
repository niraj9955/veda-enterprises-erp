'use client'

import * as React from 'react'
import { api } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Sparkles, Loader2, Mic, Check, X, RotateCcw } from 'lucide-react'
import { VoiceInput } from '@/components/ui/voice-input'
import { AI_MODULE_SCHEMAS } from '@/lib/ai-schemas'

// ─── AiFillDialog ───────────────────────────────────────────────────────────
//
// Modal that lets the user type or speak a natural-language description of
// what they want to record, then calls /api/ai/parse to extract structured
// fields, shows a preview, and on confirm calls onApply(fields) so the parent
// form can populate its fields.
//
// Props:
//   • open / onOpenChange — controls the dialog visibility
//   • module              — the AiModuleSchema.key (e.g., 'dailySell', 'production')
//   • onApply             — callback that receives the extracted fields as a
//                            Record<string, unknown>. The parent merges them
//                            into its form state.

interface AiFillDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  module: string
  onApply: (fields: Record<string, unknown>) => void
}

export function AiFillDialog({ open, onOpenChange, module, onApply }: AiFillDialogProps) {
  const [text, setText] = React.useState('')
  const [interim, setInterim] = React.useState('')
  const [parsing, setParsing] = React.useState(false)
  const [parsedFields, setParsedFields] = React.useState<Record<string, unknown> | null>(null)
  const [parseError, setParseError] = React.useState<string | null>(null)

  // Find the schema for this module — used to render the preview table with
  // proper labels and to know which fields are expected.
  const schema = React.useMemo(
    () => AI_MODULE_SCHEMAS.find((s) => s.key === module),
    [module]
  )

  // Reset state whenever the dialog opens (so users get a clean slate each time)
  React.useEffect(() => {
    if (open) {
      setText('')
      setInterim('')
      setParsedFields(null)
      setParseError(null)
    }
  }, [open])

  const handleParse = async () => {
    if (!text.trim()) {
      toast({ title: 'Empty input', description: 'Please type or speak something first', variant: 'destructive' })
      return
    }
    setParsing(true)
    setParseError(null)
    setParsedFields(null)
    try {
      const res = await api.aiParse(module, text.trim())
      if (Object.keys(res.fields).length === 0) {
        setParseError('AI could not extract any fields from your input. Try being more specific.')
      } else {
        setParsedFields(res.fields)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to parse input'
      setParseError(message)
    } finally {
      setParsing(false)
    }
  }

  const handleApply = () => {
    if (!parsedFields) return
    onApply(parsedFields)
    onOpenChange(false)
  }

  const handleRetry = () => {
    setParsedFields(null)
    setParseError(null)
  }

  // Voice handlers — accumulate transcripts into the text field
  const handleVoiceResult = (finalText: string) => {
    setText((prev) => {
      const sep = prev && !prev.endsWith(' ') ? ' ' : ''
      return prev + sep + finalText
    })
    setInterim('')
  }
  const handleVoiceInterim = (interimText: string) => {
    setInterim(interimText)
  }

  if (!schema) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-emerald-600" />
            AI Fill — {schema.label}
          </DialogTitle>
          <DialogDescription>
            Type or speak in Hindi/English. AI will extract the fields and show a preview before applying.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          {/* Input row: textarea-like Input + mic button */}
          <div className="grid gap-2">
            <Label htmlFor="ai-input">Describe the entry</Label>
            <div className="flex items-start gap-2">
              <textarea
                id="ai-input"
                value={text + (interim ? (text.endsWith(' ') || !text ? '' : ' ') + interim : '')}
                onChange={(e) => setText(e.target.value)}
                placeholder="e.g., 'aaj Suresh ne 1200 ka zigzag grey liya, mobile 9876543210'  OR  'kal 500 cement, 200 zigzag grey 80 banaye'"
                className="flex-1 min-h-[100px] resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                rows={4}
                disabled={parsing}
              />
              <VoiceInput
                onResult={handleVoiceResult}
                onInterim={handleVoiceInterim}
                disabled={parsing}
                className="shrink-0"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Tip: mention date, names, amounts, and product names naturally. Numbers should be in digits.
            </p>
          </div>

          {/* Parse button */}
          {!parsedFields && !parseError && (
            <Button
              onClick={handleParse}
              disabled={parsing || !text.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {parsing ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  AI is reading...
                </>
              ) : (
                <>
                  <Sparkles className="size-4 mr-2" />
                  Parse with AI
                </>
              )}
            </Button>
          )}

          {/* Error state */}
          {parseError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <div className="flex items-start gap-2">
                <X className="size-4 text-destructive shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-destructive font-medium">Parsing failed</p>
                  <p className="text-muted-foreground mt-1">{parseError}</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetry}
                className="mt-3 w-full"
              >
                <RotateCcw className="size-4 mr-2" />
                Try Again
              </Button>
            </div>
          )}

          {/* Preview state */}
          {parsedFields && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50/50 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-emerald-700 flex items-center gap-1">
                  <Check className="size-4" />
                  AI extracted {Object.keys(parsedFields).length} field{Object.keys(parsedFields).length !== 1 ? 's' : ''}
                </p>
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-emerald-200">
                  Preview
                </Badge>
              </div>
              <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                {schema.fields
                  .filter((f) => f.key in parsedFields)
                  .map((f) => {
                    const val = parsedFields[f.key]
                    const display = typeof val === 'number'
                      ? val.toLocaleString('en-IN') + (f.unit ? ` ${f.unit}` : '')
                      : String(val)
                    return (
                      <div key={f.key} className="flex items-start justify-between gap-2 text-sm">
                        <span className="text-muted-foreground shrink-0">{f.label}:</span>
                        <span className="font-medium text-right">{display}</span>
                      </div>
                    )
                  })}
              </div>
              <p className="text-xs text-muted-foreground mt-2 italic">
                Review and adjust in the form before submitting.
              </p>
            </div>
          )}

          {/* Expected fields hint */}
          {!parsedFields && !parseError && (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer hover:text-foreground">
                Expected fields for {schema.label}
              </summary>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {schema.fields.map((f) => (
                  <Badge key={f.key} variant="outline" className="text-[10px]">
                    {f.label}{f.required ? ' *' : ''}
                  </Badge>
                ))}
              </div>
            </details>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={parsing}>
            Cancel
          </Button>
          {parsedFields && (
            <Button
              onClick={handleApply}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Check className="size-4 mr-2" />
              Apply to Form
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default AiFillDialog
