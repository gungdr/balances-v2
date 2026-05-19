import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { api } from '@/api/client'
import type { Me } from '@/hooks/useSession'

type Props = {
  user: Me
  children: React.ReactNode
}

export function AppShell({ user, children }: Props) {
  const qc = useQueryClient()

  async function handleSignOut() {
    try {
      await api('/api/auth/logout', { method: 'POST' })
    } finally {
      // Whatever happens on the server, surface the signed-out state on the
      // client by invalidating the session query.
      await qc.invalidateQueries({ queryKey: ['session'] })
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <header className="border-b border-border bg-background">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="font-semibold">balances</div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-right">
              <div className="text-foreground">{user.display_name}</div>
              <div className="text-muted-foreground text-xs">{user.email}</div>
            </div>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto w-full p-6">{children}</main>
    </div>
  )
}
