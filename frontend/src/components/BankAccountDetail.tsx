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
import {
  useBankAccount,
  useDeleteBankAccount,
  useSnapshots,
} from '@/hooks/useBankAccounts'
import { CreateSnapshotDialog } from '@/components/CreateSnapshotDialog'
import { formatCurrency, formatYearMonth, formatDate } from '@/lib/format'

type Props = {
  assetId: string
  onBack: () => void
}

export function BankAccountDetail({ assetId, onBack }: Props) {
  const { data: account, isPending, error } = useBankAccount(assetId)
  const { data: snapshots } = useSnapshots(assetId)
  const deleteMutation = useDeleteBankAccount()

  function handleDelete() {
    if (!window.confirm('Delete this bank account? Snapshots will be hidden.')) {
      return
    }
    deleteMutation.mutate(assetId, { onSuccess: onBack })
  }

  if (isPending) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }
  if (error) {
    return (
      <p className="text-sm text-destructive">
        Failed to load: {(error as Error).message}
      </p>
    )
  }
  if (!account) return null

  const { asset, details } = account

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 mb-1">
            ← Back
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">
            {asset.display_name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {details.bank_name} · {details.account_number} · {details.account_type}
          </p>
        </div>
        <div className="flex gap-2">
          <CreateSnapshotDialog assetId={asset.id} currency={asset.native_currency} />
          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account details</CardTitle>
          <CardDescription>
            Ownership: <span className="capitalize">{asset.ownership_type}</span>{' '}
            · Currency: {asset.native_currency} · Status: {asset.status}
          </CardDescription>
        </CardHeader>
        {asset.description && (
          <CardContent>
            <p className="text-sm">{asset.description}</p>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Snapshots</CardTitle>
          <CardDescription>
            Monthly balance readings from your bank statements.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {(!snapshots || snapshots.length === 0) ? (
            <p className="p-6 text-sm text-muted-foreground">
              No snapshots yet. Click "New snapshot" to record this month's balance.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Statement date</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snapshots.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      {formatYearMonth(s.year_month)}
                    </TableCell>
                    <TableCell>{formatCurrency(s.amount, s.currency)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.as_of_date ? formatDate(s.as_of_date) : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.description ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
