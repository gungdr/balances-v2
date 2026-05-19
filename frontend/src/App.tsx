import { useSession } from '@/hooks/useSession'
import { SignInScreen } from '@/components/SignInScreen'
import { AppShell } from '@/components/AppShell'
import { InviteForm } from '@/components/InviteForm'

function App() {
  const { data: user, isPending } = useSession()

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
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome, {user.display_name.split(' ')[0]}
          </h1>
          <p className="text-sm text-muted-foreground">
            Household {user.household_id.slice(0, 8)}…
          </p>
        </div>
        <InviteForm />
      </div>
    </AppShell>
  )
}

export default App
