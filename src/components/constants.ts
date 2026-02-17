export const MODEL_COLORS: Record<string, string> = {
  openai: '#10b981',
  anthropic: '#3b82f6',
  google: '#ef4444',
  xai: '#a855f7',
  deepseek: '#6366f1',
  meta: '#f97316',
  mistral: '#06b6d4',
  alibaba: '#ec4899',
  custom: '#6b7280',
}

export function getModelColor(provider: string): string {
  return MODEL_COLORS[provider] || MODEL_COLORS.custom
}

// Unique colors for chart lines so same-provider models are distinguishable
const CHART_PALETTE = [
  '#10b981', '#3b82f6', '#ef4444', '#a855f7', '#f97316',
  '#06b6d4', '#ec4899', '#eab308', '#22d3ee', '#f43f5e',
  '#84cc16', '#8b5cf6', '#14b8a6', '#fb923c', '#e879f9',
  '#38bdf8', '#a3e635', '#c084fc', '#fbbf24', '#4ade80',
]

const STROKE_DASHES = [
  '', '8 4', '4 4', '12 4 4 4', '2 4', '', '8 4', '4 4', '12 4 4 4', '2 4',
  '', '8 4', '4 4', '12 4 4 4', '2 4', '', '8 4', '4 4', '12 4 4 4', '2 4',
]

export function getChartColor(index: number): string {
  return CHART_PALETTE[index % CHART_PALETTE.length]
}

export function getChartDash(index: number): string {
  return STROKE_DASHES[index % STROKE_DASHES.length]
}
