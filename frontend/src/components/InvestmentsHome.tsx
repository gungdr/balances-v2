import { useTranslation } from 'react-i18next'

// Placeholder landing page for the Investments group. A combined investments
// dashboard (totals + breakdown across stocks, mutual funds, bonds, time
// deposits, gold) lands here later; for now it just orients the user toward the
// subtype lists in the menu.
export function InvestmentsHome() {
  const { t } = useTranslation('common')
  return (
    <div className="space-y-2" data-testid="investments-home">
      <h1 className="text-2xl font-semibold tracking-tight">
        {t('home.investments.title')}
      </h1>
      <p className="text-sm text-muted-foreground">
        {t('home.investments.body')}
      </p>
    </div>
  )
}
