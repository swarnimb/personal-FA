import { AccountSource } from '@prisma/client'
import { db } from '@/lib/db'
import { SyncStatusPanel } from '@/components/accounts/SyncStatusPanel'
import { ConnectedInstitutions } from '@/components/accounts/ConnectedInstitutions'
import { ConnectBankModal } from '@/components/accounts/ConnectBankModal'
import { AddExchangeModal } from '@/components/accounts/AddExchangeModal'
import { CSVImportModal } from '@/components/accounts/CSVImportModal'
import { AddManualAccountModal } from '@/components/accounts/AddManualAccountModal'

const API_SOURCES: AccountSource[] = [AccountSource.SimpleFin, AccountSource.Coinbase, AccountSource.Kraken]

export default async function AccountsPage() {
  const [accounts, lastSync] = await Promise.all([
    db.account.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    }),
    db.syncLog.findFirst({ orderBy: { startedAt: 'desc' } }),
  ])

  const toCard = (a: (typeof accounts)[number]) => ({
    id: a.id,
    name: a.name,
    institution: a.institution,
    type: a.type as string,
    typeConfirmed: a.typeConfirmed,
    currentBalanceCents: a.currentBalanceCents,
    lastSyncedAt: a.lastSyncedAt?.toISOString() ?? null,
    syncStatus: (a.lastSyncedAt ? 'synced' : 'never') as 'synced' | 'never',
  })

  const activeConnections = accounts.filter((a) => API_SOURCES.includes(a.source)).length
  const manualItems = accounts.filter((a) => a.source === AccountSource.Manual).length
  const lastSyncAt = lastSync?.completedAt?.toISOString() ?? lastSync?.startedAt?.toISOString() ?? null
  const allAccounts = accounts.map((a) => ({ id: a.id, name: a.name }))

  return (
    <div className="grid grid-cols-[1fr_380px] gap-4 min-h-full">
      <ConnectedInstitutions accounts={accounts.map(toCard)} />
      <div className="flex flex-col gap-4">
        <SyncStatusPanel
          activeConnections={activeConnections}
          manualItems={manualItems}
          lastSyncAt={lastSyncAt}
        />
        <div className="bg-surface-high rounded-xl p-6">
          <h3 className="font-manrope font-semibold text-base text-on-surface mb-4">Add Institution</h3>
          <div className="flex flex-col gap-3">
            <ConnectBankModal />
            <AddExchangeModal />
          </div>
        </div>
        <div className="bg-surface-high rounded-xl p-6">
          <h3 className="font-manrope font-semibold text-base text-on-surface mb-4">Import Data</h3>
          <div className="flex flex-col gap-3">
            <CSVImportModal accounts={allAccounts} />
            <AddManualAccountModal />
          </div>
        </div>
      </div>
    </div>
  )
}
