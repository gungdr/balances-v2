// Purity comes from the backend as a decimal fraction string (e.g. "0.9999",
// "0.7500"). Display as karat when it cleanly divides by 24/x, otherwise
// fall through to a percentage. Pure (0.9999+) is conventionally called
// 24K even though strictly 24K means 1.0000.

export function formatGoldPurity(purity: string): string {
  const n = Number(purity)
  if (Number.isNaN(n) || n <= 0 || n > 1) return purity
  if (n >= 0.999) return '24K (.999+)'
  const karat = n * 24
  const rounded = Math.round(karat)
  if (Math.abs(karat - rounded) < 0.01) {
    return `${rounded}K`
  }
  return `${(n * 100).toFixed(2)}%`
}
