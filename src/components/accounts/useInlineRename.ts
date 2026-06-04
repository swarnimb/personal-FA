'use client'

import { useState, type KeyboardEvent } from 'react'
import type { AccountPatchBody } from './useAccountMutation'

/**
 * Owns the inline name-editing state for an account row: edit-mode flag,
 * the working draft, and start/cancel/save handlers. The `patch` callback
 * is injected (from `useAccountMutation`) so this hook depends on the
 * mutation, not vice-versa. Save only PATCHes when the trimmed name is
 * non-empty and changed; otherwise it resets the draft and exits.
 *
 * @param currentName - the account's persisted name (draft seed + reset target)
 * @param patch - mutation callback; called with `{ name }` on a real change
 * @returns state + handlers consumed by the row's name editor
 */
export function useInlineRename(
  currentName: string,
  patch: (body: AccountPatchBody) => void,
) {
  const [isEditingName, setIsEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(currentName)

  /** Open the inline name editor, seeding the draft from the current name. */
  const startEditingName = () => {
    setNameDraft(currentName)
    setIsEditingName(true)
  }

  /** Discard the draft and leave edit mode without saving. */
  const cancelEditingName = () => {
    setNameDraft(currentName)
    setIsEditingName(false)
  }

  /** Save the draft name — only PATCH when it is non-empty and changed. */
  const saveName = () => {
    setIsEditingName(false)
    const trimmedName = nameDraft.trim()
    if (!trimmedName || trimmedName === currentName) {
      setNameDraft(currentName)
      return
    }
    patch({ name: trimmedName })
  }

  /** Enter saves, Escape cancels — both prevent the default key behavior. */
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveName()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelEditingName()
    }
  }

  return {
    isEditingName,
    nameDraft,
    setNameDraft,
    startEditingName,
    saveName,
    handleKeyDown,
  }
}
