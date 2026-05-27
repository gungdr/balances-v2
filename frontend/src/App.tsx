import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSession } from '@/hooks/useSession'
import { SignInScreen } from '@/components/SignInScreen'
import { AppShell } from '@/components/AppShell'
import { BankAccountsScreen } from '@/components/BankAccountsScreen'
import { BankAccountDetail } from '@/components/BankAccountDetail'
import { PropertiesScreen } from '@/components/PropertiesScreen'
import { PropertyDetail } from '@/components/PropertyDetail'
import { VehiclesScreen } from '@/components/VehiclesScreen'
import { VehicleDetail } from '@/components/VehicleDetail'
import { LiabilitiesScreen } from '@/components/LiabilitiesScreen'
import { LiabilityDetail } from '@/components/LiabilityDetail'
import { ReceivablesScreen } from '@/components/ReceivablesScreen'
import { ReceivableDetail } from '@/components/ReceivableDetail'
import { StocksScreen } from '@/components/StocksScreen'
import { StockDetail } from '@/components/StockDetail'
import { MutualFundsScreen } from '@/components/MutualFundsScreen'
import { MutualFundDetail } from '@/components/MutualFundDetail'
import { GoldsScreen } from '@/components/GoldsScreen'
import { GoldDetail } from '@/components/GoldDetail'
import { BondsScreen } from '@/components/BondsScreen'
import { BondDetail } from '@/components/BondDetail'
import { TimeDepositsScreen } from '@/components/TimeDepositsScreen'
import { TimeDepositDetail } from '@/components/TimeDepositDetail'
import { IncomeScreen } from '@/components/IncomeScreen'
import { DashboardScreen } from '@/components/DashboardScreen'
import { SettingsScreen } from '@/components/SettingsScreen'

type Group =
  | 'dashboard'
  | 'assets'
  | 'liabilities'
  | 'receivables'
  | 'investments'
  | 'income'
  | 'settings'
type AssetSubtype = 'bank_account' | 'property' | 'vehicle'
type LiabilitySubtype = 'personal' | 'institutional'
type InvestmentSubtypeNav =
  | 'stock'
  | 'mutual_fund'
  | 'bond'
  | 'time_deposit'
  | 'gold'

type Selection =
  | { kind: AssetSubtype; assetId: string }
  | { kind: 'liability'; liabilityId: string }
  | { kind: 'receivable'; receivableId: string }
  | { kind: 'stock'; investmentId: string }
  | { kind: 'mutual_fund'; investmentId: string }
  | { kind: 'bond'; investmentId: string }
  | { kind: 'time_deposit'; investmentId: string }
  | { kind: 'gold'; investmentId: string }

function App() {
  const { data: user, isPending } = useSession()
  // Two-level in-state navigation: outer group (Assets / Liabilities / …),
  // inner subtype where the group has one. A real router lands in M4.9 and
  // the URL structure will mirror this hierarchy.
  const [group, setGroup] = useState<Group>('dashboard')
  const [assetSubtype, setAssetSubtype] = useState<AssetSubtype>('bank_account')
  const [liabilitySubtype, setLiabilitySubtype] =
    useState<LiabilitySubtype>('personal')
  const [investmentSubtype, setInvestmentSubtype] =
    useState<InvestmentSubtypeNav>('stock')
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
        {selection.kind === 'liability' && (
          <LiabilityDetail
            liabilityId={selection.liabilityId}
            onBack={() => setSelection(null)}
          />
        )}
        {selection.kind === 'receivable' && (
          <ReceivableDetail
            receivableId={selection.receivableId}
            onBack={() => setSelection(null)}
          />
        )}
        {selection.kind === 'stock' && (
          <StockDetail
            investmentId={selection.investmentId}
            onBack={() => setSelection(null)}
          />
        )}
        {selection.kind === 'mutual_fund' && (
          <MutualFundDetail
            investmentId={selection.investmentId}
            onBack={() => setSelection(null)}
          />
        )}
        {selection.kind === 'bond' && (
          <BondDetail
            investmentId={selection.investmentId}
            onBack={() => setSelection(null)}
          />
        )}
        {selection.kind === 'time_deposit' && (
          <TimeDepositDetail
            investmentId={selection.investmentId}
            onBack={() => setSelection(null)}
          />
        )}
        {selection.kind === 'gold' && (
          <GoldDetail
            investmentId={selection.investmentId}
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
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="assets">Assets</TabsTrigger>
            <TabsTrigger value="liabilities">Liabilities</TabsTrigger>
            <TabsTrigger value="receivables">Receivables</TabsTrigger>
            <TabsTrigger value="investments">Investments</TabsTrigger>
            <TabsTrigger value="income">Income</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6">
            <DashboardScreen />
          </TabsContent>

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
            <Tabs
              value={liabilitySubtype}
              onValueChange={(v) =>
                setLiabilitySubtype(v as LiabilitySubtype)
              }
            >
              <TabsList>
                <TabsTrigger value="personal">Personal</TabsTrigger>
                <TabsTrigger value="institutional">Institutional</TabsTrigger>
              </TabsList>
              <TabsContent value="personal" className="mt-6">
                <LiabilitiesScreen
                  subtype="personal"
                  onSelect={(liabilityId) =>
                    setSelection({ kind: 'liability', liabilityId })
                  }
                />
              </TabsContent>
              <TabsContent value="institutional" className="mt-6">
                <LiabilitiesScreen
                  subtype="institutional"
                  onSelect={(liabilityId) =>
                    setSelection({ kind: 'liability', liabilityId })
                  }
                />
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="receivables" className="mt-6">
            <ReceivablesScreen
              onSelect={(receivableId) =>
                setSelection({ kind: 'receivable', receivableId })
              }
            />
          </TabsContent>

          <TabsContent value="investments" className="mt-6">
            <Tabs
              value={investmentSubtype}
              onValueChange={(v) =>
                setInvestmentSubtype(v as InvestmentSubtypeNav)
              }
            >
              <TabsList>
                <TabsTrigger value="stock">Stocks</TabsTrigger>
                <TabsTrigger value="mutual_fund">Mutual Funds</TabsTrigger>
                <TabsTrigger value="bond">Bonds</TabsTrigger>
                <TabsTrigger value="time_deposit">Time Deposits</TabsTrigger>
                <TabsTrigger value="gold">Gold</TabsTrigger>
              </TabsList>
              <TabsContent value="stock" className="mt-6">
                <StocksScreen
                  onSelect={(investmentId) =>
                    setSelection({ kind: 'stock', investmentId })
                  }
                />
              </TabsContent>
              <TabsContent value="mutual_fund" className="mt-6">
                <MutualFundsScreen
                  onSelect={(investmentId) =>
                    setSelection({ kind: 'mutual_fund', investmentId })
                  }
                />
              </TabsContent>
              <TabsContent value="bond" className="mt-6">
                <BondsScreen
                  onSelect={(investmentId) =>
                    setSelection({ kind: 'bond', investmentId })
                  }
                />
              </TabsContent>
              <TabsContent value="time_deposit" className="mt-6">
                <TimeDepositsScreen
                  onSelect={(investmentId) =>
                    setSelection({ kind: 'time_deposit', investmentId })
                  }
                />
              </TabsContent>
              <TabsContent value="gold" className="mt-6">
                <GoldsScreen
                  onSelect={(investmentId) =>
                    setSelection({ kind: 'gold', investmentId })
                  }
                />
              </TabsContent>
            </Tabs>
          </TabsContent>
          <TabsContent value="income" className="mt-6">
            <IncomeScreen />
          </TabsContent>
          <TabsContent value="settings" className="mt-6">
            <SettingsScreen />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  )
}

export default App
