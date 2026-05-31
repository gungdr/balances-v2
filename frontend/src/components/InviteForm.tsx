import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { api, ApiError } from '@/api/client'
import { formatDateTime } from '@/lib/format'

type InviteResp = {
  id: string
  invited_email: string
  expires_at: string
  accept_url: string
}

export function InviteForm() {
  const { t } = useTranslation(['settings', 'common'])
  const [email, setEmail] = useState('')
  const [result, setResult] = useState<InviteResp | null>(null)

  const mutation = useMutation({
    mutationFn: (emailToInvite: string) =>
      api<InviteResp>('/api/invitations', {
        method: 'POST',
        body: JSON.stringify({ email: emailToInvite }),
      }),
    onSuccess: (data) => {
      setResult(data)
      setEmail('')
    },
  })

  const unknownError = t('common:unknownError')

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('invite.title')}</CardTitle>
        <CardDescription>{t('invite.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            mutation.mutate(email)
          }}
          className="flex flex-col gap-3"
        >
          <div className="grid gap-2">
            <Label htmlFor="email">{t('invite.emailLabel')}</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('invite.emailPlaceholder')}
            />
          </div>
          <Button type="submit" disabled={mutation.isPending || !email}>
            {mutation.isPending ? t('common:sending') : t('invite.submit')}
          </Button>
        </form>

        {mutation.error && (
          <p className="mt-3 text-sm text-destructive">
            {formatError(mutation.error, unknownError)}
          </p>
        )}

        {result && (
          <div className="mt-4 p-3 rounded-md bg-muted text-sm space-y-2">
            <p className="font-medium">
              {t('invite.sentTo', { email: result.invited_email })}
            </p>
            <p className="text-muted-foreground">
              {t('invite.expires', { when: formatDateTime(result.expires_at) })}
            </p>
            <p className="text-muted-foreground break-all">
              {t('invite.acceptUrl')}{' '}
              <code className="text-xs">{result.accept_url}</code>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Server-error formatter. Keeps the server-supplied English body visible (the
// status-code → friendly-toast mapping lands with ADR-0027); only the generic
// fallback used when no body is present routes through i18n.
function formatError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (typeof err.body === 'string' && err.body) return err.body
    return `${err.status} ${err.message}`
  }
  if (err instanceof Error) return err.message
  return fallback
}
