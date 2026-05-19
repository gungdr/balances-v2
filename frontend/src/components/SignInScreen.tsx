import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export function SignInScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>balances</CardTitle>
          <CardDescription>
            Track your household net worth without itemising every
            transaction.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <a href="/api/auth/google/start">Sign in with Google</a>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
