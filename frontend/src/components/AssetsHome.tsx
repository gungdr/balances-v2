// Placeholder landing page for the Assets group. A combined assets dashboard
// (totals + breakdown across bank accounts, properties, vehicles) lands here
// later; for now it just orients the user toward the subtype lists in the menu.
export function AssetsHome() {
  return (
    <div className="space-y-2" data-testid="assets-home">
      <h1 className="text-2xl font-semibold tracking-tight">Assets</h1>
      <p className="text-sm text-muted-foreground">
        An overview of your assets is coming here. For now, choose a category
        from the menu.
      </p>
    </div>
  )
}
