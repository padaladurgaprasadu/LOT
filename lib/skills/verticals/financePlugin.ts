/**
 * Financial Services Vertical Plugin
 * Inspired by https://github.com/anthropics/financial-services
 */

export interface FinancialMetric {
  name: string;
  value: string | number;
  status: "healthy" | "warning" | "critical";
  benchmark: string;
}

export function generateFinancialAnalysis(revenue: number, netIncome: number, ebitda: number, debt: number): {
  netMargin: string;
  ebitdaMargin: string;
  debtToEbitda: string;
  metrics: FinancialMetric[];
} {
  const netMarginVal = (netIncome / revenue) * 100;
  const ebitdaMarginVal = (ebitda / revenue) * 100;
  const leverageVal = debt / (ebitda || 1);

  return {
    netMargin: `${netMarginVal.toFixed(1)}%`,
    ebitdaMargin: `${ebitdaMarginVal.toFixed(1)}%`,
    debtToEbitda: `${leverageVal.toFixed(2)}x`,
    metrics: [
      {
        name: "Net Profit Margin",
        value: `${netMarginVal.toFixed(1)}%`,
        status: netMarginVal > 15 ? "healthy" : netMarginVal > 5 ? "warning" : "critical",
        benchmark: "> 15.0%",
      },
      {
        name: "EBITDA Margin",
        value: `${ebitdaMarginVal.toFixed(1)}%`,
        status: ebitdaMarginVal > 20 ? "healthy" : "warning",
        benchmark: "> 20.0%",
      },
      {
        name: "Debt / EBITDA Leverage",
        value: `${leverageVal.toFixed(2)}x`,
        status: leverageVal < 3.0 ? "healthy" : "warning",
        benchmark: "< 3.00x",
      },
    ],
  };
}
