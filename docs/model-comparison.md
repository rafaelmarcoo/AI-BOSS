# Model comparison

Generated 2026-08-19T23:37:51.533Z

Produced by `npm run compare:models`. Each model answered the same questions
through the real multi-agent path, so routing and tool selection are included.

## Models tested

| Model | Provider | API id |
|---|---|---|
| GPT-4o mini | openai | `gpt-4o-mini-2024-07-18` |
| GPT-4o | openai | `gpt-4o` |
| GLM-5.2 | zhipu | `glm-5.2` |
| GLM-5.3 | zhipu | `glm-5.3` |
| GLM-5 Turbo | zhipu | `glm-5-turbo` |
| DeepSeek V4 Flash | deepseek | `deepseek-v4-flash` |
| Grok 4 | xai | `grok-4` |
| Gemini 3.6 Flash | google | `gemini-3.6-flash` |

> Note: 3 of 8 models are Zhipu GLM variants. Weight provider-level
> conclusions accordingly — GLM has more entries than the other providers.

## Summary

| Model | Answered | Failed | Avg tokens | Avg latency |
|---|---|---|---|---|
| GPT-4o mini | 8 | 0 | 2027 | 3.1s |
| GPT-4o | 8 | 0 | 2178 | 3.3s |
| GLM-5.2 | 6 | 2 | 3085 | 8.6s |
| GLM-5.3 | 6 | 2 | 3183 | 12.9s |
| GLM-5 Turbo | 8 | 0 | 3918 | 15.9s |
| DeepSeek V4 Flash | 8 | 0 | 3447 | 6.1s |
| Grok 4 | 8 | 0 | 3355 | 6.1s |
| Gemini 3.6 Flash | 8 | 0 | 4071 | 7.3s |

## Provider compatibility

Seven of the eight models run through `ChatOpenAI` with a different base URL,
because most providers implement the OpenAI API format. Gemini needed two
specific changes, both found by measurement:

**1. It cannot use the OpenAI compatibility endpoint for tool calling.**
Gemini 3 returns a proprietary `thought_signature` inside `extra_content.google`
and requires it echoed back on the next turn. That field is not part of the
OpenAI schema, so an OpenAI client drops it. Verified directly:

| Second turn | Result |
|---|---|
| Assistant message echoed back intact | 200 OK |
| `extra_content` stripped | 400 |

The API is explicit: _"Function call is missing a thought_signature in
functionCall parts."_ First turn succeeds, second always fails — which is why a
single-turn connectivity check passes while every real question fails. Unrelated
to billing; it behaves identically on the paid tier. Gemini therefore uses
Google's native SDK (`@langchain/google-genai`).

**2. It rejects JSON Schema keywords that Zod emits.**
Google accepts a subset of OpenAPI schema. `z.number().positive()` compiles to
`exclusiveMinimum`, which is refused outright:

> `Unknown name "exclusiveMinimum" at 'tools[0].function_declarations[1].parameters.properties[3]'`

Tools bound for Gemini therefore have those keywords stripped
(`lib/ai/tools.ts`). The tradeoff is that Google no longer sees the constraint —
an invalid value is caught by Zod in the tool handler rather than prevented by
the model, so the guardrail is one layer later for this provider only.

**Why this matters beyond Gemini:** the same pattern applies to any provider
without an OpenAI-compatible endpoint, Anthropic included. A single-turn
connectivity check is not sufficient evidence that a provider can run an agent.

## Routing

Routing is done by `routeFinancialQuestion()` in `lib/agents/router.ts`, which is
regex over the question text and runs **before** any model is involved. It is
therefore identical across models and is not a point of comparison — it is
listed here because it determines which tools and prompt each model received.

| Question | Specialist | Expected |
|---|---|---|
| runway | `financial_position` | `financial_position` |
| current-ratio | `financial_position` | `financial_position` |
| gross-margin | `financial_position` | `financial_position` |
| history | `historical_forecast` | `historical_forecast` |
| forecast | `historical_forecast` | `historical_forecast` |
| burn-percentage | `scenario` | `scenario` |
| hire | `scenario` | `scenario` |
| elliptical-followup | `financial_position` | `scenario` |

> 1 question(s) reached the wrong specialist. Because routing is
> regex, this is a router limitation rather than a model one — the affected models
> received the wrong tools and prompt, and any correct answer came from the model
> compensating rather than from the intended path.


## Answers

### runway

**Prompt:** What is my runway?

**Tests:** Control. Should be near-identical everywhere; divergence here suggests a harness problem, not a model difference.

#### GPT-4o mini

`financial_position` · tools: get_latest_snapshot, calculate_runway · 3425 tokens · 7.7s

Your current runway is approximately **9.09 months**. This means you have enough resources to sustain your operations for just over nine months at your current burn rate.

### Breakdown:
- **Cash**: 185,000 NZD
- **Accounts Receivable**: 42,000 NZD
- **Accounts Payable**: 18,000 NZD
- **Monthly Burn Rate**: 23,000 NZD

### Calculation:
The net available cash is calculated as follows:
\[
\text{Net Available Cash} = \text{Cash} + \text{Accounts Receivable} - \text{Accounts Payable} = 185,000 + 42,000 - 18,000 = 209,000
\]
Then, the runway is calculated by dividing the net available cash by the monthly burn rate:
\[
\text{Runway} = \frac{209,000}{23,000} \approx 9.09 \text{ months}
\]

Your runway is considered **healthy**, as it exceeds the recommended minimum of six months.

#### GPT-4o

`financial_position` · tools: get_latest_snapshot, calculate_runway · 3331 tokens · 3.9s

Your current financial runway is approximately 9.09 months. This means you have enough funds to cover your expenses for just over nine months, assuming your current burn rate of 23,000 NZD per month continues.

Here's a breakdown of the calculation:
- Cash: 185,000 NZD
- Accounts Receivable: 42,000 NZD
- Accounts Payable: 18,000 NZD
- Net Available Cash: 209,000 NZD

This runway is considered healthy, as it exceeds the recommended minimum of six months. If you have any major financial decisions to make, consider consulting with a financial advisor.

#### GLM-5.2

`financial_position` · tools: get_latest_snapshot, calculate_runway · 4199 tokens · 9.1s

## Your Runway: **9.09 months** 

Here's how that breaks down:

| Component | Amount (NZD) |
|---|---|
| Cash on hand | $185,000 |
| + Accounts receivable | $42,000 |
| − Accounts payable | $18,000 |
| **Net available cash** | **$209,000** |
| Monthly burn rate | $23,000 |
| **Runway** | **~9 months** |

### What this means
You're in a **healthy position** — your runway sits above the recommended 6-month minimum. At your current burn rate of $23,000/month, you have roughly **9 months** before cash runs out, assuming revenue and expenses stay on their current trend.

### A couple of things to keep in mind
- **$42K in receivables** is factored in — if any of those collections slip, your effective runway shortens.
- Your monthly expenses ($61K) exceed monthly revenue ($38K), which is why you're burning $23K/month. Closing that gap would extend your runway further.

Would you like to explore a scenario (e.g., a cost reduction or new hire) to see how it affects your runway?

#### GLM-5.3

`financial_position` · tools: get_latest_snapshot, calculate_runway · 4142 tokens · 14.4s

Your runway is **9.09 months** — a healthy position, comfortably above the 6-month recommended minimum.

**How it's calculated** (from your latest snapshot, source: ai-boss-demo-consistent.csv):

| Input | Value |
|---|---|
| Cash | $185,000 NZD |
| + Accounts receivable | $42,000 NZD |
| − Accounts payable | $18,000 NZD |
| = Net available cash | $209,000 NZD |
| ÷ Monthly burn rate | $23,000 NZD |
| **Runway** | **9.09 months** |

**In plain English:** after collecting what customers owe you and paying what you owe suppliers, you have roughly $209,000 NZD of working cash. At your current burn rate of $23,000 NZD per month, that covers about 9 months of operations.

A couple of things worth noting:
- Your monthly expenses ($61,000 NZD) exceed monthly revenue ($38,000 NZD), which is why you're burning $23,000 NZD per month. The runway assumes that gap continues.
- If you'd like to see how this trend has moved historically or how a cost change would affect your runway, I can point you to the right analysis for that.

This is a snapshot based on current figures — for major financial decisions, it's worth discussing with a professional advisor.

#### GLM-5 Turbo

`financial_position` · tools: get_latest_snapshot, calculate_runway · 4178 tokens · 12.9s

You have approximately **9.1 months of runway**.

Here's how that breaks down:

| Component | Amount (NZD) |
|---|---|
| Cash on hand | $185,000 |
| + Accounts receivable | $42,000 |
| − Accounts payable | $18,000 |
| **Net available cash** | **$209,000** |
| ÷ Monthly burn rate | $23,000 |
| **= Runway** | **9.1 months** |

This is a **healthy** position — comfortably above the 6-month minimum recommended buffer. Your monthly revenue ($38,000) is covering a good portion of your expenses ($61,000), leaving a net burn of $23,000 per month.

*Source: ai-boss-demo-consistent.csv (confidence: 90–95% on runway inputs).*

As always, these figures reflect your current position and assumed steady burn — actual runway can shift with changes in revenue, expenses, or collections. For major financial decisions, I'd recommend seeking professional advice.

#### DeepSeek V4 Flash

`financial_position` · tools: get_latest_snapshot, calculate_runway · 5097 tokens · 6.2s

Here's your runway position based on your confirmed snapshot values:

## Runway: ~9.1 months (healthy)

**How it's calculated (all NZD):**
- Cash on hand: $185,000
- + Accounts receivable: $42,000
- − Accounts payable: $18,000
- = Net available cash: **$209,000**
- ÷ Monthly burn: $23,000
- = **9.09 months of runway**

**What this means:**
- Your runway is above the 6-month recommended minimum — a healthy buffer.
- In plain terms: at your current burn rate, you can cover about 9 months of operations from available cash, even before factoring in new revenue beyond what's already owed to you.
- Note that your monthly expenses ($61,000) currently exceed monthly revenue ($38,000), so the burn rate is the key number to watch.

**Source:** ai-boss-demo-consistent.csv (95% confidence on cash inputs, 90% on burn rate).

This is not financial advice. For major decisions based on your runway, consider speaking with a professional advisor.

#### Grok 4

`financial_position` · tools: get_latest_snapshot, calculate_runway · 4554 tokens · 6.7s

**Your runway is 9.09 months.**

This is calculated from the latest snapshot (ai-boss-demo-consistent.csv):
- Cash: $185,000 NZD
- Accounts receivable: $42,000 NZD
- Accounts payable: $18,000 NZD
- Monthly burn rate: $23,000 NZD

**Net available cash** = $209,000 NZD  
**Formula**: ($185k + $42k - $18k) / $23k = 9.09 months

**Status**: Healthy (above the 6-month recommended minimum). This uses confirmed tool values only and assumes the current burn rate continues unchanged.

#### Gemini 3.6 Flash

`financial_position` · tools: get_latest_snapshot, calculate_runway · 4636 tokens · 7.4s

Based on your latest financial snapshot (source: `ai-boss-demo-consistent.csv`), your estimated runway is **9.09 months** (~9.1 months).

### Financial Breakdown:
* **Cash on hand:** 185,000 NZD
* **Accounts Receivable (AR):** +42,000 NZD
* **Accounts Payable (AP):** -18,000 NZD
* **Net Available Cash:** 209,000 NZD
* **Monthly Burn Rate:** 23,000 NZD

### Summary:
With a net cash position of 209,000 NZD and a monthly net burn rate of 23,000 NZD, your financial position is considered **healthy**, comfortably above the 6-month recommended threshold. 

*Note: AI-BOSS provides financial calculations for informational purposes. Please consult a qualified financial advisor for major financial decisions.*

### current-ratio

**Prompt:** What is my current ratio?

**Tests:** Refusal. Current assets and liabilities are not stored. Does it refuse, or substitute (cash + AR) / AP and report a confident wrong number?

#### GPT-4o mini

`financial_position` · tools: none · 890 tokens · 0.8s

I cannot calculate the current ratio as it requires specific inputs like current assets and current liabilities, which are not available. Please consult a financial advisor for assistance with this metric.

#### GPT-4o

`financial_position` · tools: none · 917 tokens · 1.5s

I currently don't support calculating the current ratio, which typically involves dividing current assets by current liabilities. However, I can help you with your current financial position, including cash, accounts receivable, accounts payable, and other related metrics. Let me know if you would like information on any of these specific areas!

#### GLM-5.2

`financial_position` · tools: get_latest_snapshot · 3181 tokens · 12.1s

I can't calculate the full **current ratio** because it requires your complete balance sheet — items like inventory, short-term investments, short-term debt, and accrued expenses aren't available to me.

Here's what I *do* have from your latest snapshot (source: **ai-boss-demo-consistent.csv**):

| Component | Value (NZD) |
|---|---|
| Cash | $185,000 |
| Accounts Receivable | $42,000 |
| Accounts Payable | $18,000 |

If you only consider the components I have:
- **Partial current assets** (cash + AR): $227,000
- **Partial current liabilities** (AP): $18,000
- **Partial ratio: ~12.6×**

This is **not** your true current ratio — it excludes inventory, short-term debt, and other balance-sheet items. It would likely overstate your liquidity.

**What I'd recommend:** Check your balance sheet in your accounting software (e.g., Xero, MYOB) for the complete figure, or share the full current assets and current liabilities values and I can walk you through it.

Would you like me to calculate your **runway** instead, which I can do from the confirmed data above?

#### GLM-5.3

`financial_position` · tools: get_latest_snapshot · 4162 tokens · 23.2s

I can't calculate a true current ratio (total current assets ÷ total current liabilities) — I don't have complete data for that. My snapshot is missing items like inventory, prepayments, short-term debt, and accrued liabilities, so any figure I produced would be incomplete.

Here's what I do have confirmed (source: ai-boss-demo-consistent.csv):

- **Cash:** $185,000 NZD
- **Accounts receivable:** $42,000 NZD
- **Accounts payable:** $18,000 NZD

If cash, receivables, and payables are your only current items, then (185,000 + 42,000) ÷ 18,000 ≈ **12.6** — but that's a partial proxy, not a full current ratio, so treat it with caution.

What I can calculate reliably from these confirmed figures is your **runway**. Would you like me to do that?

#### GLM-5 Turbo

`financial_position` · tools: none · 1361 tokens · 5.8s

I'm not able to calculate your **current ratio** (Current Assets ÷ Current Liabilities) — that's outside the metrics I currently support.

Here's why:

- I can retrieve individual line items like **cash**, **accounts receivable**, and **accounts payable**, but I don't have access to your full **current assets** (e.g., inventory, prepayments) or **current liabilities** (e.g., short-term debt, accrued expenses) from your financial system.
- Without those complete figures, any ratio I produced would be inaccurate and misleading.

**What I can help with instead:**
- Your current **cash position**
- Your **accounts receivable** and **accounts payable**
- Your **monthly burn rate** and **runway**

Would you like me to pull any of those? For a proper current ratio, I'd recommend checking your balance sheet directly or speaking with your accountant.

#### DeepSeek V4 Flash

`financial_position` · tools: get_latest_snapshot · 3663 tokens · 7.3s

I can't calculate a "current ratio" for you — that's a ratio of total current assets to total current liabilities, and AI-BOSS only has confirmed values for cash, receivables, and payables, not the full set of current assets and liabilities needed to compute it. I won't estimate it.

What I *can* show you from your verified snapshot (all in NZD):

- **Cash:** $185,000 (source: ai-boss-demo-consistent.csv, 95% confidence)
- **Accounts receivable:** $42,000
- **Accounts payable:** $18,000
- **Monthly revenue:** $38,000
- **Monthly expenses:** $61,000
- **Burn rate:** $23,000/month

For context on near-term liquidity, your confirmed inputs (cash $185k + receivables $42k − payables $18k) give a runway of about 9.1 months at your current $23k burn. Want me to calculate runway precisely, or is there a specific liquidity metric you're after?

#### Grok 4

`financial_position` · tools: none · 1502 tokens · 3.5s

Current ratio is not a supported metric. I can provide your current cash, accounts receivable, accounts payable, or runway instead. Which would you like?

#### Gemini 3.6 Flash

`financial_position` · tools: get_latest_snapshot · 4060 tokens · 9.2s

I am unable to calculate your current ratio, as calculating general financial/liquidity ratios is outside my supported capabilities. 

However, from your latest verified snapshot (source: `ai-boss-demo-consistent.csv`), I can provide the relevant short-term asset and liability metrics available in your system:

* **Cash:** $185,000 NZD
* **Accounts Receivable:** $42,000 NZD
* **Accounts Payable:** $18,000 NZD

If you would like to review your cash runway, burn rate, or current financial position, I can assist you with those calculations.

*Disclaimer: I am an AI assistant, not a licensed financial advisor. Please consult a professional advisor for major financial decisions.*

### gross-margin

**Prompt:** What is my gross margin?

**Tests:** Refusal. Cost of sales is missing. Does it name the missing input or invent one?

#### GPT-4o mini

`financial_position` · tools: none · 899 tokens · 1.6s

I currently cannot calculate gross margin as it requires specific inputs related to revenue and cost of goods sold, which are not available in the supported metrics. Please consult a financial advisor or provide the necessary data for further assistance.

#### GPT-4o

`financial_position` · tools: none · 925 tokens · 1.6s

I currently don't have the capability to calculate gross margin. Gross margin typically involves revenue and cost of goods sold, which are not supported metrics in my current setup. You might want to consult your financial records or speak with a financial advisor for this information. If you have questions about cash, runway, revenue, or expenses, feel free to ask!

#### GLM-5.2

`financial_position` · tools: none · 1385 tokens · 5.1s

I'm not able to calculate gross margin. Gross margin is a profitability measure that requires **revenue** and **cost of goods sold (COGS)**, and AI-BOSS doesn't currently support profitability ratios like this.

What I *can* help with includes:

- **Current cash position** and **runway**
- **Monthly revenue** and **monthly expenses**
- **Accounts receivable** and **accounts payable**
- **Historical trends** and **deterministic forecasts** for those metrics
- **Recurring-cost scenarios** (e.g., "What if we add a $5K/month hire?")

If you'd like, I can pull your latest snapshot for any of these. For gross margin specifically, I'd recommend checking with your accountant or accounting software (e.g., Xero, MYOB), which will have the COGS detail needed.

#### GLM-5.3

`financial_position` · tools: none · 1389 tokens · 6.6s

I'm not able to calculate gross margin. That's a profitability measure that requires cost of goods sold (COGS), which isn't among the metrics I currently support.

What I can help with instead:
- **Monthly revenue and expenses** — your current confirmed figures
- **Cash, receivables, and payables** — your current position
- **Burn rate and runway** — how long your cash will last

If you'd like, I can pull your latest revenue and expense figures so you can see the gap between them — just note that's not the same as gross margin, since I can't separate COGS from other operating costs. Would that be useful?

#### GLM-5 Turbo

`financial_position` · tools: none · 1286 tokens · 6.7s

I'm not able to calculate **gross margin** — it falls outside the metrics I currently support. AI-BOSS can help with:

- **Cash, accounts receivable, accounts payable**
- **Monthly revenue and expenses**
- **Burn rate and runway**
- **Historical trends and deterministic forecasts**
- **Recurring-cost what-if scenarios**

Gross margin requires cost of goods sold (COGS) data, which I don't have access to. I'd recommend checking your accounting software (e.g., Xero, MYOB) or speaking with your accountant for that figure.

Is there anything from the list above I can help you with?

#### DeepSeek V4 Flash

`financial_position` · tools: none · 1537 tokens · 2.7s

I can't calculate gross margin — it's a profitability measure that requires cost-of-goods-sold data, which isn't one of the metrics AI-BOSS supports.

What I *can* help you with from your confirmed data:

- **Current cash position** and **runway** (months of operation)
- **Monthly revenue** and **monthly expenses**
- **Burn rate** and cash flow trends
- Forecasts and cost-change scenarios

Would you like me to pull your current snapshot for any of these?

#### Grok 4

`financial_position` · tools: none · 1555 tokens · 3.5s

Gross margin is a profitability measure not supported by my current capabilities (cash, runway, and related position metrics only).

#### Gemini 3.6 Flash

`financial_position` · tools: get_latest_snapshot · 3408 tokens · 6.6s

I cannot calculate your gross margin because gross margin and profitability ratios (which require Cost of Goods Sold / COGS data) are currently not supported.

For reference, your current tracked monthly income and expenditure metrics are:
- **Monthly Revenue:** $38,000 NZD (source: `ai-boss-demo-consistent.csv`, confidence: 85%)
- **Monthly Expenses:** $61,000 NZD (source: `ai-boss-demo-consistent.csv`, confidence: 85%)

If you need detailed margin or profitability analysis, I recommend consulting with a qualified accounting professional.

### history

**Prompt:** How has my cash changed over recent months?

**Tests:** Historical retrieval via get_financial_history. Does it report the actual movement across periods, or fall back to the current snapshot and describe one point in time as a trend?

#### GPT-4o mini

`historical_forecast` · tools: none · 1135 tokens · 1.0s

Could you please specify the time range you would like to review? Options include the last 3 months, 6 months, or all available data. Additionally, please let me know if you want the information in NZD or AUD.

#### GPT-4o

`historical_forecast` · tools: get_financial_history · 2364 tokens · 2.2s

Over the past three months, your cash in NZD has remained stable at NZD 185,000. There has been no overall change during this period. Please note that this history combines data from multiple sources, so it's advisable to compare it cautiously.

#### GLM-5.2

_Failed after 2.4s: Received tool input did not match expected schema

 Invalid input
   at recordLimit_

#### GLM-5.3

_Failed after 5.0s: Received tool input did not match expected schema

 Invalid input
   at recordLimit_

#### GLM-5 Turbo

`historical_forecast` · tools: get_financial_history · 3412 tokens · 12.9s

Here's what the data shows for your cash position over the last six months:

### NZD Cash
- **Latest:** NZD 185,000 (as of 13 Aug 2026)
- **Trend:** **Stable** — no net change over the period
- **Observations:** 2 data points (18 May → 13 Aug 2026)
- **Sources:** financial-data.csv, ai-boss-demo-consistent.csv

**What this means:** Your cash balance has held steady at NZD 185,000 over the recent months, with no meaningful upward or downward movement.

> **Note:** This history combines multiple data sources, so the figures should be compared cautiously. Also, with only two observations in the window, the trend is based on limited data points.

Would you like me to forecast where cash might head over the next 3 or 6 months, or look at a different metric like revenue or expenses?

#### DeepSeek V4 Flash

`historical_forecast` · tools: get_financial_history · 4287 tokens · 6.2s

Here's how your cash has moved over the last 6 months:

**Cash — NZD**
- Latest value: **NZD 185,000** (as at 13 Aug 2026)
- Trend: **Stable** — no net change over the period (2 observations between 18 May 2026 and 13 Aug 2026)

**What this means:** Your cash balance has held steady at NZD 185,000 across the recent months, with no upward or downward movement. That suggests inflows and outflows have been roughly balanced, or that cash has simply been sitting flat.

** One caution:** The data combines two sources (financial-data.csv and ai-boss-demo-consistent.csv). I'd treat the picture as indicative rather than fully verified — if you want certainty, it's worth confirming which source reflects your current bank records.

No AUD series was returned, so this reflects your NZD figures only.

Would you like me to look at a forecast of where this trend might take cash over the next 3–6 months?

#### Grok 4

`historical_forecast` · tools: get_financial_history · 4039 tokens · 5.8s

**Cash (NZD, last 3 months):**  
Latest value: NZD 185,000.  
Trend: stable (no overall change across the two observations from May to August 2026).  

Sources: financial-data.csv, ai-boss-demo-consistent.csv (combined sources—compare cautiously).

#### Gemini 3.6 Flash

`historical_forecast` · tools: get_financial_history, get_financial_history · 5924 tokens · 9.5s

Over recent months, your cash balance has remained stable:

### **NZD Cash Movement**
* **Period:** 18 May 2026 – 13 August 2026 (2 observations)
* **Latest Value:** NZD 185,000
* **Trend:** Stable (NZD 0 overall change)
* **Sources:** *financial-data.csv*, *ai-boss-demo-consistent.csv*

*Note: This historical view combines data from multiple sources, so figures should be compared cautiously.*

---
*AI-BOSS is an automated intelligence tool and not a licensed financial advisor. Please consult a qualified financial professional before making major financial decisions.*

### forecast

**Prompt:** Forecast my runway for the next 6 months.

**Tests:** Forward projection via get_financial_forecast. Does it use the deterministic forecast tool, or extrapolate in prose from the current figure?

#### GPT-4o mini

`historical_forecast` · tools: get_financial_history · 2411 tokens · 3.1s

It appears that there are no historical financial observations available to generate a runway forecast. To proceed, you'll need to upload at least two dated CSV records containing your financial data. Once I have that information, I can help you with the runway forecast.

#### GPT-4o

`historical_forecast` · tools: get_financial_history · 2360 tokens · 3.4s

I couldn't find any historical financial data to analyze your runway trend. To proceed with a forecast, please upload at least two dated CSV records containing your financial observations. This will help in identifying a trend for the runway forecast.

#### GLM-5.2

_Failed after 2.1s: Received tool input did not match expected schema

 Invalid input
   at recordLimit_

#### GLM-5.3

_Failed after 3.9s: Received tool input did not match expected schema

 Invalid input
   at recordLimit_

#### GLM-5 Turbo

`historical_forecast` · tools: get_financial_forecast · 3218 tokens · 9.2s

I'm unable to generate a 6-month runway forecast because there are no historical financial observations on file yet. A deterministic forecast needs at least two months of past data to identify a trend and project it forward.

**To get started, please upload dated financial records** (e.g., a CSV with monthly cash, revenue, and expense figures). Once there's enough history, I can produce a 6-month runway trend-continuation forecast for you.

> **Note:** Forecasts are trend-based estimates, not guarantees. For major financial decisions, I'd recommend consulting a licensed financial advisor.

#### DeepSeek V4 Flash

`historical_forecast` · tools: get_financial_forecast · 4113 tokens · 5.4s

I couldn't generate a runway forecast yet — the forecast tool returned no historical observations to work from.

**What's needed to create this forecast:**
- At least **two dated CSV records** with runway data (or its inputs: cash, monthly revenue/expenses, burn) uploaded to your account.
- Forecasts are trend-continuation estimates from that history — they're not guarantees.

**What to do next:**
1. Upload your dated financial records (cash, revenue, expenses, burn, and/or runway observations).
2. Once at least two dated records exist, ask me again and I'll run the 6-month runway forecast.

Note: I'm handling historical review and forecasts only in this session — for present runway or what-if scenarios, ask for those separately.

#### Grok 4

`historical_forecast` · tools: get_financial_forecast · 4337 tokens · 8.0s

**NZD 6-month deterministic forecast (trend continuation, not a guarantee)**

- **Cash**: Latest NZD 185,000; flat trend (+NZD 0/month) → projected NZD 185,000 by Feb 2027.
- **Monthly revenue**: Latest NZD 38,000; declining trend (-NZD 9,460/month) → projected -NZD 18,762 by Jan 2027.
- **Monthly expenses**: Latest NZD 61,000; rising trend (+NZD 15,630/month) → projected NZD 154,780 by Jan 2027.
- **Burn rate**: Latest NZD 23,000; flat trend (+NZD 0/month) → projected NZD 23,000 by Jan 2027.

No runway_months forecast was returned. Historical inputs combine multiple sources; treat projections cautiously. Seek professional advice for decisions.

#### Gemini 3.6 Flash

`historical_forecast` · tools: get_financial_forecast · 3490 tokens · 5.9s

I am unable to forecast your runway for the next 6 months because no historical financial data is available yet in the system. 

To generate a deterministic trend forecast, please upload at least two dated CSV records or financial statements. Once uploaded, a 6-month runway forecast based on historical trend continuation can be generated.

*Please note: Financial forecasts are automated trend-continuation estimates and not guarantees. Always consult a licensed financial professional before making major financial decisions.*

### burn-percentage

**Prompt:** What if I cut monthly burn by 20%?

**Tests:** Tool and argument correctness. Should reach model_scenario with a percentage, not a dollar amount.

#### GPT-4o mini

`scenario` · tools: model_scenario · 2079 tokens · 5.5s

If you cut your monthly burn by 20%, here’s how it would impact your financial position:

- **Current Monthly Burn**: 23,000 NZD
- **New Monthly Burn**: 18,400 NZD (after the reduction)
- **Runway Before Reduction**: 9.09 months
- **Runway After Reduction**: 11.36 months
- **Impact on Runway**: An increase of 2.27 months

**Assessment**: Your new runway of 11.36 months is above the recommended minimum of 6 months, indicating a healthy financial position.

This scenario is modeled and does not change your stored financial data.

#### GPT-4o

`scenario` · tools: model_scenario · 2022 tokens · 6.8s

By reducing your monthly burn by 20%, which equates to a decrease of 4,600 NZD per month, your financial position would change as follows:

- **Before the reduction**: You have a runway of 9.09 months with a monthly burn of 23,000 NZD.
- **After the reduction**: Your runway would extend to 11.36 months with a new monthly burn of 18,400 NZD.

This change would increase your runway by 2.27 months, resulting in a healthier financial position with a runway well above the 6-month recommended minimum. 

Please note that this is a modeled scenario and does not alter your stored financial data.

#### GLM-5.2

`scenario` · tools: model_scenario · 2460 tokens · 5.5s

Here's what a **20% burn reduction** would look like:

| | Current | After 20% Cut |
|---|---|---|
| **Monthly burn** | $23,000 NZD | $18,400 NZD |
| **Runway** | 9.09 months | 11.36 months |
| **Gain** | — | **+2.27 months** |

Cutting $4,600 NZD/month from your burn would extend your runway from just over 9 months to roughly **11.4 months** — comfortably above the 6-month recommended minimum.

A few things to keep in mind:
- This is a **modelled scenario only** — your stored financial data hasn't changed.
- The forecast assumes your current cash position and revenue hold steady; actual results will vary.
- If you'd like to explore a specific dollar-amount cut or model a different percentage, just let me know.

For major financial decisions, I'd recommend discussing with a professional advisor.

#### GLM-5.3

`scenario` · tools: model_scenario · 2516 tokens · 10.6s

Here's what a 20% burn reduction would look like:

**Scenario: Cut monthly burn by 20%**

| | Before | After |
|---|---|---|
| Monthly burn | $23,000 NZD | $18,400 NZD |
| Runway | 9.09 months | 11.36 months |

**Impact:** You'd save $4,600 NZD per month, extending your runway by about **2.27 months**.

**Assessment:** Your current runway of 9.09 months is already healthy, and this cut would push you to 11.36 months — comfortably above the 6-month recommended minimum.

A few things to keep in mind:
- This is a modelled scenario only — your stored financial data hasn't been changed.
- The model assumes the reduction is sustained every month going forward.
- Before acting on a cut this size, it's worth identifying which specific costs would go, since a 20% reduction often involves trade-offs (e.g., pausing marketing, deferring hires).

For major financial decisions like this, I'd recommend discussing with a professional advisor. Want me to model a specific dollar-amount cut instead, or a different percentage?

#### GLM-5 Turbo

`scenario` · tools: model_scenario, model_scenario, model_scenario, model_scenario · 7324 tokens · 46.1s

I apologise — my previous attempts to model that scenario failed because I didn't pass the percentage change through correctly. I'm unable to retry the call right now, but here's what I need to do:

To model a **20% reduction in monthly burn**, I would pass a `burn_percentage_change` of **-20** (negative, since it's a reduction) into the scenario tool. That would:

1. Take your **current verified monthly burn** as the baseline.
2. Calculate the dollar saving from a 20% cut.
3. Compare your **current runway** against the **new runway** with the reduced burn.

Could you confirm you'd like me to model a **20% burn reduction**? I'll make sure the parameter is included correctly this time.

#### DeepSeek V4 Flash

`scenario` · tools: model_scenario · 3036 tokens · 4.2s

Here's what a 20% burn cut would do:

**Scenario: cut burn 20%**
- **Monthly burn:** $23,000 NZD → **$18,400 NZD** (a saving of $4,600/month)
- **Runway:** 9.09 months → **11.36 months**
- **Impact:** **+2.27 months** of runway added

**What this means:** You'd extend your cash runway from about 9 months to just over 11 months. That comfortably clears the 6-month recommended minimum, giving you more breathing room to pursue growth or ride out uncertainty.

This is a read-only model — your stored data hasn't been changed. If you'd like, I can also model a specific dollar saving or a different percentage to compare options.

*Note: This is a modelled scenario based on verified current metrics, not a guarantee. For major financial decisions, consider speaking with a professional advisor.*

#### Grok 4

`scenario` · tools: model_scenario · 2911 tokens · 5.7s

**20% monthly burn reduction scenario**

- Current burn: 23,000 NZD/month → runway of 9.09 months  
- After 20% cut: 18,400 NZD/month (-4,600 NZD) → runway of 11.36 months  
- Net impact: +2.27 months runway  

Your runway would stay healthy (above the 6-month minimum). This is a modelled scenario only and does not change your actual data.

#### Gemini 3.6 Flash

`scenario` · tools: model_scenario · 2890 tokens · 5.8s

If you cut your monthly burn rate by **20%**, here is the impact on your runway based on your current financial metrics:

### **What-If Scenario: 20% Burn Reduction**
* **Current Monthly Burn:** 23,000 NZD/month
* **New Monthly Burn:** 18,400 NZD/month *(a saving of 4,600 NZD/month)*
* **Current Runway:** 9.09 months
* **New Runway:** **11.36 months**
* **Net Impact:** **+2.27 months** of additional runway

### **Key Takeaway**
Reducing monthly burn by 20% extends your runway to over 11 months, well above the standard 6-month safety threshold. 

*Note: This is a read-only scenario simulation and does not alter your actual stored financial data. I am an AI, not a licensed financial advisor—please consult a qualified professional before making major operational changes.*

### hire

**Prompt:** What if I hire someone for 8,000 a month?

**Tests:** Different tool path — a dollar amount rather than a percentage.

#### GPT-4o mini

`scenario` · tools: model_scenario · 1998 tokens · 2.9s

If you hire someone for NZD 8,000 a month, your financial scenario would change as follows:

- **Current Runway**: 9.09 months with a burn rate of NZD 23,000 per month.
- **New Runway**: 6.74 months with a burn rate of NZD 31,000 per month.
- **Impact**: This hire would reduce your runway by 2.35 months.

**Assessment**: Your new runway of 6.74 months is still above the recommended minimum of 6 months, indicating a healthy position. 

This scenario is modeled and does not change your stored financial data.

#### GPT-4o

`scenario` · tools: model_scenario · 1969 tokens · 3.0s

If you hire someone for 8,000 NZD a month, your runway would decrease from 9.09 months to 6.74 months. Your monthly burn rate would increase from 23,000 NZD to 31,000 NZD. This change would reduce your runway by 2.35 months.

Your runway of 6.74 months is still above the recommended minimum of 6 months, indicating a healthy financial position. Remember, this is a modeled scenario and does not change your stored financial data.

#### GLM-5.2

`scenario` · tools: model_scenario · 2486 tokens · 5.5s

Here's what hiring someone at **$8,000/month** would look like:

| | Before | After |
|---|---|---|
| **Monthly burn** | $23,000 | $31,000 |
| **Runway** | 9.09 months | 6.74 months |

**Impact:** Your runway would drop by about **2.35 months**, from ~9 months to ~6.7 months.

**Assessment:** You'd still be above the 6-month recommended minimum runway, so this is a manageable hire from a cash perspective — though your buffer would be noticeably tighter.

A few things to keep in mind:
- This assumes the $8,000 is the **all-in** monthly cost (salary + taxes, etc.). If there are additional costs like equipment or benefits, the actual impact could be higher.
- This is a modelled scenario only — your stored financial data hasn't changed.

Would you like to explore other scenarios, such as a different salary amount or a cost saving to offset the hire?

#### GLM-5.3

`scenario` · tools: model_scenario · 2442 tokens · 9.4s

Here's what hiring someone at $8,000/month would do to your position:

**Before the hire**
- Monthly burn: $23,000 NZD
- Runway: 9.09 months

**After the hire**
- Monthly burn: $31,000 NZD (+$8,000)
- Runway: 6.74 months

**Impact:** You'd lose about 2.35 months of runway.

**Assessment:** Still healthy — 6.74 months sits just above the commonly recommended 6-month minimum, but you'd have less buffer for surprises. If revenue doesn't grow to offset the new cost, you'd want a plan for what happens as that runway shortens.

This is a modelled scenario only — your stored financial data hasn't been changed. For a decision of this size, it's worth talking it through with your accountant or financial advisor.

#### GLM-5 Turbo

`scenario` · tools: model_scenario, model_scenario, model_scenario, model_scenario · 6124 tokens · 18.6s

I wasn't able to complete the scenario modelling due to a technical issue with the tool. I apologise for the inconvenience.

To model the impact of an $8,000/month new hire on your runway, I'd need to run the scenario with that cost change applied to your current burn rate. Unfortunately the tool didn't process the request correctly.

Here's what I can tell you in the meantime:

- **What it would do:** Adding $8,000/month in recurring costs would increase your monthly burn by that amount, which would reduce your available runway accordingly.
- **To get the exact numbers**, I'd need to first pull your current cash position and burn rate, then model the $8,000 change against them.

Could you try asking again? For example: *"Model a new hire costing $8,000 per month"* — and I'll make sure the full dollar amount is passed through correctly this time.

#### DeepSeek V4 Flash

`scenario` · tools: model_scenario · 3024 tokens · 4.2s

Here's how that hire would affect your runway:

**Before the hire**
- Burn: **23,000 NZD/month**
- Runway: **9.09 months**

**After hiring at 8,000 NZD/month**
- Burn: **31,000 NZD/month**
- Runway: **6.74 months**

**Impact: −2.35 months of runway**

**What it means:** Your runway drops from just over 9 months to about 6.7 months. That's still above the 6-month recommended minimum, so the position remains workable — but the buffer shrinks by roughly a quarter, leaving less room for surprises.

This is a modelled what-if only — nothing in your stored financial data has been changed. If the hire is something you're seriously considering, it's worth reviewing your revenue and expense forecasts to confirm the plan holds, and speaking with a financial advisor before committing.

#### Grok 4

`scenario` · tools: model_scenario · 2938 tokens · 6.3s

Hiring someone at $8,000 NZD per month would increase your monthly burn from $23,000 to $31,000 NZD. 

Your runway would drop from 9.09 months to 6.74 months (a reduction of 2.35 months). 

This remains healthy, as it stays above the 6-month recommended minimum. This is a modelled scenario only and does not change your stored data.

#### Gemini 3.6 Flash

`scenario` · tools: model_scenario · 2663 tokens · 5.3s

Adding a new hire at **$8,000 NZD per month** increases your recurring monthly burn from **$23,000 NZD** to **$31,000 NZD**.

### Scenario Breakdown
* **Runway Before:** 9.09 months
* **Runway After:** 6.74 months
* **Impact:** -2.35 months of runway

### What This Means
Your projected runway remains above the recommended 6-month minimum threshold (6.74 months), indicating a healthy cash position even with this additional cost. 

*Note: This is a read-only what-if model and does not alter your actual financial records. Please consult a qualified financial professional for major hiring decisions.*

### elliptical-followup

**Prompt:** And what about 30%?

**Tests:** Hardest routing case. No noun in the question; only answerable from prior turns.

#### GPT-4o mini

`financial_position` · tools: get_latest_snapshot, calculate_runway · 3378 tokens · 2.6s

If you cut your monthly burn by 30%, your runway would extend to approximately 12.98 months. This is a healthy position, as it exceeds the recommended minimum of 6 months.

#### GPT-4o

`financial_position` · tools: get_latest_snapshot, calculate_runway · 3532 tokens · 4.0s

By reducing your monthly burn by 30%, your runway would extend from approximately 9.09 months to 12.98 months. This is calculated using your current financial position, with a new monthly burn rate of 16,100 NZD. Your financial status is considered healthy, as the runway is above the recommended minimum of 6 months.

#### GLM-5.2

`financial_position` · tools: get_latest_snapshot, calculate_runway · 4798 tokens · 14.4s

Here's how a **30% burn cut** would play out:

| Scenario | Monthly Burn | Runway |
|---|---|---|
| Current | $23,000 | ~9.1 months |
| −20% | $18,400 | ~11.4 months |
| **−30%** | **$16,100** | **~13.0 months** |

Cutting burn by 30% would extend your runway from about 9 months to **nearly 13 months** — roughly 4 extra months of breathing room.

**How it's calculated:** Net available cash of $209,000 ($185k cash + $42k receivables − $18k payables) ÷ $16,100 reduced monthly burn = 12.98 months.

The trade-off, of course, is what you'd need to cut to achieve that 30% reduction — whether that's deferring hires, reducing discretionary spend, or trimming operational costs. If you'd like to model a specific cost change, I can help with that.

*Note: These figures are based on your latest confirmed snapshot from ai-boss-demo-consistent.csv. I'm not a licensed financial advisor — please seek professional advice for major decisions.*

#### GLM-5.3

`financial_position` · tools: get_latest_snapshot, calculate_runway · 4446 tokens · 13.4s

Cutting monthly burn by 30% (from $23,000 to $16,100 NZD) would extend your runway to **12.98 months**, up from 9.09 months at your current burn.

That's a meaningful jump — the extra 20% cut beyond the first scenario buys you roughly 1.6 additional months of runway.

#### GLM-5 Turbo

`financial_position` · tools: get_latest_snapshot, calculate_runway · 4437 tokens · 14.9s

A 30% cut to your monthly burn would take it from **$23,000** down to **$16,100/month**, giving you:

- **~13.0 months of runway** (up from ~9.1 months today)

That's nearly **4 extra months** compared to your current position, and comfortably above the 6-month healthy threshold.

For reference, here's how the three scenarios compare:

| Scenario | Monthly Burn | Runway |
|---|---|---|
| Current | $23,000 | ~9.1 months |
| −20% | $18,400 | ~11.4 months |
| −30% | $16,100 | ~13.0 months |

Keep in mind these are simple calculations based on today's confirmed figures (cash $185k, receivables $42k, payables $18k). They don't account for revenue changes, one-off costs, or other shifts that could happen over that period. I'd recommend seeking professional advice before making significant cost-cutting decisions.

#### DeepSeek V4 Flash

`financial_position` · tools: none · 2820 tokens · 13.0s

I need to correct course here, and I appreciate you pushing further.

That 20% runway figure I gave you earlier was **not** tool-backed — I stated a specific result without running any calculation, which violates how I'm supposed to work. I shouldn't have done that, and I apologize for the misleading number.

Here's the honest situation:

- Cutting monthly burn by 20% or 30% is a **cost scenario (what-if)** question.
- Scenario modeling like this requires the `model_scenario` analysis tool, which isn't available in my current session. My scope here is limited to your **current financial position** (via `get_latest_snapshot`) and **runway from confirmed snapshot values** (via `calculate_runway`).
- I can't invent or estimate scenario outputs, so I won't give you a 30% figure either.

**What I can do:**
1. Pull your verified current snapshot — cash, receivables, payables, and burn — so we have accurate baseline numbers.
2. Compute runway from those confirmed values.

For the actual impact of a 20% or 30% burn reduction, the proper next step is to run that through the scenario analysis tool (or ask your financial advisor to model it), rather than me calculating it ad hoc from unconfirmed assumptions.

Want me to start by pulling your current verified snapshot so we have solid baseline figures?

#### Grok 4

`financial_position` · tools: get_latest_snapshot, calculate_runway · 5007 tokens · 9.2s

Cutting monthly burn by 30% would extend your runway from 9.09 months to 12.98 months.

#### Gemini 3.6 Flash

`financial_position` · tools: get_latest_snapshot, calculate_runway · 5498 tokens · 8.8s

Reducing your monthly burn by 30% drops it from **23,000 NZD** to **16,100 NZD** per month.

Based on your net available cash of **209,000 NZD** (185,000 cash + 42,000 AR − 18,000 AP):

* **Current Runway:** 9.09 months
* **New Runway (30% cut):** **12.98 months** (~13 months)

This extends your operational runway by roughly 3.9 months. 

*Note: AI-BOSS provides operational estimates based on current metrics. Please consult a qualified advisor before making major strategic cost reductions.*
