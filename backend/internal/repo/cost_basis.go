package repo

import (
	"github.com/google/uuid"
	"github.com/shopspring/decimal"

	"github.com/kerti/balances-v2/backend/internal/db"
)

// costBasisFromLedger replays an investment's transaction ledger to the
// current "money still in" cost basis. It mirrors the frontend
// lib/costBasis.ts convention exactly so list-screen and detail-screen
// figures agree:
//
//   - buy:  cost += amount, qty += quantity
//   - sell: proportional avg-cost reduction — cost -= cost*sellQty/qty,
//     qty -= sellQty (sellQty clamped to qty held)
//   - fee:  cost += amount (capitalised into the all-in money put in)
//   - coupon / dividend / distribution: income, not a cost adjustment — ignored
//   - maturity: terminal — ignored (position lifecycle handles "this is over")
//
// txns MUST be ordered by transaction_date ascending; the batch query
// ListInvestmentTransactionsByInvestmentIDs already orders that way.
// Transactions with the null shape fields for their type are skipped
// defensively (the DB CHECK in migration 00010 enforces the shape).
func costBasisFromLedger(txns []db.InvestmentTransaction) decimal.Decimal {
	cost := decimal.Zero
	qty := decimal.Zero
	for _, tx := range txns {
		switch tx.TransactionType {
		case "buy":
			if tx.Amount != nil && tx.Quantity != nil {
				cost = cost.Add(*tx.Amount)
				qty = qty.Add(*tx.Quantity)
			}
		case "sell":
			if tx.Quantity == nil || !qty.IsPositive() {
				continue
			}
			sellQty := *tx.Quantity
			if sellQty.GreaterThan(qty) {
				sellQty = qty
			}
			// reduce cost proportionally: cost*sellQty/qty
			cost = cost.Sub(cost.Mul(sellQty).Div(qty))
			qty = qty.Sub(sellQty)
		case "fee":
			if tx.Amount != nil {
				cost = cost.Add(*tx.Amount)
			}
		}
	}
	return cost
}

// ledgerHasBuy reports whether the ledger holds at least one buy transaction.
// Bonds carry their cost as face_value when bought at primary issuance (no buy
// txn); a secondary-market bond has buys and replays like any other holding.
func ledgerHasBuy(txns []db.InvestmentTransaction) bool {
	for _, tx := range txns {
		if tx.TransactionType == "buy" {
			return true
		}
	}
	return false
}

// groupTransactionsByInvestment buckets a flat batch result by investment_id,
// preserving the query's ascending date order within each bucket.
func groupTransactionsByInvestment(txns []db.InvestmentTransaction) map[uuid.UUID][]db.InvestmentTransaction {
	byID := make(map[uuid.UUID][]db.InvestmentTransaction)
	for _, tx := range txns {
		byID[tx.InvestmentID] = append(byID[tx.InvestmentID], tx)
	}
	return byID
}
