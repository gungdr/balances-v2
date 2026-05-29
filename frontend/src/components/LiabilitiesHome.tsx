// Placeholder landing page for the Liabilities group. A combined liabilities
// dashboard (totals + personal/institutional breakdown) lands here later; for
// now it just orients the user toward the subtype lists in the menu.
export function LiabilitiesHome() {
  return (
    <div className="space-y-2" data-testid="liabilities-home">
      <h1 className="text-2xl font-semibold tracking-tight">Liabilities</h1>
      <p className="text-sm text-muted-foreground">
        An overview of your liabilities is coming here. For now, choose a
        category from the menu.
      </p>
    </div>
  )
}
