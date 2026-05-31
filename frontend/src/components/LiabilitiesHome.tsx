import { useTranslation } from 'react-i18next'

// Placeholder landing page for the Liabilities group. A combined liabilities
// dashboard (totals + personal/institutional breakdown) lands here later; for
// now it just orients the user toward the subtype lists in the menu.
export function LiabilitiesHome() {
  const { t } = useTranslation('common')
  return (
    <div className="space-y-2" data-testid="liabilities-home">
      <h1 className="text-2xl font-semibold tracking-tight">
        {t('home.liabilities.title')}
      </h1>
      <p className="text-sm text-muted-foreground">
        {t('home.liabilities.body')}
      </p>
    </div>
  )
}
