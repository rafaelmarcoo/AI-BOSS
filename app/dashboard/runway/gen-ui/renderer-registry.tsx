"use client";

import type { ComponentType } from "react";
import type {
  GenUiWidgetByType,
  GenUiWidgetType,
} from "@/lib/gen-ui/types";
import type { GenUiWidgetInteractionProps } from "./types";
import { DataConnectionsWidgetView } from "./widgets/existing/DataConnectionsWidget";
import {
  MetricForecastChartWidgetView,
  MetricSnapshotWidgetView,
  MetricSourceEvidenceWidgetView,
  MetricTrendChartWidgetView,
} from "./widgets/existing/MetricWidgets";
import {
  HighlightExplainerWidgetView,
  MissingDataPanelWidgetView,
  PlanningChecklistWidgetView,
  RiskThresholdTimelineWidgetView,
} from "./widgets/existing/PlanningWidgets";
import {
  ScenarioAnalysisWidgetView,
  ScenarioComparisonWidgetView,
} from "./widgets/existing/ScenarioWidgets";
import {
  AccountsPayableWidgetView,
  AccountsReceivableWidgetView,
  AiFinancialBriefWidgetView,
  CashBalanceWidgetView,
  ExpenseSummaryWidgetView,
  ExpenseTrendWidgetView,
  RevenueGrowthWidgetView,
  RevenueSnapshotWidgetView,
  RevenueTrendWidgetView,
} from "./widgets/existing-data/ExistingDataWidgets";
import {
  BreakEvenAnalysisWidgetView,
  BreakEvenProgressWidgetView,
  BudgetForecastWidgetView,
  BudgetRemainingWidgetView,
  BudgetVsActualWidgetView,
  CashFlowForecastWidgetView,
  CashFlowSummaryWidgetView,
  CashInflowForecastWidgetView,
  CashOutflowForecastWidgetView,
  ExpenseBreakdownWidgetView,
  ExpenseChangeDetectorWidgetView,
  LargestExpensesWidgetView,
  ProfitForecastWidgetView,
  ProfitMarginWidgetView,
  ProfitSnapshotWidgetView,
  ProfitTrendWidgetView,
  RevenueForecastWidgetView,
} from "./widgets/stage3/Stage3Widgets";
import {
  BillsDueWidgetView,
  ExpectedPaymentsWidgetView,
  InvoiceAgeingWidgetView,
  OverdueInvoicesWidgetView,
} from "./widgets/stage4/Stage4Widgets";
import {
  AssetSummaryWidgetView,
  CurrentRatioWidgetView,
  DebtOverviewWidgetView,
  DebtRepaymentTimelineWidgetView,
  EquitySnapshotWidgetView,
  LiabilitySummaryWidgetView,
  QuickRatioWidgetView,
  WorkingCapitalWidgetView,
} from "./widgets/stage5/Stage5Widgets";

export type GenUiRendererProps<Type extends GenUiWidgetType> =
  GenUiWidgetInteractionProps & {
    widget: GenUiWidgetByType[Type];
  };

type GenUiRendererRegistry = {
  [Type in GenUiWidgetType]: ComponentType<GenUiRendererProps<Type>>;
};

export const GEN_UI_RENDERER_REGISTRY = {
  metric_snapshot: MetricSnapshotWidgetView,
  data_connections: DataConnectionsWidgetView,
  metric_trend_chart: MetricTrendChartWidgetView,
  metric_forecast_chart: MetricForecastChartWidgetView,
  scenario_comparison: ScenarioComparisonWidgetView,
  scenario_analysis: ScenarioAnalysisWidgetView,
  planning_checklist: PlanningChecklistWidgetView,
  risk_threshold_timeline: RiskThresholdTimelineWidgetView,
  metric_source_evidence: MetricSourceEvidenceWidgetView,
  missing_data_panel: MissingDataPanelWidgetView,
  highlight_explainer: HighlightExplainerWidgetView,
  cash_balance: CashBalanceWidgetView,
  revenue_snapshot: RevenueSnapshotWidgetView,
  revenue_trend: RevenueTrendWidgetView,
  revenue_growth: RevenueGrowthWidgetView,
  expense_summary: ExpenseSummaryWidgetView,
  expense_trend: ExpenseTrendWidgetView,
  accounts_receivable: AccountsReceivableWidgetView,
  accounts_payable: AccountsPayableWidgetView,
  ai_financial_brief: AiFinancialBriefWidgetView,
  cash_flow_summary: CashFlowSummaryWidgetView,
  cash_flow_forecast: CashFlowForecastWidgetView,
  revenue_forecast: RevenueForecastWidgetView,
  profit_snapshot: ProfitSnapshotWidgetView,
  profit_trend: ProfitTrendWidgetView,
  profit_forecast: ProfitForecastWidgetView,
  profit_margin: ProfitMarginWidgetView,
  break_even_analysis: BreakEvenAnalysisWidgetView,
  break_even_progress: BreakEvenProgressWidgetView,
  expense_breakdown: ExpenseBreakdownWidgetView,
  largest_expenses: LargestExpensesWidgetView,
  expense_change_detector: ExpenseChangeDetectorWidgetView,
  budget_vs_actual: BudgetVsActualWidgetView,
  budget_remaining: BudgetRemainingWidgetView,
  budget_forecast: BudgetForecastWidgetView,
  cash_inflow_forecast: CashInflowForecastWidgetView,
  cash_outflow_forecast: CashOutflowForecastWidgetView,
  overdue_invoices: OverdueInvoicesWidgetView,
  invoice_ageing: InvoiceAgeingWidgetView,
  expected_payments: ExpectedPaymentsWidgetView,
  bills_due: BillsDueWidgetView,
  working_capital: WorkingCapitalWidgetView,
  current_ratio: CurrentRatioWidgetView,
  quick_ratio: QuickRatioWidgetView,
  asset_summary: AssetSummaryWidgetView,
  liability_summary: LiabilitySummaryWidgetView,
  equity_snapshot: EquitySnapshotWidgetView,
  debt_overview: DebtOverviewWidgetView,
  debt_repayment_timeline: DebtRepaymentTimelineWidgetView,
} satisfies GenUiRendererRegistry;
