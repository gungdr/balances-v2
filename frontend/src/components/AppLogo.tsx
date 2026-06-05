import { useTranslation } from 'react-i18next'
import wordmarkDark from '@/assets/brand/wordmark-dark.svg'
import wordmarkLight from '@/assets/brand/wordmark-light.svg'

// The Balances wordmark (outlined IBM Plex Sans + the snapshot-scale glyph).
// Brand assets and the regeneration recipe live in docs/brand/logo.md.
//
// The app is dark-only for now (index.html hardcodes <html class="dark">), so
// `theme` defaults to 'dark'. Both variants are wired; per-user theme switching
// — at which point the prop gets driven from a useTheme() hook — is issue #33.
type Theme = 'dark' | 'light'

export function AppLogo({ theme = 'dark' }: { theme?: Theme }) {
  const { t } = useTranslation('common')
  const src = theme === 'dark' ? wordmarkDark : wordmarkLight
  return <img src={src} alt={t('brand')} className="h-7 w-auto" />
}
