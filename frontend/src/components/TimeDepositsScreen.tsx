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
import { useTimeDeposits } from '@/hooks/useInvestments'
import { CreateTimeDepositDialog } from '@/components/CreateTimeDepositDialog'
import { TimeDepositListRow } from '@/components/TimeDepositListRow'

type Props = {
  onSelect: (id: string) => void
}

export function TimeDepositsScreen({ onSelect }: Props) {
  const { data, isPending, error } = useTimeDeposits()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Time Deposits
          </h1>
          <p className="text-sm text-muted-foreground">
            Locked-principal bank placements — tracked by bank, rate, and
            term, with monthly accrued-interest snapshots.
          </p>
        </div>
        <CreateTimeDepositDialog />
      </div>

      {isPending && <p className="text-sm text-muted-foreground">Loading…</p>}

      {error && (
        <p className="text-sm text-destructive">
          Failed to load: {(error as Error).message}
        </p>
      )}

      {data && data.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>No time deposits yet</CardTitle>
            <CardDescription>
              Create your first time deposit to start tracking month-end value
              and accrued interest.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateTimeDepositDialog />
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
                  <TableHead>Identity</TableHead>
                  <TableHead>Latest value</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((item) => (
                  <TimeDepositListRow
                    key={item.investment.id}
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
