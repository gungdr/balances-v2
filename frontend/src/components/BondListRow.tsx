import { useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { TableCell, TableRow } from '@/components/ui/table'
import { EditBondDialog } from '@/components/EditBondDialog'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useDeleteBond } from '@/hooks/useInvestments'
import { formatCurrency, formatYearMonth } from '@/lib/format'
import { StatusBadge } from '@/components/StatusBadge'
import { isActiveStatus } from '@/lib/lifecycle'
import { cn } from '@/lib/utils'
import { RiskProfileBadge } from '@/components/RiskProfileBadge'
import { maturityClass, maturityInfo } from '@/lib/maturity'
import type { BondListItem, CouponFrequency } from '@/api/types'

type Props = {
  item: BondListItem
  onSelect: (id: string) => void
}

function bondTypeLabel(t: BondListItem['details']['bond_type']): string {
  return t === 'govt_primary' ? 'Govt primary' : 'Secondary'
}

function frequencyLabel(f: CouponFrequency): string {
  switch (f) {
    case 'monthly':
      return 'monthly'
    case 'quarterly':
      return 'quarterly'
    case 'semi_annual':
      return 'semi-annual'
    case 'annual':
      return 'annual'
  }
}

export function BondListRow({ item, onSelect }: Props) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const deleteMutation = useDeleteBond()

  const terminated = !isActiveStatus(item.investment.status)

  function handleConfirmDelete() {
    deleteMutation.mutate(item.investment.id, {
      onSuccess: () => setDeleteOpen(false),
    })
  }

  const mInfo = maturityInfo(item.details.maturity_date)
  const couponPct = Number(item.details.coupon_rate).toFixed(2)

  return (
    <>
      <TableRow
        className={cn('cursor-pointer', terminated && 'text-muted-foreground')}
        onClick={() => onSelect(item.investment.id)}
      >
        <TableCell>
          <div className="flex items-center gap-2">
            <div className={cn('font-medium', terminated && 'font-normal')}>
              {item.investment.display_name}
            </div>
            <RiskProfileBadge profile={item.investment.risk_profile} compact />
          </div>
          {item.investment.description && (
            <div className="text-xs text-muted-foreground">
              {item.investment.description}
            </div>
          )}
        </TableCell>
        <TableCell>
          {item.details.series_code ? (
            <div className="font-mono text-sm">{item.details.series_code}</div>
          ) : (
            <div className="text-sm text-muted-foreground">—</div>
          )}
          <div className="text-xs text-muted-foreground">
            {bondTypeLabel(item.details.bond_type)} · {item.details.issuer} ·{' '}
            {couponPct}% {frequencyLabel(item.details.coupon_frequency)}
          </div>
          <div className={`text-xs ${maturityClass(mInfo.state)}`}>
            {mInfo.label}
          </div>
        </TableCell>
        <TableCell>
          <StatusBadge group="investments" status={item.investment.status} />
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {item.latest_snapshot ? (
            <>
              <div>
                {formatCurrency(
                  item.latest_snapshot.amount,
                  item.latest_snapshot.currency,
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {formatYearMonth(item.latest_snapshot.year_month)}
              </div>
            </>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell className="text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Bond actions"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenuItem onClick={() => setEditOpen(true)}>
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setDeleteOpen(true)}
                variant="destructive"
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>

      <EditBondDialog
        key={item.investment.id}
        open={editOpen}
        onOpenChange={setEditOpen}
        bond={item}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this bond position?"
        description={`${item.investment.display_name} will be hidden from lists and reports. This can be undone via the database, not yet via the UI.`}
        confirmLabel="Delete"
        destructive
        pending={deleteMutation.isPending}
        onConfirm={handleConfirmDelete}
      />
    </>
  )
}
