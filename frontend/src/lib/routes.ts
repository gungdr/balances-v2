// Centralised route paths + builders. The router (App.tsx), the sidebar, every
// list row's onSelect, and every detail's back-link reference these instead of
// literal path strings — so a renamed path is a single edit and a mistyped link
// is a TypeScript error rather than a runtime 404. This is the deliberate
// stand-in for the compile-time link checking a type-safe router would give;
// see ADR-0025 for why we chose React Router + this convention over TanStack
// Router.

export const routes = {
  dashboard: '/',

  // Assets — home + three subtype lists, each with a detail under it.
  assets: '/assets',
  bankAccounts: '/assets/bank-accounts',
  bankAccount: (id: string) => `/assets/bank-accounts/${id}`,
  properties: '/assets/properties',
  property: (id: string) => `/assets/properties/${id}`,
  vehicles: '/assets/vehicles',
  vehicle: (id: string) => `/assets/vehicles/${id}`,

  // Liabilities — home + two subtype lists. Detail nests under the subtype
  // (`/liabilities/personal/:id`) so the dynamic `:id` never overlaps the
  // literal `personal`/`institutional` segments. ADR-0025.
  liabilities: '/liabilities',
  liabilitiesPersonal: '/liabilities/personal',
  liabilitiesInstitutional: '/liabilities/institutional',
  liability: (subtype: 'personal' | 'institutional', id: string) =>
    `/liabilities/${subtype}/${id}`,

  // Receivables — flat group: the list is the root path, no home page.
  receivables: '/receivables',
  receivable: (id: string) => `/receivables/${id}`,

  // Investments — home + five subtype lists, each with a detail under it.
  investments: '/investments',
  stocks: '/investments/stocks',
  stock: (id: string) => `/investments/stocks/${id}`,
  mutualFunds: '/investments/mutual-funds',
  mutualFund: (id: string) => `/investments/mutual-funds/${id}`,
  bonds: '/investments/bonds',
  bond: (id: string) => `/investments/bonds/${id}`,
  timeDeposits: '/investments/time-deposits',
  timeDeposit: (id: string) => `/investments/time-deposits/${id}`,
  gold: '/investments/gold',
  goldItem: (id: string) => `/investments/gold/${id}`,

  // Income — flow event, not a position group: a flat list at its own path.
  income: '/income',

  settings: '/settings',
} as const
