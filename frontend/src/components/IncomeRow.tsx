import { useState } from 'react'
import { MoreHorizontal, Repeat, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { TableCell, TableRow } from '@/components/ui/table'
import { EditIncomeDialog } from '@/components/EditIncomeDialog'
import {
  CreateIncomeDialog,
  type DuplicateSeed,
} from '@/components/CreateIncomeDialog'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useDeleteIncome } from '@/hooks/useIncome'
import { useHouseholdMembers } from '@/hooks/useHouseholdMembers'
import { useSession } from '@/hooks/useSession'
import { formatCurrency, formatDate } from '@/lib/format'
import { ownershipLabel } from '@/lib/ownership'
import type { Income, IncomeCategory } from '@/api/types'

const CATEGORY_LABEL: Record<IncomeCategory, string> = {
  salary: 'Salary',
  business_income: 'Business',
  rental_income: 'Rental',
  gift: 'Gift',
  tax_refund: 'Tax refund',
  insurance_payout: 'Insurance',
  other: 'Other',
}

type Props = {
  income: Income
}

export function IncomeRow({ income }: Props) {
  const [editOpen, setEditOpen] = useState(false)
  const [duplicateOpen, setDuplicateOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const deleteMutation = useDeleteIncome()
  const { data: members } = useHouseholdMembers()
  const { data: currentUser } = useSession()

  const ownerLabel = ownershipLabel(
    income.ownership_type,
    income.sole_owner_user_id,
    members,
    currentUser,
  )

  function handleConfirmDelete() {
    deleteMutation.mutate(income.id, {
      onSuccess: () => setDeleteOpen(false),
    })
  }

  const seed: DuplicateSeed = {
    amount: income.amount,
    currency: income.currency,
    category: income.category,
    description: income.description,
    ownership_type: income.ownership_type,
    sole_owner_user_id: income.sole_owner_user_id,
    regularity: income.regularity,
  }

  const isRoutine = income.regularity === 'routine'
  const RegularityIcon = isRoutine ? Repeat : Sparkles
  const regularityLabel = isRoutine ? 'Routine income' : 'Incidental income'

  return (
    <>
      <TableRow>
        <TableCell className="whitespace-nowrap">
          {formatDate(income.date)}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs">
              {CATEGORY_LABEL[income.category]}
            </span>
            <RegularityIcon
              className="size-3.5 text-muted-foreground"
              aria-label={regularityLabel}
              data-testid={`regularity-${income.regularity}`}
            >
              <title>{regularityLabel}</title>
            </RegularityIcon>
          </div>
        </TableCell>
        <TableCell className="whitespace-nowrap font-medium">
          {formatCurrency(income.amount, income.currency)}
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {income.description || <span className="text-muted-foreground/60">—</span>}
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">
          {ownerLabel}
        </TableCell>
        <TableCell className="text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Income actions"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditOpen(true)}>
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDuplicateOpen(true)}>
                Duplicate
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

      <EditIncomeDialog
        key={income.updated_at}
        open={editOpen}
        onOpenChange={setEditOpen}
        income={income}
      />

      {duplicateOpen && (
        <CreateIncomeDialog
          key={`dup-${income.id}-${duplicateOpen}`}
          open={duplicateOpen}
          onOpenChange={setDuplicateOpen}
          seed={seed}
          hideTrigger
        />
      )}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this income entry?"
        description={`${CATEGORY_LABEL[income.category]} · ${formatCurrency(
          income.amount,
          income.currency,
        )} on ${formatDate(income.date)} will be hidden from lists and reports. This can be undone via the database, not yet via the UI.`}
        confirmLabel="Delete"
        destructive
        pending={deleteMutation.isPending}
        onConfirm={handleConfirmDelete}
      />
    </>
  )
}
