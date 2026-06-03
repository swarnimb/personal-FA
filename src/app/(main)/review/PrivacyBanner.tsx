'use client'

/**
 * Persistent footer shown on the Review screen ONLY when AI is enabled
 * (CONSTRAINT-16 disclosure). States plainly what leaves the host: merchant
 * strings only — never amounts, dates, or account identifiers. Surface tier:
 * recessed (`surface-lowest`) so it reads as ambient chrome, not a row.
 */
export function PrivacyBanner() {
  return (
    <footer
      role="note"
      className="bg-surface-lowest rounded-lg px-4 py-2 font-inter text-xs text-on-surface-variant"
    >
      AI suggestions are sent to Anthropic — merchant strings only.
    </footer>
  )
}
