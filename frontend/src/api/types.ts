// Mirror of the backend JSON shapes. These will diverge if the backend
// changes them — any field tweaks here must be matched by an API change
// (we don't have shared codegen yet).

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

// ----- shared snapshot --------------------------------------------------

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

// ----- bank account -----------------------------------------------------

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

export type BankAccountListItem = {
  asset: Asset
  details: BankAccountDetails
  latest_snapshot: AssetSnapshot | null
}

// ----- property ---------------------------------------------------------

export type PropertyDetails = {
  asset_id: string
  property_type: 'house' | 'apartment' | 'land' | 'commercial'
  address: string | null
  acquisition_date: string | null
  acquisition_cost: string | null
  annual_amortization_rate: string | null
}

export type Property = {
  asset: Asset
  details: PropertyDetails
}

export type PropertyListItem = {
  asset: Asset
  details: PropertyDetails
  latest_snapshot: AssetSnapshot | null
}

// ----- vehicle ----------------------------------------------------------

export type VehicleDetails = {
  asset_id: string
  vehicle_type: 'car' | 'motorcycle' | 'other'
  make: string | null
  model: string | null
  year: number | null
  plate_number: string | null
  annual_depreciation_rate: string | null
}

export type Vehicle = {
  asset: Asset
  details: VehicleDetails
}

export type VehicleListItem = {
  asset: Asset
  details: VehicleDetails
  latest_snapshot: AssetSnapshot | null
}

// ----- liability --------------------------------------------------------

export type Liability = {
  id: string
  household_id: string
  display_name: string
  description: string | null
  subtype: 'personal' | 'institutional'
  ownership_type: 'sole' | 'joint'
  sole_owner_user_id: string | null
  native_currency: string
  status: 'active' | 'paid_off' | 'forgiven' | 'written_off'
  terminated_at: string | null
  termination_note: string | null
  counterparty_name: string
  principal: string | null
  interest_rate: string | null
  term_months: number | null
  start_date: string | null
  maturity_date: string | null
  created_by: string | null
  created_at: string
  updated_by: string | null
  updated_at: string
}

export type LiabilitySnapshot = {
  id: string
  liability_id: string
  year_month: string
  amount: string
  currency: string
  as_of_date: string | null
  description: string | null
  created_by: string | null
  created_at: string
  updated_by: string | null
  updated_at: string
}

export type LiabilityListItem = {
  liability: Liability
  latest_snapshot: LiabilitySnapshot | null
}

// ----- receivable -------------------------------------------------------

export type Receivable = {
  id: string
  household_id: string
  display_name: string
  description: string | null
  ownership_type: 'sole' | 'joint'
  sole_owner_user_id: string | null
  native_currency: string
  status: 'active' | 'collected' | 'written_off'
  terminated_at: string | null
  termination_note: string | null
  counterparty_name: string
  due_date: string | null
  created_by: string | null
  created_at: string
  updated_by: string | null
  updated_at: string
}

export type ReceivableSnapshot = {
  id: string
  receivable_id: string
  year_month: string
  amount: string
  currency: string
  as_of_date: string | null
  description: string | null
  created_by: string | null
  created_at: string
  updated_by: string | null
  updated_at: string
}

export type ReceivableListItem = {
  receivable: Receivable
  latest_snapshot: ReceivableSnapshot | null
}

// ----- investment ------------------------------------------------------

export type InvestmentSubtype =
  | 'stock'
  | 'mutual_fund'
  | 'gold'
  | 'bond'
  | 'time_deposit'

export type Investment = {
  id: string
  household_id: string
  display_name: string
  description: string | null
  subtype: InvestmentSubtype
  ownership_type: 'sole' | 'joint'
  sole_owner_user_id: string | null
  native_currency: string
  status: 'active' | 'sold' | 'matured'
  terminated_at: string | null
  termination_note: string | null
  created_by: string | null
  created_at: string
  updated_by: string | null
  updated_at: string
}

// One snapshot table per ADR-0022. quantity + price_per_unit are populated
// for stock/mutual_fund/gold; accrued_interest is populated for
// bond/time_deposit (M4.3b). The repo validates which combo is valid based
// on the parent investment's subtype.
export type InvestmentSnapshot = {
  id: string
  investment_id: string
  year_month: string
  amount: string
  currency: string
  quantity: string | null
  price_per_unit: string | null
  accrued_interest: string | null
  as_of_date: string | null
  description: string | null
  created_by: string | null
  created_at: string
  updated_by: string | null
  updated_at: string
}

export type StockDetails = {
  investment_id: string
  ticker: string
  exchange: string
}

export type Stock = {
  investment: Investment
  details: StockDetails
}

export type StockListItem = {
  investment: Investment
  details: StockDetails
  latest_snapshot: InvestmentSnapshot | null
}

export type MutualFundDetails = {
  investment_id: string
  fund_code: string
  fund_manager: string | null
}

export type MutualFund = {
  investment: Investment
  details: MutualFundDetails
}

export type MutualFundListItem = {
  investment: Investment
  details: MutualFundDetails
  latest_snapshot: InvestmentSnapshot | null
}

export type GoldDetails = {
  investment_id: string
  form: 'bar' | 'coin' | 'digital' | 'jewelry'
  purity: string
}

export type Gold = {
  investment: Investment
  details: GoldDetails
}

export type GoldListItem = {
  investment: Investment
  details: GoldDetails
  latest_snapshot: InvestmentSnapshot | null
}

export type BondType = 'govt_primary' | 'secondary_market'
export type CouponFrequency =
  | 'monthly'
  | 'quarterly'
  | 'semi_annual'
  | 'annual'

export type BondDetails = {
  investment_id: string
  bond_type: BondType
  series_code: string | null
  issuer: string
  face_value: string
  coupon_rate: string
  coupon_frequency: CouponFrequency
  maturity_date: string
}

export type Bond = {
  investment: Investment
  details: BondDetails
}

export type BondListItem = {
  investment: Investment
  details: BondDetails
  latest_snapshot: InvestmentSnapshot | null
}

export type RolloverPolicy =
  | 'auto_renew_principal'
  | 'auto_renew_with_interest'
  | 'no_rollover'

export type TimeDepositDetails = {
  investment_id: string
  bank_name: string
  principal: string
  interest_rate: string
  term_months: number
  placement_date: string
  maturity_date: string
  rollover_policy: RolloverPolicy
}

export type TimeDeposit = {
  investment: Investment
  details: TimeDepositDetails
}

export type TimeDepositListItem = {
  investment: Investment
  details: TimeDepositDetails
  latest_snapshot: InvestmentSnapshot | null
}
