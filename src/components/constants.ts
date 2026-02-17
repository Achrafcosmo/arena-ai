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
