import { useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import { useCreateTimeDeposit } from '@/hooks/useInvestments'
import { useSession } from '@/hooks/useSession'
import { useHouseholdMembers } from '@/hooks/useHouseholdMembers'
import { preferredName } from '@/lib/names'
import { errorMessage } from '@/lib/errorMessage'
import { RiskProfileSelect } from '@/components/RiskProfileSelect'
import type { RiskProfile } from '@/api/types'
import type { RolloverPolicy } from '@/api/types'

function emptyForm() {
  return {
    display_name: '',
    description: '',
    ownership_type: 'joint' as 'sole' | 'joint',
    sole_owner_user_id: null as string | null,
    risk_profile: '' as RiskProfile | '',
    native_currency: 'IDR',
    bank_name: '',
    principal: '',
    interest_rate: '',
    term_months: '',
    placement_date: '',
    maturity_date: '',
    rollover_policy: 'no_rollover' as RolloverPolicy,
  }
}

// placement_date + term_months → maturity_date.
// Bank-actual maturities sometimes nudge by a day or two (holidays); the
// computed value is overwritten on any change to placement / term, but the
// user can edit maturity_date directly afterward and the override sticks
// until they touch placement or term again.
function addMonths(date: string, months: number): string {
  if (!date || Number.isNaN(months) || months <= 0) return ''
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

export function CreateTimeDepositDialog() {
  const { t } = useTranslation(['investments', 'common'])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const { data: user } = useSession()
  const { data: members } = useHouseholdMembers()
  const mutation = useCreateTimeDeposit()

  const effectiveSoleOwnerID = form.sole_owner_user_id ?? user?.id ?? null

  function close() {
    setOpen(false)
    setForm(emptyForm())
    mutation.reset()
  }

  function setPlacement(v: string) {
    const months = Number(form.term_months)
    setForm({
      ...form,
      placement_date: v,
      maturity_date: addMonths(v, months) || form.maturity_date,
    })
  }

  function setTerm(v: string) {
    const months = Number(v)
    setForm({
      ...form,
      term_months: v,
      maturity_date: addMonths(form.placement_date, months) || form.maturity_date,
    })
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    if (!form.risk_profile) return
    mutation.mutate(
      {
        display_name: form.display_name,
        description: form.description || null,
        ownership_type: form.ownership_type,
        sole_owner_user_id:
          form.ownership_type === 'sole' ? effectiveSoleOwnerID : null,
        risk_profile: form.risk_profile,
        native_currency: form.native_currency,
        bank_name: form.bank_name,
        principal: form.principal,
        interest_rate: form.interest_rate,
        term_months: Number(form.term_months),
        placement_date: form.placement_date,
        maturity_date: form.maturity_date,
        rollover_policy: form.rollover_policy,
      },
      { onSuccess: close },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button>{t('investments:timeDeposit.createTrigger')}</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('investments:timeDeposit.createTitle')}</DialogTitle>
          <DialogDescription>
            {t('investments:timeDeposit.createDescription')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-3">
            <div className="grid gap-2">
              <Label htmlFor="td_display_name">
                {t('common:fields.displayName')}
              </Label>
              <Input
                id="td_display_name"
                required
                value={form.display_name}
                onChange={(e) =>
                  setForm({ ...form, display_name: e.target.value })
                }
                placeholder={t('investments:timeDeposit.placeholders.displayName')}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="td_description">
                {t('common:fields.description')}
              </Label>
              <Input
                id="td_description"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="td_bank_name">
                  {t('investments:timeDeposit.fields.bankName')}
                </Label>
                <Input
                  id="td_bank_name"
                  required
                  value={form.bank_name}
                  onChange={(e) =>
                    setForm({ ...form, bank_name: e.target.value })
                  }
                  placeholder={t('investments:timeDeposit.placeholders.bankName')}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="td_currency">{t('common:fields.currency')}</Label>
                <Input
                  id="td_currency"
                  required
                  value={form.native_currency}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      native_currency: e.target.value.toUpperCase(),
                    })
                  }
                  placeholder={t('investments:timeDeposit.placeholders.currency')}
                  maxLength={3}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="td_principal">
                {t('investments:timeDeposit.fields.principal')}
              </Label>
              <Input
                id="td_principal"
                required
                inputMode="decimal"
                value={form.principal}
                onChange={(e) =>
                  setForm({ ...form, principal: e.target.value })
                }
                placeholder={t('investments:timeDeposit.placeholders.principal')}
              />
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="td_interest_rate">
                  {t('investments:timeDeposit.fields.interestRate')}
                </Label>
                <Input
                  id="td_interest_rate"
                  required
                  inputMode="decimal"
                  value={form.interest_rate}
                  onChange={(e) =>
                    setForm({ ...form, interest_rate: e.target.value })
                  }
                  placeholder={t('investments:timeDeposit.placeholders.interestRate')}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="td_term_months">
                  {t('investments:timeDeposit.fields.termMonths')}
                </Label>
                <Input
                  id="td_term_months"
                  required
                  inputMode="numeric"
                  value={form.term_months}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder={t('investments:timeDeposit.placeholders.termMonths')}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="td_placement_date">
                  {t('investments:timeDeposit.fields.placementDate')}
                </Label>
                <Input
                  id="td_placement_date"
                  required
                  type="date"
                  value={form.placement_date}
                  onChange={(e) => setPlacement(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="td_maturity_date">
                  {t('investments:timeDeposit.fields.maturityDate')}
                </Label>
                <Input
                  id="td_maturity_date"
                  required
                  type="date"
                  value={form.maturity_date}
                  onChange={(e) =>
                    setForm({ ...form, maturity_date: e.target.value })
                  }
                />
              </div>
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <div className="grid gap-2">
              <Label htmlFor="td_rollover_policy">
                {t('investments:timeDeposit.fields.rolloverPolicy')}
              </Label>
              <select
                id="td_rollover_policy"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={form.rollover_policy}
                onChange={(e) =>
                  setForm({
                    ...form,
                    rollover_policy: e.target.value as RolloverPolicy,
                  })
                }
              >
                <option value="auto_renew_principal">
                  {t('investments:timeDeposit.rolloverPolicy.auto_renew_principal')}
                </option>
                <option value="auto_renew_with_interest">
                  {t('investments:timeDeposit.rolloverPolicy.auto_renew_with_interest')}
                </option>
                <option value="no_rollover">
                  {t('investments:timeDeposit.rolloverPolicy.no_rollover')}
                </option>
              </select>
              <p className="text-xs text-muted-foreground">
                {t('investments:timeDeposit.rolloverHint')}
              </p>
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <div className="grid gap-2">
              <Label>{t('common:fields.ownership')}</Label>
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="ownership_type"
                    value="joint"
                    checked={form.ownership_type === 'joint'}
                    onChange={() =>
                      setForm({ ...form, ownership_type: 'joint' })
                    }
                  />
                  {t('investments:ownership.joint')}
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="ownership_type"
                    value="sole"
                    checked={form.ownership_type === 'sole'}
                    onChange={() =>
                      setForm({ ...form, ownership_type: 'sole' })
                    }
                  />
                  {t('investments:ownership.soleOwner')}
                </label>
              </div>
              {form.ownership_type === 'sole' && (
                <select
                  aria-label={t('investments:ownership.soleOwnerAria')}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={effectiveSoleOwnerID ?? ''}
                  onChange={(e) =>
                    setForm({ ...form, sole_owner_user_id: e.target.value })
                  }
                >
                  {(members ?? []).map((m) => (
                    <option key={m.id} value={m.id}>
                      {preferredName(m)}
                      {user && m.id === user.id ? t('common:ownership.youSuffix') : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <RiskProfileSelect
            idPrefix="td_create"
            value={form.risk_profile}
            onChange={(v) => setForm({ ...form, risk_profile: v })}
          />

          {mutation.error && (
            <p className="text-sm text-destructive">
              {errorMessage(mutation.error)}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              {t('common:cancel')}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending
                ? t('common:actions.creating')
                : t('common:actions.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
