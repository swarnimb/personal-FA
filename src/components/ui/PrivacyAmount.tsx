'use client'

import { usePrivacy } from '@/context/PrivacyContext'
import { formatCents } from '@/lib/format'

const PRIVACY_MASK = '$···'

export function PrivacyAmount({ cents }: { cents: number }) {
  const { isPrivate } = usePrivacy()
  return <span>{isPrivate ? PRIVACY_MASK : formatCents(cents)}</span>
}
