"use client"

import { cn } from "@/lib/utils"

/**
 * Visual props for one rendered toast in the stack.
 */
export interface ToastProps {
  /** Unique queue id (used as React key by the provider). */
  id: string
  /** Message content to display. Plain text — no markdown, no HTML. */
  message: string
  /** Optional Tailwind utility overrides. */
  className?: string
}

/**
 * Single toast pill — Velvet Ledger styled. Pure presentational
 * component; lifecycle (auto-dismiss, queue, anchoring) is owned by
 * `<ToastProvider />`.
 *
 * Design notes:
 *   - Surface tier 2 (`bg-surface-high`) — no border (No-Line Rule).
 *   - Inter body text on `on-surface` — no `#ffffff` (CONSTRAINT-05).
 *   - No `sm:` / `md:` breakpoints — desktop-only (CONSTRAINT-04).
 */
export function Toast({ id, message, className }: ToastProps) {
  return (
    <div
      role="status"
      data-toast-id={id}
      className={cn(
        "bg-surface-high text-on-surface",
        "font-inter text-sm leading-snug",
        "rounded-md px-4 py-3 max-w-md",
        // Echoes Dialog glass shadow language at a lower elevation.
        "shadow-[0px_12px_24px_rgba(0,0,0,0.4)]",
        className,
      )}
    >
      {message}
    </div>
  )
}
