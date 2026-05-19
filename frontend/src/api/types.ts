// Mirror of the backend JSON shapes for the M3 vertical slice. These will
// diverge if the backend changes them, so any field tweaks here must be
// matched by an API change (we don't have shared codegen yet).

export type Asset = {
  id: string
  household_id: string
  display_name: string
  description: string | null
  subtype: 'bank_account' | 'property' | 'vehicle'
  ownership_type: 'sole' | 'joint'
  sole_owner_user_id: string | null
  native_currency: string
  status: 'active' | 'closed' | 'sold' | 'disposed'
  terminated_at: string | null
  termination_note: string | null
  created_by: string | null
  created_at: string
  updated_by: string | null
  updated_at: string
}

export type BankAccountDetails = {
  asset_id: string
  bank_name: string
  account_number: string
  account_type: 'savings' | 'current' | 'other'
}

export type BankAccount = {
  asset: Asset
  details: BankAccountDetails
}

export type AssetSnapshot = {
  id: string
  asset_id: string
  year_month: string // ISO datetime, day always = 01
  amount: string // decimal as string to preserve precision
  currency: string
  as_of_date: string | null
  description: string | null
  created_by: string | null
  created_at: string
  updated_by: string | null
  updated_at: string
}

export type BankAccountListItem = {
  asset: Asset
  details: BankAccountDetails
  latest_snapshot: AssetSnapshot | null
}
