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
import { useLiabilities } from '@/hooks/useLiabilities'
import { CreateLiabilityDialog } from '@/components/CreateLiabilityDialog'
import { LiabilityListRow } from '@/components/LiabilityListRow'

type Props = {
  subtype: 'personal' | 'institutional'
  onSelect: (id: string) => void
}

const COPY = {
  personal: {
    title: 'Personal Liabilities',
    description:
      'Informal debts — money owed to family, friends, or other individuals.',
  },
  institutional: {
    title: 'Institutional Liabilities',
    description:
      'Formal debts — mortgages, bank loans, outstanding credit-card balances.',
  },
} as const

export function LiabilitiesScreen({ subtype, onSelect }: Props) {
  const { data, isPending, error } = useLiabilities(subtype)
  const copy = COPY[subtype]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {copy.title}
          </h1>
          <p className="text-sm text-muted-foreground">{copy.description}</p>
        </div>
        <CreateLiabilityDialog defaultSubtype={subtype} />
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
            <CardTitle>No {subtype} liabilities yet</CardTitle>
            <CardDescription>
              Create your first {subtype} liability to start tracking
              month-end balances.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateLiabilityDialog defaultSubtype={subtype} />
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
                  <LiabilityListRow
                    key={item.liability.id}
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
