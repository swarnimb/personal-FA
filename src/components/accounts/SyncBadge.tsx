/** Presentational pill showing whether an account has ever synced. */
export function SyncBadge({ status }: { status: 'synced' | 'never' }) {
  const synced = status === 'synced'
  return (
    <span className={`font-inter font-medium text-xs tracking-wider uppercase px-2 py-0.5 rounded ${
      synced ? 'bg-primary/10 text-primary' : 'bg-surface-highest text-on-surface-variant'
    }`}>
      {synced ? 'Synced' : 'Never synced'}
    </span>
  )
}
