import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
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

type InviteResp = {
  id: string
  invited_email: string
  expires_at: string
  accept_url: string
}

export function InviteForm() {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite someone to your household</CardTitle>
        <CardDescription>
          They'll receive an email with a sign-in link.
        </CardDescription>
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
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="someone@example.com"
            />
          </div>
          <Button type="submit" disabled={mutation.isPending || !email}>
            {mutation.isPending ? 'Sending…' : 'Send invitation'}
          </Button>
        </form>

        {mutation.error && (
          <p className="mt-3 text-sm text-destructive">
            {formatError(mutation.error)}
          </p>
        )}

        {result && (
          <div className="mt-4 p-3 rounded-md bg-muted text-sm space-y-2">
            <p className="font-medium">
              Invitation sent to {result.invited_email}
            </p>
            <p className="text-muted-foreground">
              Expires {new Date(result.expires_at).toLocaleString()}
            </p>
            <p className="text-muted-foreground break-all">
              Accept URL: <code className="text-xs">{result.accept_url}</code>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function formatError(err: unknown): string {
  if (err instanceof ApiError) {
    if (typeof err.body === 'string' && err.body) return err.body
    return `${err.status} ${err.message}`
  }
  if (err instanceof Error) return err.message
  return 'unknown error'
}
