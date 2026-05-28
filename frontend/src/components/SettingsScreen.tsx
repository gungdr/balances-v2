import { useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ApiError } from '@/api/client'
import { useSession } from '@/hooks/useSession'
import { useUpdateMe } from '@/hooks/useUpdateMe'
import { useUpdateHouseholdSettings } from '@/hooks/useHouseholdSettings'
import {
  useFxRates,
  useCreateFxRate,
  useDeleteFxRate,
} from '@/hooks/useFxRates'
import { formatYearMonth } from '@/lib/format'
import { InviteForm } from '@/components/InviteForm'

function errText(err: unknown): string {
  if (err instanceof ApiError && typeof err.body === 'string' && err.body) {
    return err.body
  }
  return err instanceof Error ? err.message : 'Something went wrong'
}

export function SettingsScreen() {
  const { data: me } = useSession()
  const updateSettings = useUpdateHouseholdSettings()
  const [currency, setCurrency] = useState<string | null>(null)

  if (!me) return null

  const reportingCurrency = (currency ?? me.reporting_currency).toUpperCase()

  const saveCurrency = () =>
    updateSettings.mutate({
      reporting_currency: reportingCurrency,
      multi_currency_enabled: me.multi_currency_enabled,
    })

  const toggleMulti = (enabled: boolean) =>
    updateSettings.mutate({
      reporting_currency: me.reporting_currency,
      multi_currency_enabled: enabled,
    })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Reporting currency, multi-currency tracking, and household
          invitations.
        </p>
      </div>

      <NicknameCard />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Currency</CardTitle>
          <CardDescription>
            Net worth is reported in this currency. Turn on multi-currency to
            hold positions in other currencies and enter monthly exchange rates.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="reporting-currency">Reporting currency</Label>
              <Input
                id="reporting-currency"
                className="w-28 uppercase"
                maxLength={3}
                value={reportingCurrency}
                onChange={(e) => setCurrency(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              onClick={saveCurrency}
              disabled={updateSettings.isPending || reportingCurrency.length !== 3}
            >
              Save
            </Button>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={me.multi_currency_enabled}
              disabled={updateSettings.isPending}
              onChange={(e) => toggleMulti(e.target.checked)}
            />
            Enable multi-currency tracking
          </label>

          {updateSettings.isError && (
            <p className="text-sm text-destructive">
              {errText(updateSettings.error)}
            </p>
          )}
        </CardContent>
      </Card>

      {me.multi_currency_enabled && <FxRatesCard />}

      <InviteForm />
    </div>
  )
}

function NicknameCard() {
  const { data: me } = useSession()
  const updateMe = useUpdateMe()
  const [draft, setDraft] = useState<string | null>(null)

  if (!me) return null

  // `draft ?? me.nickname ?? ''` — null draft means "untouched, show current";
  // once the user types, draft is a string (even "") and wins.
  const value = draft ?? me.nickname ?? ''
  const trimmed = value.trim()
  const current = me.nickname ?? ''
  const dirty = trimmed !== current

  const save = () =>
    updateMe.mutate(
      { nickname: trimmed === '' ? null : trimmed },
      { onSuccess: () => setDraft(null) },
    )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Your name</CardTitle>
        <CardDescription>
          A short nickname shown in ownership labels and owner pickers. Leave it
          blank to use your full name ({me.display_name}).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="nickname">Nickname</Label>
            <Input
              id="nickname"
              className="w-56"
              maxLength={32}
              placeholder={me.display_name}
              value={value}
              onChange={(e) => setDraft(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            onClick={save}
            disabled={updateMe.isPending || !dirty}
          >
            Save
          </Button>
        </div>

        {updateMe.isError && (
          <p className="text-sm text-destructive">{errText(updateMe.error)}</p>
        )}
      </CardContent>
    </Card>
  )
}

function FxRatesCard() {
  const { data: rates, isPending } = useFxRates()
  const createRate = useCreateFxRate()
  const deleteRate = useDeleteFxRate()

  const [month, setMonth] = useState('')
  const [currency, setCurrency] = useState('')
  const [rate, setRate] = useState('')

  const add = () => {
    createRate.mutate(
      { year_month: month, currency: currency.toUpperCase(), rate },
      {
        onSuccess: () => {
          setMonth('')
          setCurrency('')
          setRate('')
        },
      },
    )
  }

  const canAdd =
    month !== '' && currency.length === 3 && rate !== '' && Number(rate) > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Exchange rates</CardTitle>
        <CardDescription>
          One rate per month per currency — reporting-currency units per 1 unit
          of the foreign currency (the month-end rate). Later months reuse the
          most recent rate until you enter a new one.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="fx-month">Month</Label>
            <Input
              id="fx-month"
              type="month"
              className="w-40"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="fx-currency">Currency</Label>
            <Input
              id="fx-currency"
              className="w-24 uppercase"
              maxLength={3}
              placeholder="USD"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="fx-rate">Rate</Label>
            <Input
              id="fx-rate"
              inputMode="decimal"
              className="w-36"
              placeholder="16000"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
          </div>
          <Button onClick={add} disabled={!canAdd || createRate.isPending}>
            Add rate
          </Button>
        </div>

        {createRate.isError && (
          <p className="text-sm text-destructive">{errText(createRate.error)}</p>
        )}

        {isPending && <p className="text-sm text-muted-foreground">Loading…</p>}

        {rates && rates.length === 0 && (
          <p className="text-sm text-muted-foreground">No rates entered yet.</p>
        )}

        {rates && rates.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rates.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{formatYearMonth(r.year_month)}</TableCell>
                  <TableCell>{r.currency}</TableCell>
                  <TableCell className="tabular-nums">{r.rate}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteRate.mutate(r.id)}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
