import { useTranslation } from 'react-i18next'

// Placeholder landing page for the Assets group. A combined assets dashboard
// (totals + breakdown across bank accounts, properties, vehicles) lands here
// later; for now it just orients the user toward the subtype lists in the menu.
export function AssetsHome() {
  const { t } = useTranslation('common')
  return (
    <div className="space-y-2" data-testid="assets-home">
      <h1 className="text-2xl font-semibold tracking-tight">
        {t('home.assets.title')}
      </h1>
      <p className="text-sm text-muted-foreground">{t('home.assets.body')}</p>
    </div>
  )
}
