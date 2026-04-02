# Calculation Logic

## Runway Calculation

**Formula:** `runway_months = (cash + AR - AP) / monthly_burn_rate`

**Implemented in:** `lib/calculations/runway.ts` — `calculateRunway()`
**API endpoint:** `POST /api/calculate/Runway`

---

### Inputs

| Parameter | Description |
|-----------|-------------|
| `cash` | Current cash on hand |
| `ar` | Accounts receivable — money owed to the business |
| `ap` | Accounts payable — money the business owes |
| `burn` | Monthly cash burn rate |

### Output

| Field | Description |
|-------|-------------|
| `runway_months` | How many months of runway remain (2 decimal places) |
| `calculation_breakdown` | Step-by-step breakdown including each input and the formula string |

---

### Why AR and AP are included

Cash alone understates available liquidity. AR is money already earned that will convert to cash shortly. AP is an obligation that will reduce cash shortly. Including both gives a more accurate picture of net available cash before dividing by burn rate.

---

### Edge Cases

- `burn` must be greater than zero — division by zero is rejected with an error
- `cash`, `ar`, and `ap` must be non-negative — negative values are rejected with an error
- A **negative** `runway_months` result is valid — it means liabilities already exceed available cash (business is already insolvent)

---

### Where results are stored

Runway results are saved to the `financial_snapshots` table in the `runway_months` column. See `docs/database-schema.md` for the full table definition.
