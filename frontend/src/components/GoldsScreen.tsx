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
import { useGolds } from '@/hooks/useInvestments'
import { CreateGoldDialog } from '@/components/CreateGoldDialog'
import { GoldListRow } from '@/components/GoldListRow'

type Props = {
  onSelect: (id: string) => void
}

export function GoldsScreen({ onSelect }: Props) {
  const { data, isPending, error } = useGolds()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Gold</h1>
          <p className="text-sm text-muted-foreground">
            Physical or digital gold tracked by form and purity. Snapshots
            record month-end grams held and price per gram.
          </p>
        </div>
        <CreateGoldDialog />
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
            <CardTitle>No gold positions yet</CardTitle>
            <CardDescription>
              Create your first gold position to start tracking month-end
              grams and price.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateGoldDialog />
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
                  <TableHead>Form &amp; purity</TableHead>
                  <TableHead>Latest value</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((item) => (
                  <GoldListRow
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
