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
import { useMutualFunds } from '@/hooks/useInvestments'
import { CreateMutualFundDialog } from '@/components/CreateMutualFundDialog'
import { MutualFundListRow } from '@/components/MutualFundListRow'

type Props = {
  onSelect: (id: string) => void
}

export function MutualFundsScreen({ onSelect }: Props) {
  const { data, isPending, error } = useMutualFunds()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Mutual Funds
          </h1>
          <p className="text-sm text-muted-foreground">
            Pooled funds tracked by code and fund manager. Snapshots record
            month-end units and NAV.
          </p>
        </div>
        <CreateMutualFundDialog />
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
            <CardTitle>No mutual fund positions yet</CardTitle>
            <CardDescription>
              Create your first mutual fund position to start tracking month-end
              units and NAV.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateMutualFundDialog />
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
                  <TableHead>Fund code</TableHead>
                  <TableHead>Latest value</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((item) => (
                  <MutualFundListRow
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
