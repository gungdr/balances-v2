// Helpers for the `max` attribute on snapshot/transaction date and month
// inputs. A snapshot is by definition a past observation; a transaction
// records something that already happened. Pairing the input `max` with the
// backend's future-date validation (5 snapshot + 1 transaction create/update
// route each) keeps obvious nonsense (year 2099 typos) out of the form
// before it reaches the API.

// thisYearMonth returns the current local month as "YYYY-MM", suitable for
// <input type="month" max=…>. Local time matches what the user sees in the
// picker; the backend allows the corresponding UTC month, which is at most
// one calendar day off — close enough that the picker constraint never
// surprises the user.
export function thisYearMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// todayDate returns the current local date as "YYYY-MM-DD", suitable for
// <input type="date" max=…>.
export function todayDate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
