"use client"

import * as React from "react"
import { Toast } from "@/components/ui/toast"

/** Single queued toast. */
interface QueuedToast {
  id: string
  message: string
}

/** Public hook contract. */
interface ToastContextValue {
  /** Enqueue a toast. Auto-dismisses after `TOAST_AUTO_DISMISS_MS`. */
  show(message: string): void
}

/**
 * Auto-dismiss duration for every toast in this provider's queue.
 * Locked by Task 55 acceptance criteria — do not parameterise without
 * a spec change.
 */
const TOAST_AUTO_DISMISS_MS = 5_000

const ToastContext = React.createContext<ToastContextValue | null>(null)

/**
 * Thrown when `useToast()` is called outside a `<ToastProvider>`
 * subtree. Named class satisfies EH-05 (rules/error-handling.md) and
 * makes the failure mode targetable in tests.
 */
export class ToastProviderMissingError extends Error {
  constructor() {
    super(
      "useToast() must be called inside a <ToastProvider> subtree. " +
        "Wrap your component tree with <ToastProvider> at the (main)/layout level (Task 57).",
    )
    this.name = "ToastProviderMissingError"
  }
}

/**
 * Provider for the demo-toast queue. Mount near the root of the
 * `(main)/` layout (Task 57). Owns the queue and lifecycle of every
 * toast triggered via `useToast()`.
 *
 * Contract:
 *   - 5s auto-dismiss
 *   - Bottom-right anchored stack
 *   - Single queue per provider instance
 *   - Dark Velvet Ledger styling (delegated to `<Toast />`)
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = React.useState<QueuedToast[]>([])
  const timers = React.useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

  const show = React.useCallback((message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setQueue((prev) => [...prev, { id, message }])
    const handle = setTimeout(() => {
      timers.current.delete(handle)
      setQueue((prev) => prev.filter((t) => t.id !== id))
    }, TOAST_AUTO_DISMISS_MS)
    timers.current.add(handle)
  }, [])

  // Clear pending timers on unmount — avoids state updates on
  // unmounted trees (the provider is mounted at the layout root and
  // normally never unmounts, but this keeps tests and HMR clean).
  React.useEffect(() => {
    const pending = timers.current
    return () => {
      pending.forEach((h) => clearTimeout(h))
      pending.clear()
    }
  }, [])

  // Stable identity prevents needless re-renders downstream.
  const value = React.useMemo<ToastContextValue>(() => ({ show }), [show])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2"
      >
        {queue.map((t) => (
          <Toast key={t.id} id={t.id} message={t.message} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

/**
 * Hook for client components that need to surface a toast.
 *
 * @throws {ToastProviderMissingError} when called outside a `<ToastProvider>` subtree
 */
export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext)
  if (ctx === null) {
    throw new ToastProviderMissingError()
  }
  return ctx
}
