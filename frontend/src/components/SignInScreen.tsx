import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export function SignInScreen() {
  const { t } = useTranslation('common')
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t('brand')}</CardTitle>
          <CardDescription>{t('signIn.tagline')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <a href="/api/auth/google/start">{t('signIn.withGoogle')}</a>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
