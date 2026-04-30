'use client'

import { Eye, EyeOff } from 'lucide-react'
import { usePrivacy } from '@/context/PrivacyContext'

export function PrivacyToggle() {
  const { isPrivate, togglePrivacy } = usePrivacy()

  return (
    <button
      onClick={togglePrivacy}
      aria-label={isPrivate ? 'Show amounts' : 'Hide amounts'}
      className={`p-1.5 rounded transition-colors ${
        isPrivate
          ? 'text-primary'
          : 'text-on-surface-variant hover:text-on-surface'
      }`}
    >
      {isPrivate ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  )
}
