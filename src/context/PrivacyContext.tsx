'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

const STORAGE_KEY = 'amibroke_privacy'

interface PrivacyContextValue {
  isPrivate: boolean
  togglePrivacy: () => void
}

const PrivacyContext = createContext<PrivacyContextValue | null>(null)

/**
 * Provides privacy mode state to the component tree.
 * Reads initial state from localStorage on mount.
 * Persists changes to localStorage under key 'amibroke_privacy'.
 */
export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [isPrivate, setIsPrivate] = useState(false)

  useEffect(() => {
    setIsPrivate(localStorage.getItem(STORAGE_KEY) === 'true')
  }, [])

  function togglePrivacy() {
    setIsPrivate((prev) => {
      const next = !prev
      localStorage.setItem(STORAGE_KEY, String(next))
      return next
    })
  }

  return (
    <PrivacyContext.Provider value={{ isPrivate, togglePrivacy }}>
      {children}
    </PrivacyContext.Provider>
  )
}

/**
 * Returns the current privacy mode state and toggle function.
 * Must be called inside a PrivacyProvider.
 */
export function usePrivacy(): PrivacyContextValue {
  const ctx = useContext(PrivacyContext)
  if (!ctx) throw new Error('usePrivacy must be used within PrivacyProvider')
  return ctx
}
