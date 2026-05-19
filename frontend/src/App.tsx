import { useState } from 'react'
import { useSession } from '@/hooks/useSession'
import { SignInScreen } from '@/components/SignInScreen'
import { AppShell } from '@/components/AppShell'
import { InviteForm } from '@/components/InviteForm'
import { BankAccountsScreen } from '@/components/BankAccountsScreen'
import { BankAccountDetail } from '@/components/BankAccountDetail'

function App() {
  const { data: user, isPending } = useSession()
  // Simple in-memory navigation between list and detail. A real router
  // (React Router or TanStack Router) lands in a later milestone when the
  // number of views grows; M3 just needs to walk through two of them.
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading…
      </div>
    )
  }

  if (!user) {
    return <SignInScreen />
  }

  return (
    <AppShell user={user}>
      <div className="space-y-8">
        {selectedAccountId ? (
          <BankAccountDetail
            assetId={selectedAccountId}
            onBack={() => setSelectedAccountId(null)}
          />
        ) : (
          <BankAccountsScreen onSelect={setSelectedAccountId} />
        )}

        {!selectedAccountId && <InviteForm />}
      </div>
    </AppShell>
  )
}

export default App
