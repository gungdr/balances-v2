import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useBankAccounts } from '@/hooks/useBankAccounts'
import { CreateBankAccountDialog } from '@/components/CreateBankAccountDialog'
import { BankAccountListRow } from '@/components/BankAccountListRow'

type Props = {
  onSelect: (id: string) => void
}

export function BankAccountsScreen({ onSelect }: Props) {
  const { data, isPending, error } = useBankAccounts()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Bank accounts
          </h1>
          <p className="text-sm text-muted-foreground">
            Track monthly balances across your household's bank accounts.
          </p>
        </div>
        <CreateBankAccountDialog />
      </div>

      {isPending && (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}

      {error && (
        <p className="text-sm text-destructive">
          Failed to load: {(error as Error).message}
        </p>
      )}

      {data && data.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>No bank accounts yet</CardTitle>
            <CardDescription>
              Create your first bank account to start tracking month-end
              balances.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateBankAccountDialog />
          </CardContent>
        </Card>
      )}

      {data && data.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Ownership</TableHead>
                  <TableHead>Latest balance</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((item) => (
                  <BankAccountListRow
                    key={item.asset.id}
                    item={item}
                    onSelect={onSelect}
                  />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
