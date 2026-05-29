// Placeholder landing page for the Investments group. A combined investments
// dashboard (totals + breakdown across stocks, mutual funds, bonds, time
// deposits, gold) lands here later; for now it just orients the user toward the
// subtype lists in the menu.
export function InvestmentsHome() {
  return (
    <div className="space-y-2" data-testid="investments-home">
      <h1 className="text-2xl font-semibold tracking-tight">Investments</h1>
      <p className="text-sm text-muted-foreground">
        An overview of your investments is coming here. For now, choose a
        category from the menu.
      </p>
    </div>
  )
}
