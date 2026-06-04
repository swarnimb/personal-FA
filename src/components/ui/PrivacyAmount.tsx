'use client'

import { usePrivacy } from '@/context/PrivacyContext'
import { formatCents, formatCentsPrecise } from '@/lib/format'

const PRIVACY_MASK = '$···'

/**
 * @param precise show cents (2 decimals) instead of whole dollars — use for
 *   per-share prices where rounding hides the true value.
 */
export function PrivacyAmount({ cents, precise = false }: { cents: number; precise?: boolean }) {
  const { isPrivate } = usePrivacy()
  const formatted = precise ? formatCentsPrecise(cents) : formatCents(cents)
  return <span>{isPrivate ? PRIVACY_MASK : formatted}</span>
}
