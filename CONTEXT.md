# Balances v2

A personal-finance app that tracks **net worth** via end-of-month balance snapshots across all of a Household's positions. Investment instruments additionally keep a transaction ledger for cost-basis and income reporting; snapshot tables remain the source of truth for net worth. Transaction-by-transaction cash-flow tracking (Mint / YNAB style) is a deliberate non-feature.

## Language

### Top-level groups

**Asset**:
A position with positive value that is not an investment instrument — bank account, property, vehicle.
_Avoid_: holding, account (reserved for the auth user identity).

**Liability**:
A debt owed by the Household. Either **personal** (informal — owed to family, friends) or **institutional** (formal — mortgage, bank loan, outstanding credit-card balance).

**Receivable**:
Money owed *to* the Household by another party.

**Investment**:
A position in a tradable or fixed-income instrument. Subtypes below.

### Investment subtypes

**Stock**:
A position in an individual equity, tracked per ticker.

**MutualFund**:
A position in a single mutual fund, tracked per fund.

**Bond**:
A fixed-income instrument with face value, coupon rate, and maturity. Each Bond is either **GovtPrimary** (issued directly by government, typically held to maturity) or **SecondaryMarket** (purchased on the secondary market, may trade before maturity). Coupon frequency is one of `monthly | quarterly | semi_annual | annual` — Indonesian retail (ORI/SBR/SR/ST) pays monthly; tradeable govt FR series and most corporates pay semi-annually. For floating-rate instruments (SBR, ST) the stored coupon rate is the *current* rate; the user edits it on each reset.
_Avoid_: Obligation, Obligasi.

**Gold**:
A position in physical or paper gold, tracked by quantity (typically grams).

**TimeDeposit**:
A locked principal at a bank with a fixed interest rate and maturity date. *Indonesian: deposito.*
_Avoid_: Deposit (ambiguous with cash held in a bank account).

### Snapshots and transactions

**Snapshot**:
A monthly observation of a position's value. Asset / Liability / Receivable snapshots record an amount in a currency. Stock / MutualFund / Gold snapshots record quantity, market price per unit, and total value (= quantity × price). Bond / TimeDeposit snapshots record total value and accrued interest, where **total value is dirty** — it already includes the accrued interest. `accrued_interest` is carried as a breakdown column for income-tracking visibility, not as an additive component. Net-worth aggregation sums `total value` uniformly across all snapshot tables. All snapshot values are entered manually from statements; the system does not auto-compute interest or market value.

**Transaction**:
An event in an Investment instrument's ledger. Types: **Buy**, **Sell**, **Coupon**, **Dividend**, **Distribution**, **Fee**, **Maturity**.

- **Buy / Sell** — a trade; quantity changes hands, with a price per unit and a cash impact.
- **Coupon / Dividend / Distribution** — periodic income payments. The cash impact is *not* propagated to any bank-account snapshot; the user reads the resulting cash off their bank statement at the next month-end.
- **Fee** — a manager-imposed charge against the instrument. Records `fee_cash_amount`, `currency`, optional `fee_quantity_deducted` (for instruments where settlement is in units, e.g. gold or some mutual-fund classes), and optional `price_per_unit` used for the conversion. NAV-embedded fees (typical for mutual funds) are not recorded — they're already reflected in the price snapshot.
- **Maturity** — an instrument's terminal event (Bond redemption, TimeDeposit completion). The transaction carries `principal_amount`, `interest_amount`, and a disposition for each (`rolled_to_new` or `cash_out`), expressing whether the piece was reinvested into a new instrument or paid out. For TimeDeposit auto-rollovers the bank policies are: principal + interest both rolled (`auto_renew_with_interest`), principal rolled with interest paid out (`auto_renew_principal`), or both paid out (`no_rollover`). `cash_out` portions do not auto-update bank balances (ADR-0003) — they appear in the next bank statement. When principal or interest is rolled, a fresh TimeDeposit Position is created with its `principal` set to the rolled-over amount.

### Position lifecycle

Every Position carries a **status** (default `active`) and an optional `terminated_at` date marking when it left the Household's portfolio, plus an optional free-text `termination_note`. Status values vary per group:

- **Asset**: `active`, `closed` (bank account), `sold` (vehicle, property), `disposed`
- **Liability**: `active`, `paid_off`, `forgiven`, `written_off`
- **Receivable**: `active`, `collected`, `written_off`
- **Investment**: `active`, `sold` (fully exited), `matured` (Bond, TimeDeposit)

A non-active Position contributes to net worth only for months ending on or before `terminated_at`. Its historical Snapshots and Transactions remain intact and queryable; only its forward contribution is suppressed. Snapshot carry-forward does not extend a Position past its `terminated_at`.

Reactivation (a closed bank account reopened, a sold property bought back) creates a new Position row rather than flipping `terminated_at` back to NULL — keeping termination periods unambiguous in the historical record. This applies uniformly, including to TimeDeposit auto-rollovers: each rollover creates a fresh TimeDeposit Position with a new `placement_date`.

### Identity and ownership

**Household**:
The unit of access and aggregation — the people sharing economic life and tracking net worth together. Every Position, Snapshot, Transaction, and Income event belongs to exactly one Household. A Household carries a `display_name` and a `reporting_currency` (the currency in which net-worth aggregates are computed).
_Avoid_: Family, Team, Tenant.

**User**:
An individual member of a Household. A User belongs to exactly one Household (v1; multi-household membership is deferred). All Users in a Household have full read/write access to all data in that Household. Users carry a `display_name`, `email`, `locale` (UI language, default `id-ID`), and `time_zone` (for "current month" interpretation, default `Asia/Jakarta`).

**Ownership** (Position attribute):
Each Position carries an Ownership mode:

- **SoleOwner** — attributed to a specific User for net-worth-breakdown purposes (e.g., "her brokerage account").
- **Joint** — owned by the Household as a whole, with no per-user attribution (e.g., a joint bank account).

Ownership reflects the Household's *intent* for how the Position should be attributed in reports — not the legal deed or account-holder name. A property whose deed lists one spouse may still be tracked as Joint if the Household considers it shared.

### Currency and net worth

**Native currency**:
The currency a position is denominated in. Stored on every monetary value.

**Reporting currency**:
The Household's chosen currency for net-worth aggregation (default IDR). Non-native amounts are converted using a monthly FX rate, entered manually in v1.

**Net Worth**:
For a given Household and month, `Σ(Asset, Receivable, Investment snapshots) − Σ(Liability snapshots)`, all converted to the Household's reporting currency. Net worth can be reported per-Household (the total) or broken down by User via each Position's Ownership — SoleOwner Positions contribute fully to their User's column; Joint Positions are split equally across the Household's Users (or shown in a separate "Joint" column).

### Income and cashflow

**Income**:
A flow event recording earned cash entering the Household from outside — salary, business income, rental income, gifts, refunds, payouts. Distinct from Investment cash events (Coupon / Dividend / Distribution / Maturity), which are returns from positions the Household already holds.

Each Income event has: `date`, `amount`, `currency`, `category` (closed enum), `description` (free text, optional), and `ownership` (`SoleOwner` or `Joint`). Categories: **Salary**, **BusinessIncome**, **RentalIncome**, **Gift**, **TaxRefund**, **InsurancePayout**, **Other**. The `description` field provides sub-categorisation within a category — e.g., base monthly pay and travel per-diem are both `Salary`, distinguished by description in drill-downs but rolled up at the category level for top-line reporting.

Like Investment cash events (ADR-0003), Income events do **not** auto-update bank-account snapshots. The cash arrives via the next bank statement; the Income event exists to support the income-statement view and cashflow approximation, not to maintain net worth (which the snapshot tables already capture).

**Comprehensive income identity**:
`ΔNet Worth = Earned Income + Investment Return − Living Expenses`. Earned Income is tracked explicitly. Investment Return is derived per-instrument per-month as `ΔSnapshot_value + cash_paid_out_to_bank − cash_paid_in_from_bank` (covering unrealised price movement, realised gains from Sells, and yield from Coupons / Dividends / Distributions / Maturities; net of Fees). Living Expenses are derived as the residual — itemised expense tracking remains a non-feature per ADR-0001.

## Relationships

- A **Household** has 1..N **Users**.
- A **User** belongs to exactly one **Household**.
- Every **Asset / Liability / Receivable / Investment** belongs to exactly one **Household** and carries an **Ownership** mode.
- An **Asset / Liability / Receivable / Investment** has zero or more **Snapshots** — typically one per month.
- An **Investment** instrument additionally has zero or more **Transactions** — independent of its Snapshots.
- A **TimeDeposit** auto-renewal terminates the old instrument and creates a new one; the chain is implicit, not modelled as a parent-child link.
- Every **Income** event belongs to exactly one **Household** and carries an **Ownership** mode. Income events stand alone — they don't link to any Position or Snapshot.

## Example dialogue

> **Q:** "I bought 100 shares of TLKM at IDR 3,500 each."
> **A:** Log a Buy Transaction on the TLKM Stock instrument for 100 shares at IDR 3,500. At the next month-end, record a Snapshot capturing the current quantity, the month-end price, and the resulting market value.

> **Q:** "A government bond paid me an IDR 50,000 coupon."
> **A:** Log a Coupon Transaction on the Bond instrument for IDR 50,000. Don't update any bank balance — the cash will appear in the bank account's next month-end Snapshot when you read it off the statement.

> **Q:** "My time deposit auto-renewed with the interest rolled into principal."
> **A:** Log a Maturity Transaction on the old TimeDeposit. Create a new TimeDeposit instrument with the rolled-up principal as its starting balance and the new term's maturity date.

> **Q:** "Our house is registered in my name only — should I record it as SoleOwner?"
> **A:** Use whatever the Household *intends* for net-worth attribution. If both spouses consider the home shared, mark it Joint regardless of the deed. Ownership in this app captures intent, not legal title.

> **Q:** "I get a base salary each month plus per-diem when I travel for work — both from the same employer."
> **A:** Two separate Income events, both with category `Salary`, distinguished by description ("Base salary", "Per diem — Jakarta trip"). They roll up under the Salary line in the income statement; descriptions surface in drill-downs.

> **Q:** "How do I know what I spent last month if I don't track expenses?"
> **A:** Living expenses are derived: `Earned Income + Investment Return − ΔNet Worth`. The app shows one residual number — itemised spending categories are not tracked.

## Flagged ambiguities

- **"Account"** was used early to mean both *bank account* (an Asset) and *user account* (the auth identity). Resolved: use "bank account" or "Asset" for the financial concept; "User" for the auth identity.
- **"Obligation"** was used for what English finance calls a **Bond**. Resolved: Bond is canonical; Obligation / Obligasi are aliases to avoid in code and UI.
- **"Deposit"** was ambiguous between cash held in a bank account and a fixed-term locked product. Resolved: TimeDeposit is canonical for the locked product; cash savings live under Asset → bank account.
- **"Holding" / "Position"** as an umbrella concept across all four groups was considered and rejected — the four groups are treated independently because their data shapes and lifecycles differ.
- **"Ownership"** in this app means the Household's *intent* for attributing a Position in net-worth breakdowns, not the legal deed or registered account holder. A property whose deed lists one spouse may still be tracked as Joint.
