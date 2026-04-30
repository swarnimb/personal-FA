'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

class ConnectBankError extends Error {
  constructor(message: string) {
    super(`SimpleFin connect failed: ${message}`)
    this.name = 'ConnectBankError'
  }
}

/**
 * Modal for connecting a bank account via a SimpleFin one-time setup token.
 * Fires a background sync immediately after token exchange completes.
 */
export function ConnectBankModal() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [token, setToken] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConnect = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!token.trim()) { setError('Setup token is required'); return }
    setIsConnecting(true)
    setError(null)
    try {
      const res = await fetch('/api/accounts/simplefin/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setupToken: token.trim() }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new ConnectBankError(data.error ?? 'Unknown error')
      }
      // Fire sync without awaiting — API returns syncLogId immediately
      fetch('/api/sync', { method: 'POST' }).catch(() => undefined)
      setToken('')
      setIsOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setIsConnecting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Connect Bank Account">Connect Bank</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-manrope font-bold text-on-surface">Connect Bank Account</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="rounded-lg bg-surface-low p-4 flex flex-col gap-2">
            <p className="font-inter text-sm text-on-surface-variant">
              Uses <span className="text-on-surface font-medium">SimpleFin Bridge</span> to securely read your accounts.
            </p>
            <ol className="list-decimal list-inside flex flex-col gap-1 font-inter text-sm text-on-surface-variant">
              <li>Visit <span className="text-primary">beta-bridge.simplefin.org</span> and sign in</li>
              <li>Connect your bank, then click <span className="text-on-surface font-medium">Get One-Time Token</span></li>
              <li>Paste the token below</li>
            </ol>
          </div>
          <form onSubmit={handleConnect} className="flex flex-col gap-3" noValidate>
            {error && <p className="text-xs text-tertiary">{error}</p>}
            <Input
              placeholder="Paste setup token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={isConnecting}
              aria-label="SimpleFin setup token"
            />
            <Button type="submit" disabled={isConnecting || !token.trim()} aria-label="Connect bank account">
              {isConnecting ? 'Connecting…' : 'Connect Bank Account'}
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
