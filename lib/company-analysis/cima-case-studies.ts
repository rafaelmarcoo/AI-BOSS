import type { StatementLineKey } from '@/lib/company-analysis/statement-lines'


type CompanyLineKey = Exclude<StatementLineKey, 'segment_revenue' | 'segment_direct_costs'>

export interface CaseStudyRevenueStream {
  name: string
  revenue: number
  /** Null where the statements show no direct cost for the stream. */
  directCosts: number | null
}

export interface CaseStudyYear {
  fiscalYearEnd: string
  profitOrLossPage: number
  financialPositionPage: number
  /** Only the latest year's statement of changes in equity is published. */
  changesInEquityPage?: number
  lines: Partial<Record<CompanyLineKey, number>>
  revenueStreams?: CaseStudyRevenueStream[]
}

export interface CaseStudyCompany {
  name: string
  industry: string
  peerGroup: string
  currency: string
  amountsIn: 'millions'
  description: string
  source: string
  /** Latest year first. */
  years: CaseStudyYear[]
}

const MAY_AUG_2025 =
  'CIMA Management Case Study pre-seen material, May–August 2025 (© CIMA 2025)'
const NOV_2025_FEB_2026 =
  'CIMA Management Case Study pre-seen material, November 2025–February 2026 (© CIMA 2025)'

export const CIMA_CASE_STUDIES: CaseStudyCompany[] = [
  {
    name: 'Trimayr',
    industry: 'Hairdressing franchising',
    peerGroup: 'dazzland-hairdressing',
    currency: 'D$',
    amountsIn: 'millions',
    description:
      'Franchises hairdressing salons throughout Dazzland and also owns a small number of salons.',
    source: MAY_AUG_2025,
    years: [
      {
        fiscalYearEnd: '2024-12-31',
        profitOrLossPage: 16,
        changesInEquityPage: 16,
        financialPositionPage: 17,
        revenueStreams: [
          { name: 'Franchise royalties', revenue: 113.1, directCosts: null },
          { name: 'Product sales to franchisees', revenue: 52.3, directCosts: 32.4 },
          { name: 'Training franchisee employees and principals', revenue: 9.4, directCosts: 7.2 },
          { name: 'Company-owned salons', revenue: 62.4, directCosts: 38.1 },
        ],
        lines: {
          revenue: 237.2,
          marketing_expenses: 26.8,
          administrative_expenses: 58.6,
          total_operating_costs: 163.1,
          operating_profit: 74.1,
          finance_costs: 6.8,
          profit_before_tax: 67.3,
          tax_expense: 9.4,
          profit_for_year: 57.9,
          dividends: 48.7,
          intangible_assets: 6.9,
          property_plant_equipment: 178.3,
          non_current_assets: 185.2,
          inventory: 4.3,
          trade_receivables: 12.8,
          cash: 6.6,
          current_assets: 23.7,
          total_assets: 208.9,
          share_capital: 35.0,
          retained_earnings: 65.1,
          total_equity: 100.1,
          non_current_borrowings: 85.0,
          trade_payables: 14.6,
          tax_payable: 9.2,
          current_liabilities: 23.8,
        },
      },
      {
        fiscalYearEnd: '2023-12-31',
        profitOrLossPage: 16,
        financialPositionPage: 17,
        revenueStreams: [
          { name: 'Franchise royalties', revenue: 102.9, directCosts: null },
          { name: 'Product sales to franchisees', revenue: 45.5, directCosts: 29.5 },
          { name: 'Training franchisee employees and principals', revenue: 7.9, directCosts: 6.2 },
          { name: 'Company-owned salons', revenue: 59.9, directCosts: 36.2 },
        ],
        lines: {
          revenue: 216.2,
          marketing_expenses: 26.3,
          administrative_expenses: 56.3,
          total_operating_costs: 154.5,
          operating_profit: 61.7,
          finance_costs: 7.6,
          profit_before_tax: 54.1,
          tax_expense: 7.0,
          profit_for_year: 47.1,
          intangible_assets: 6.9,
          property_plant_equipment: 176.4,
          non_current_assets: 183.3,
          inventory: 3.9,
          trade_receivables: 12.2,
          cash: 7.3,
          current_assets: 23.4,
          total_assets: 206.7,
          share_capital: 35.0,
          retained_earnings: 55.9,
          total_equity: 90.9,
          non_current_borrowings: 95.0,
          trade_payables: 13.9,
          tax_payable: 6.9,
          current_liabilities: 20.8,
        },
      },
    ],
  },
  {
    name: 'Pallo & Troo',
    industry: 'Hairdressing franchising',
    peerGroup: 'dazzland-hairdressing',
    currency: 'D$',
    amountsIn: 'millions',
    description:
      "One of Trimayr's direct competitors, franchising midmarket salons. All of its salons are franchised.",
    source: MAY_AUG_2025,
    years: [
      {
        fiscalYearEnd: '2024-12-31',
        profitOrLossPage: 18,
        changesInEquityPage: 18,
        financialPositionPage: 19,
        // No company-owned salons, so that stream is omitted rather than zero.
        revenueStreams: [
          { name: 'Franchise royalties', revenue: 124.6, directCosts: null },
          { name: 'Product sales to franchisees', revenue: 59.4, directCosts: 36.8 },
          { name: 'Training franchisee employees and principals', revenue: 2.6, directCosts: 1.1 },
        ],
        lines: {
          revenue: 186.6,
          marketing_expenses: 35.4,
          administrative_expenses: 62.1,
          total_operating_costs: 135.4,
          operating_profit: 51.2,
          finance_costs: 4.8,
          profit_before_tax: 46.4,
          tax_expense: 6.5,
          profit_for_year: 39.9,
          dividends: 39.1,
          intangible_assets: 4.1,
          property_plant_equipment: 127.4,
          non_current_assets: 131.5,
          inventory: 3.6,
          trade_receivables: 13.7,
          cash: 2.4,
          current_assets: 19.7,
          total_assets: 151.2,
          share_capital: 30.0,
          retained_earnings: 42.3,
          total_equity: 72.3,
          non_current_borrowings: 60.0,
          trade_payables: 12.5,
          tax_payable: 6.4,
          current_liabilities: 18.9,
        },
      },
      {
        fiscalYearEnd: '2023-12-31',
        profitOrLossPage: 18,
        financialPositionPage: 19,
        revenueStreams: [
          { name: 'Franchise royalties', revenue: 113.4, directCosts: null },
          { name: 'Product sales to franchisees', revenue: 51.7, directCosts: 33.5 },
          { name: 'Training franchisee employees and principals', revenue: 2.2, directCosts: 0.9 },
        ],
        lines: {
          revenue: 167.3,
          marketing_expenses: 34.7,
          administrative_expenses: 59.6,
          total_operating_costs: 128.7,
          operating_profit: 38.6,
          finance_costs: 4.8,
          profit_before_tax: 33.8,
          tax_expense: 4.4,
          profit_for_year: 29.4,
          intangible_assets: 4.1,
          property_plant_equipment: 124.2,
          non_current_assets: 128.3,
          inventory: 3.3,
          trade_receivables: 13.4,
          cash: 2.6,
          current_assets: 19.3,
          total_assets: 147.6,
          share_capital: 30.0,
          retained_earnings: 41.5,
          total_equity: 71.5,
          non_current_borrowings: 60.0,
          trade_payables: 11.9,
          tax_payable: 4.2,
          current_liabilities: 16.1,
        },
      },
    ],
  },
  {
    name: 'Ressett',
    industry: 'PC reselling',
    peerGroup: 'lamland-pc-resellers',
    currency: 'L$',
    amountsIn: 'millions',
    description:
      'Buys new and used PCs, peripherals and consumables for resale, selling online and through a call centre.',
    source: NOV_2025_FEB_2026,
    years: [
      {
        fiscalYearEnd: '2025-03-31',
        profitOrLossPage: 17,
        changesInEquityPage: 17,
        financialPositionPage: 18,
        lines: {
          revenue: 203.3,
          cost_of_sales: 146.4,
          gross_profit: 56.9,
          administrative_expenses: 28.5,
          operating_profit: 28.4,
          finance_costs: 0.7,
          profit_before_tax: 27.7,
          tax_expense: 3.9,
          profit_for_year: 23.8,
          dividends: 22.9,
          intangible_assets: 2.2,
          property_plant_equipment: 9.7,
          non_current_assets: 11.9,
          inventory: 15.2,
          trade_receivables: 16.1,
          cash: 7.8,
          current_assets: 39.1,
          total_assets: 51.0,
          share_capital: 6.0,
          retained_earnings: 21.1,
          total_equity: 27.1,
          non_current_borrowings: 8.0,
          trade_payables: 12.2,
          tax_payable: 3.7,
          current_liabilities: 15.9,
        },
      },
      {
        fiscalYearEnd: '2024-03-31',
        profitOrLossPage: 17,
        financialPositionPage: 18,
        lines: {
          revenue: 197.2,
          cost_of_sales: 144.0,
          gross_profit: 53.2,
          administrative_expenses: 29.6,
          operating_profit: 23.6,
          finance_costs: 0.7,
          profit_before_tax: 22.9,
          tax_expense: 3.0,
          profit_for_year: 19.9,
          intangible_assets: 2.2,
          property_plant_equipment: 9.9,
          non_current_assets: 12.1,
          inventory: 14.8,
          trade_receivables: 15.8,
          cash: 6.9,
          current_assets: 37.5,
          total_assets: 49.6,
          share_capital: 6.0,
          retained_earnings: 20.2,
          total_equity: 26.2,
          non_current_borrowings: 8.0,
          trade_payables: 12.5,
          tax_payable: 2.9,
          current_liabilities: 15.4,
        },
      },
    ],
  },
  {
    name: 'Fixxupp',
    industry: 'PC reselling',
    peerGroup: 'lamland-pc-resellers',
    currency: 'L$',
    amountsIn: 'millions',
    description:
      "Ressett's closest direct competitor and the only other major PC reseller in Lamland, with a very similar business model.",
    source: NOV_2025_FEB_2026,
    years: [
      {
        fiscalYearEnd: '2025-03-31',
        profitOrLossPage: 20,
        changesInEquityPage: 20,
        financialPositionPage: 21,
        lines: {
          revenue: 187.0,
          cost_of_sales: 138.4,
          gross_profit: 48.6,
          administrative_expenses: 28.1,
          operating_profit: 20.5,
          finance_costs: 0.9,
          profit_before_tax: 19.6,
          tax_expense: 2.7,
          profit_for_year: 16.9,
          dividends: 15.4,
          intangible_assets: 1.5,
          property_plant_equipment: 10.4,
          non_current_assets: 11.9,
          inventory: 15.2,
          trade_receivables: 15.6,
          cash: 6.3,
          current_assets: 37.1,
          total_assets: 49.0,
          share_capital: 5.0,
          retained_earnings: 20.2,
          total_equity: 25.2,
          non_current_borrowings: 10.0,
          trade_payables: 11.3,
          tax_payable: 2.5,
          current_liabilities: 13.8,
        },
      },
      {
        fiscalYearEnd: '2024-03-31',
        profitOrLossPage: 20,
        financialPositionPage: 21,
        lines: {
          revenue: 170.5,
          cost_of_sales: 127.9,
          gross_profit: 42.6,
          administrative_expenses: 23.9,
          operating_profit: 18.7,
          finance_costs: 0.9,
          profit_before_tax: 17.8,
          tax_expense: 2.3,
          profit_for_year: 15.5,
          intangible_assets: 1.5,
          property_plant_equipment: 10.1,
          non_current_assets: 11.6,
          inventory: 15.3,
          trade_receivables: 14.4,
          cash: 5.1,
          current_assets: 34.8,
          total_assets: 46.4,
          share_capital: 5.0,
          retained_earnings: 18.7,
          total_equity: 23.7,
          non_current_borrowings: 10.0,
          trade_payables: 10.5,
          tax_payable: 2.2,
          current_liabilities: 12.7,
        },
      },
    ],
  },
]

const FINANCIAL_POSITION_KEYS = new Set<CompanyLineKey>([
  'intangible_assets',
  'property_plant_equipment',
  'non_current_assets',
  'inventory',
  'trade_receivables',
  'cash',
  'current_assets',
  'total_assets',
  'share_capital',
  'retained_earnings',
  'total_equity',
  'non_current_borrowings',
  'trade_payables',
  'tax_payable',
  'current_liabilities',
])

export interface StatementLineRow {
  fiscal_year_end: string
  line_key: StatementLineKey
  segment: string
  value: number
  source_page: number
}

/**
 * Flattens a company's statements into rows shaped like company_statement_lines,
 * each carrying the page of the statement it came from.
 */
export function toStatementLineRows(company: CaseStudyCompany): StatementLineRow[] {
  return company.years.flatMap((year) => {
    const lineRows = Object.entries(year.lines).map(([key, value]) => {
      const lineKey = key as CompanyLineKey
      const page =
        lineKey === 'dividends'
          ? year.changesInEquityPage ?? year.profitOrLossPage
          : FINANCIAL_POSITION_KEYS.has(lineKey)
            ? year.financialPositionPage
            : year.profitOrLossPage

      return {
        fiscal_year_end: year.fiscalYearEnd,
        line_key: lineKey as StatementLineKey,
        segment: '',
        value: value as number,
        source_page: page,
      }
    })

    const streamRows = (year.revenueStreams ?? []).flatMap((stream) => [
      {
        fiscal_year_end: year.fiscalYearEnd,
        line_key: 'segment_revenue' as const,
        segment: stream.name,
        value: stream.revenue,
        source_page: year.profitOrLossPage,
      },
      ...(stream.directCosts === null
        ? []
        : [
            {
              fiscal_year_end: year.fiscalYearEnd,
              line_key: 'segment_direct_costs' as const,
              segment: stream.name,
              value: stream.directCosts,
              source_page: year.profitOrLossPage,
            },
          ]),
    ])

    return [...lineRows, ...streamRows]
  })
}
