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
import { useBonds } from '@/hooks/useInvestments'
import { CreateBondDialog } from '@/components/CreateBondDialog'
import { BondListRow } from '@/components/BondListRow'

type Props = {
  onSelect: (id: string) => void
}

export function BondsScreen({ onSelect }: Props) {
  const { data, isPending, error } = useBonds()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bonds</h1>
          <p className="text-sm text-muted-foreground">
            Fixed-income instruments — tracked by series, issuer, coupon, and
            maturity, with monthly accrued-interest snapshots.
          </p>
        </div>
        <CreateBondDialog />
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
            <CardTitle>No bond positions yet</CardTitle>
            <CardDescription>
              Create your first bond position to start tracking month-end
              value and accrued interest.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateBondDialog />
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
                  <BondListRow
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
