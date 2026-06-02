import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { UseMutationResult } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError } from '@/api/client'
import { todayDate } from '@/lib/dateLimits'
import type { CreateInvestmentTransactionPayload } from '@/hooks/useInvestmentTransactions'

// Fee shape: cash amount required; quantity + price_per_unit optional but
// must be set together (for instruments where the manager settles a fee
// by removing units, typical for gold and some mutual funds). CONTEXT.md
// + ADR-0003: "snapshot quantity should reconcile to Σ(Buys.qty) −
// Σ(Sells.qty) − Σ(Fees.qty_deducted)".
type Props<TResult> = {
  currency: string
  quantityUnit: string
  mutation: UseMutationResult<
    TResult,
    unknown,
    CreateInvestmentTransactionPayload
  >
}

function emptyForm() {
  return {
    transaction_date: todayDate(),
    amount: '',
    quantity: '',
    price_per_unit: '',
    description: '',
  }
}

export function CreateFeeTransactionDialog<TResult>({
  currency,
  quantityUnit,
  mutation,
}: Props<TResult>) {
  const { t } = useTranslation(['investments', 'common'])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)

  // Unit fee: both qty + price are filled; neither = pure cash fee.
  const hasQty = !!form.quantity
  const hasPrice = !!form.price_per_unit
  const unitFeeIncomplete = hasQty !== hasPrice

  function close() {
    setOpen(false)
    setForm(emptyForm())
    mutation.reset()
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.amount || unitFeeIncomplete) return
    mutation.mutate(
      {
        transaction_type: 'fee',
        transaction_date: form.transaction_date,
        currency,
        description: form.description || null,
        amount: form.amount,
        quantity: form.quantity || null,
        price_per_unit: form.price_per_unit || null,
        principal_amount: null,
        interest_amount: null,
        principal_disposition: null,
        interest_disposition: null,
      },
      { onSuccess: close },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          {t('investments:fee.trigger')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('investments:fee.createTitle')}</DialogTitle>
          <DialogDescription>
            {t('investments:fee.createDescription')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="fee_date">
                {t('investments:fee.feeDateLabel')}
              </Label>
              <Input
                id="fee_date"
                type="date"
                required
                max={todayDate()}
                value={form.transaction_date}
                onChange={(e) =>
                  setForm({ ...form, transaction_date: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="fee_amount">
                {t('investments:fee.cashAmountLabel', { currency })}
              </Label>
              <Input
                id="fee_amount"
                required
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder={t('investments:fee.cashAmountPlaceholder')}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="fee_quantity">
                {t('investments:fee.unitsDeductedLabel', { unit: quantityUnit })}
              </Label>
              <Input
                id="fee_quantity"
                inputMode="decimal"
                value={form.quantity}
                onChange={(e) =>
                  setForm({ ...form, quantity: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="fee_price">
                {t('investments:fee.conversionPriceLabel', { currency })}
              </Label>
              <Input
                id="fee_price"
                inputMode="decimal"
                value={form.price_per_unit}
                onChange={(e) =>
                  setForm({ ...form, price_per_unit: e.target.value })
                }
              />
            </div>
          </div>

          {unitFeeIncomplete && (
            <p className="text-xs text-amber-600">
              {t('investments:fee.incompleteHint')}
            </p>
          )}

          <div className="grid gap-2">
            <Label htmlFor="fee_description">
              {t('common:fields.description')}
            </Label>
            <Input
              id="fee_description"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder={t('investments:fee.descriptionPlaceholder')}
            />
          </div>

          {mutation.isError && (
            <p className="text-sm text-destructive">
              {formatError(mutation.error, t('common:unknownError'))}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              {t('common:cancel')}
            </Button>
            <Button
              type="submit"
              disabled={
                mutation.isPending || !form.amount || unitFeeIncomplete
              }
            >
              {mutation.isPending
                ? t('common:actions.saving')
                : t('investments:fee.recordFee')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function formatError(err: unknown, unknownLabel: string): string {
  if (err instanceof ApiError) {
    if (typeof err.body === 'string' && err.body) return err.body
    return `${err.status} ${err.message}`
  }
  if (err instanceof Error) return err.message
  return unknownLabel
}
