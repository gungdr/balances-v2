// preferredName resolves the compact label for a person — their self-set
// nickname when present, otherwise the (Google-sourced) display_name. The
// backend stores NULL rather than an empty nickname, but we guard against
// blank/whitespace anyway so a stray "" never renders as an empty label.
export function preferredName(person: {
  nickname?: string | null
  display_name: string
}): string {
  const nick = person.nickname?.trim()
  return nick ? nick : person.display_name
}
