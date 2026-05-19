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
import { useVehicles } from '@/hooks/useVehicles'
import { CreateVehicleDialog } from '@/components/CreateVehicleDialog'
import { VehicleListRow } from '@/components/VehicleListRow'

type Props = {
  onSelect: (id: string) => void
}

export function VehiclesScreen({ onSelect }: Props) {
  const { data, isPending, error } = useVehicles()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vehicles</h1>
          <p className="text-sm text-muted-foreground">
            Track monthly valuations across the household's vehicles.
          </p>
        </div>
        <CreateVehicleDialog />
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
            <CardTitle>No vehicles yet</CardTitle>
            <CardDescription>
              Create your first vehicle to start tracking month-end
              valuations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateVehicleDialog />
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
                  <TableHead>Latest valuation</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((item) => (
                  <VehicleListRow
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
