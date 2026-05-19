import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useSession } from '@/hooks/useSession'
import { SignInScreen } from '@/components/SignInScreen'
import { AppShell } from '@/components/AppShell'
import { InviteForm } from '@/components/InviteForm'
import { BankAccountsScreen } from '@/components/BankAccountsScreen'
import { BankAccountDetail } from '@/components/BankAccountDetail'
import { PropertiesScreen } from '@/components/PropertiesScreen'
import { PropertyDetail } from '@/components/PropertyDetail'
import { VehiclesScreen } from '@/components/VehiclesScreen'
import { VehicleDetail } from '@/components/VehicleDetail'

type Group = 'assets' | 'liabilities' | 'receivables' | 'investments' | 'income'
type AssetSubtype = 'bank_account' | 'property' | 'vehicle'

type Selection = {
  kind: AssetSubtype
  assetId: string
}

function App() {
  const { data: user, isPending } = useSession()
  // Two-level in-state navigation: outer group (Assets / Liabilities / …),
  // inner subtype (only Assets has multiple today). A real router lands in
  // M4.9 and the URL structure will mirror this hierarchy.
  const [group, setGroup] = useState<Group>('assets')
  const [assetSubtype, setAssetSubtype] = useState<AssetSubtype>('bank_account')
  const [selection, setSelection] = useState<Selection | null>(null)

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

  if (selection) {
    return (
      <AppShell user={user}>
        {selection.kind === 'bank_account' && (
          <BankAccountDetail
            assetId={selection.assetId}
            onBack={() => setSelection(null)}
          />
        )}
        {selection.kind === 'property' && (
          <PropertyDetail
            assetId={selection.assetId}
            onBack={() => setSelection(null)}
          />
        )}
        {selection.kind === 'vehicle' && (
          <VehicleDetail
            assetId={selection.assetId}
            onBack={() => setSelection(null)}
          />
        )}
      </AppShell>
    )
  }

  return (
    <AppShell user={user}>
      <div className="space-y-8">
        <Tabs value={group} onValueChange={(v) => setGroup(v as Group)}>
          <TabsList>
            <TabsTrigger value="assets">Assets</TabsTrigger>
            <TabsTrigger value="liabilities">Liabilities</TabsTrigger>
            <TabsTrigger value="receivables">Receivables</TabsTrigger>
            <TabsTrigger value="investments">Investments</TabsTrigger>
            <TabsTrigger value="income">Income</TabsTrigger>
          </TabsList>

          <TabsContent value="assets" className="mt-6">
            <Tabs
              value={assetSubtype}
              onValueChange={(v) => setAssetSubtype(v as AssetSubtype)}
            >
              <TabsList>
                <TabsTrigger value="bank_account">Bank Accounts</TabsTrigger>
                <TabsTrigger value="property">Properties</TabsTrigger>
                <TabsTrigger value="vehicle">Vehicles</TabsTrigger>
              </TabsList>
              <TabsContent value="bank_account" className="mt-6">
                <BankAccountsScreen
                  onSelect={(assetId) =>
                    setSelection({ kind: 'bank_account', assetId })
                  }
                />
              </TabsContent>
              <TabsContent value="property" className="mt-6">
                <PropertiesScreen
                  onSelect={(assetId) =>
                    setSelection({ kind: 'property', assetId })
                  }
                />
              </TabsContent>
              <TabsContent value="vehicle" className="mt-6">
                <VehiclesScreen
                  onSelect={(assetId) =>
                    setSelection({ kind: 'vehicle', assetId })
                  }
                />
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="liabilities" className="mt-6">
            <ComingSoonCard title="Liabilities" milestone="M4.2" />
          </TabsContent>
          <TabsContent value="receivables" className="mt-6">
            <ComingSoonCard title="Receivables" milestone="M4.2" />
          </TabsContent>
          <TabsContent value="investments" className="mt-6">
            <ComingSoonCard title="Investments" milestone="M4.3–M4.6" />
          </TabsContent>
          <TabsContent value="income" className="mt-6">
            <ComingSoonCard title="Income" milestone="M4.7" />
          </TabsContent>
        </Tabs>

        <InviteForm />
      </div>
    </AppShell>
  )
}

function ComingSoonCard({
  title,
  milestone,
}: {
  title: string
  milestone: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          Coming in {milestone}. The data model is already designed in{' '}
          <code>CONTEXT.md</code> and the relevant ADRs — only the screens
          are pending.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          See <code>docs/ROADMAP.md</code> for the implementation timeline.
        </p>
      </CardContent>
    </Card>
  )
}

export default App
