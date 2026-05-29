import { Link, useLocation } from 'react-router'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { routes } from '@/lib/routes'

type Leaf = { label: string; to: string }
// A top-level destination. With `children` it's a group: the button links to
// the group home and the subtype lists render beneath it (always expanded — few
// enough items that hiding them behind a collapse would only add a click).
type Section = { label: string; to: string; children?: Leaf[] }

const NAV: Section[] = [
  { label: 'Dashboard', to: routes.dashboard },
  {
    label: 'Assets',
    to: routes.assets,
    children: [
      { label: 'Bank Accounts', to: routes.bankAccounts },
      { label: 'Properties', to: routes.properties },
      { label: 'Vehicles', to: routes.vehicles },
    ],
  },
  {
    label: 'Liabilities',
    to: routes.liabilities,
    children: [
      { label: 'Personal', to: routes.liabilitiesPersonal },
      { label: 'Institutional', to: routes.liabilitiesInstitutional },
    ],
  },
  { label: 'Receivables', to: routes.receivables },
  {
    label: 'Investments',
    to: routes.investments,
    children: [
      { label: 'Stocks', to: routes.stocks },
      { label: 'Mutual Funds', to: routes.mutualFunds },
      { label: 'Bonds', to: routes.bonds },
      { label: 'Time Deposits', to: routes.timeDeposits },
      { label: 'Gold', to: routes.gold },
    ],
  },
  { label: 'Income', to: routes.income },
  { label: 'Settings', to: routes.settings },
]

// Smaller type than shadcn's text-sm default; the active item uses the accent
// fill (set explicitly so the active style is legible here rather than inherited
// from the cva). Sub-buttons additionally take size="sm" — their font size is a
// data-[size]-scoped rule that out-specifies a plain text-xs, so the prop is the
// only way to match the main items' size.
const navItemClass =
  'text-xs data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground'

export function AppSidebar() {
  const { pathname } = useLocation()
  const { setOpenMobile } = useSidebar()
  // Close the mobile drawer after a navigation; a no-op on desktop.
  const close = () => setOpenMobile(false)

  // A leaf/childless destination stays highlighted while you're on it or any
  // detail page beneath it (e.g. Bank Accounts active on /assets/bank-accounts
  // and /assets/bank-accounts/:id). The dashboard's `/` is exact-only — the
  // prefix test below reduces to an equality check for it.
  const leafActive = (to: string) =>
    pathname === to || pathname.startsWith(to + '/')

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="px-2 py-1 text-base font-semibold">balances</div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((section) => (
                <SidebarMenuItem key={section.to}>
                  <SidebarMenuButton
                    asChild
                    className={navItemClass}
                    // A group's own button highlights only on its exact home
                    // path; its children own their own active state.
                    isActive={
                      section.children
                        ? pathname === section.to
                        : leafActive(section.to)
                    }
                  >
                    <Link to={section.to} onClick={close}>
                      {section.label}
                    </Link>
                  </SidebarMenuButton>
                  {section.children && (
                    <SidebarMenuSub>
                      {section.children.map((child) => (
                        <SidebarMenuSubItem key={child.to}>
                          <SidebarMenuSubButton
                            asChild
                            size="sm"
                            className={navItemClass}
                            isActive={leafActive(child.to)}
                          >
                            <Link to={child.to} onClick={close}>
                              {child.label}
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
