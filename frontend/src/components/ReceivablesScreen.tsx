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
import { useReceivables } from '@/hooks/useReceivables'
import { CreateReceivableDialog } from '@/components/CreateReceivableDialog'
import { ReceivableListRow } from '@/components/ReceivableListRow'

type Props = {
  onSelect: (id: string) => void
}

export function ReceivablesScreen({ onSelect }: Props) {
  const { data, isPending, error } = useReceivables()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Receivables
          </h1>
          <p className="text-sm text-muted-foreground">
            Money owed to your household — loans, deposits in transit,
            outstanding refunds.
          </p>
        </div>
        <CreateReceivableDialog />
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
            <CardTitle>No receivables yet</CardTitle>
            <CardDescription>
              Create your first receivable to start tracking month-end
              balances owed to you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateReceivableDialog />
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
                  <ReceivableListRow
                    key={item.receivable.id}
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
