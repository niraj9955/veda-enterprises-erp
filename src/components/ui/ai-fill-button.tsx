'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Sparkles } from 'lucide-react'
import { AiFillDialog } from '@/components/ui/ai-fill-dialog'
import { useAiConfig } from '@/hooks/use-ai-config'
import { cn } from '@/lib/utils'

// ─── AiFillButton ───────────────────────────────────────────────────────────
//
// Reusable button that opens the AiFillDialog for a given module. Drop this
// into any form dialog to add AI form-fill capability.
//
// Props:
//   • module  — the AiModuleSchema.key (e.g., 'dailySell', 'production')
//   • onApply — callback that receives the parsed fields. The parent form
//               merges these into its form state.
//   • label   — optional custom button label (defaults to "AI Fill")
//   • className — extra classes
//
// The button is hidden entirely if AI is not enabled (no API key or disabled
// in admin). This way the UI stays clean for users who haven't set up AI.

interface AiFillButtonProps {
  module: string
  onApply: (fields: Record<string, unknown>) => void
  label?: string
  className?: string
  variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'destructive' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

export function AiFillButton({
  module,
  onApply,
  label = 'AI Fill',
  className,
  variant = 'outline',
  size = 'sm',
}: AiFillButtonProps) {
  const [open, setOpen] = React.useState(false)
  const { isEnabled, loading } = useAiConfig()

  // While config is loading, render nothing — avoids flicker if AI is enabled
  if (loading) return null

  // If AI is not enabled (no key or disabled), don't show the button at all
  if (!isEnabled) return null

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={() => setOpen(true)}
        className={cn(
          'text-emerald-700 border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800',
          className
        )}
        title="Fill this form using AI (type or speak)"
      >
        <Sparkles className="size-4" />
        {label}
      </Button>
      <AiFillDialog
        open={open}
        onOpenChange={setOpen}
        module={module}
        onApply={onApply}
      />
    </>
  )
}

export default AiFillButton
