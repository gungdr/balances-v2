import { Button } from '@/components/ui/button'
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
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useBankAccounts } from '@/hooks/useBankAccounts'
import { CreateBankAccountDialog } from '@/components/CreateBankAccountDialog'
import { formatCurrency, formatYearMonth } from '@/lib/format'

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
                  <TableHead>Bank</TableHead>
                  <TableHead>Ownership</TableHead>
                  <TableHead>Latest balance</TableHead>
                  <TableHead>As of</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((item) => (
                  <TableRow
                    key={item.asset.id}
                    className="cursor-pointer"
                    onClick={() => onSelect(item.asset.id)}
                  >
                    <TableCell className="font-medium">
                      {item.asset.display_name}
                    </TableCell>
                    <TableCell>{item.details.bank_name}</TableCell>
                    <TableCell className="capitalize">
                      {item.asset.ownership_type}
                    </TableCell>
                    <TableCell>
                      {item.latest_snapshot ? (
                        formatCurrency(
                          item.latest_snapshot.amount,
                          item.latest_snapshot.currency,
                        )
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.latest_snapshot
                        ? formatYearMonth(item.latest_snapshot.year_month)
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          onSelect(item.asset.id)
                        }}
                      >
                        Open →
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
