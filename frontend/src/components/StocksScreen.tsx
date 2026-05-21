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
import { useStocks } from '@/hooks/useInvestments'
import { CreateStockDialog } from '@/components/CreateStockDialog'
import { StockListRow } from '@/components/StockListRow'

type Props = {
  onSelect: (id: string) => void
}

export function StocksScreen({ onSelect }: Props) {
  const { data, isPending, error } = useStocks()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Stocks</h1>
          <p className="text-sm text-muted-foreground">
            Listed equities — tracked by ticker and exchange, with monthly
            quantity-and-price snapshots.
          </p>
        </div>
        <CreateStockDialog />
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
            <CardTitle>No stock positions yet</CardTitle>
            <CardDescription>
              Create your first stock position to start tracking month-end
              quantity and price.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateStockDialog />
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
                  <TableHead>Ticker</TableHead>
                  <TableHead>Latest value</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((item) => (
                  <StockListRow
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
