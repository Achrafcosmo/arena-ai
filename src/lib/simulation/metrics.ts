import { ModelState } from './engine'

export interface PerformanceMetrics {
  totalReturn: number // Percentage
  totalReturnUSD: number // USD amount
  sharpeRatio: number
  maxDrawdown: number // Percentage
  winRate: number // Percentage
  totalTrades: number
  winningTrades: number
  losingTrades: number
  averageWin: number
  averageLoss: number
  profitFactor: number
  calmarRatio: number
  sortinoRatio: number
  volatility: number
  finalEquity: number
  peakEquity: number
  currentDrawdown: number
}

export interface EquityPoint {
  timestamp: number
  equity: number
  balance: number
  unrealized_pnl: number
}

export function calculateMetrics(
  modelState: ModelState,
  equityHistory: EquityPoint[],
  initialBalance: number,
  trades?: any[]
): PerformanceMetrics {
  // Basic returns
  const totalReturnUSD = modelState.equity - initialBalance
  const totalReturn = (totalReturnUSD / initialBalance) * 100

  // Win rate
  const winRate = modelState.total_trades > 0 
    ? (modelState.winning_trades / modelState.total_trades) * 100 
    : 0
  
  const losingTrades = modelState.total_trades - modelState.winning_trades

  // Trade analysis
  let totalWins = 0
  let totalLosses = 0
  let averageWin = 0
  let averageLoss = 0
  let profitFactor = 0

  if (trades && trades.length > 0) {
    const completedTrades = trades.filter(t => t.pnl !== null && t.pnl !== undefined)
    const winningTrades = completedTrades.filter(t => t.pnl > 0)
    const losingTrades = completedTrades.filter(t => t.pnl <= 0)
    
    totalWins = winningTrades.reduce((sum, t) => sum + t.pnl, 0)
    totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0))
    
    averageWin = winningTrades.length > 0 ? totalWins / winningTrades.length : 0
    averageLoss = losingTrades.length > 0 ? totalLosses / losingTrades.length : 0
    
    profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0
  }

  // Volatility and risk metrics
  const returns = calculateReturns(equityHistory)
  const volatility = calculateVolatility(returns)
  const riskFreeRate = 0.02 // 2% risk-free rate assumption
  
  // Sharpe Ratio
  const averageReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length
  const annualizedReturn = averageReturn * 365 * 24 // Assuming hourly data
  const annualizedVolatility = volatility * Math.sqrt(365 * 24)
  const sharpeRatio = annualizedVolatility > 0 
    ? (annualizedReturn - riskFreeRate) / annualizedVolatility 
    : 0

  // Sortino Ratio (using downside deviation)
  const downsidevols = returns.filter(ret => ret < 0)
  const downsideVolatility = Math.sqrt(
    downsidevols.reduce((sum, ret) => sum + ret * ret, 0) / downsidevols.length
  ) * Math.sqrt(365 * 24)
  const sortinoRatio = downsideVolatility > 0 
    ? (annualizedReturn - riskFreeRate) / downsideVolatility 
    : 0

  // Calmar Ratio
  const calmarRatio = modelState.max_drawdown > 0 
    ? Math.abs(annualizedReturn) / (modelState.max_drawdown * 100)
    : 0

  // Current drawdown
  const currentDrawdown = modelState.peak_equity > 0 
    ? ((modelState.peak_equity - modelState.equity) / modelState.peak_equity) * 100
    : 0

  return {
    totalReturn: Number(totalReturn.toFixed(2)),
    totalReturnUSD: Number(totalReturnUSD.toFixed(2)),
    sharpeRatio: Number(sharpeRatio.toFixed(3)),
    maxDrawdown: Number((modelState.max_drawdown * 100).toFixed(2)),
    winRate: Number(winRate.toFixed(2)),
    totalTrades: modelState.total_trades,
    winningTrades: modelState.winning_trades,
    losingTrades,
    averageWin: Number(averageWin.toFixed(2)),
    averageLoss: Number(averageLoss.toFixed(2)),
    profitFactor: Number(profitFactor.toFixed(3)),
    calmarRatio: Number(calmarRatio.toFixed(3)),
    sortinoRatio: Number(sortinoRatio.toFixed(3)),
    volatility: Number((annualizedVolatility * 100).toFixed(2)),
    finalEquity: Number(modelState.equity.toFixed(2)),
    peakEquity: Number(modelState.peak_equity.toFixed(2)),
    currentDrawdown: Number(currentDrawdown.toFixed(2))
  }
}

function calculateReturns(equityHistory: EquityPoint[]): number[] {
  const returns: number[] = []
  
  for (let i = 1; i < equityHistory.length; i++) {
    const prevEquity = equityHistory[i - 1].equity
    const currentEquity = equityHistory[i].equity
    
    if (prevEquity > 0) {
      const ret = (currentEquity - prevEquity) / prevEquity
      returns.push(ret)
    }
  }
  
  return returns
}

function calculateVolatility(returns: number[]): number {
  if (returns.length < 2) return 0
  
  const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length
  const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / (returns.length - 1)
  
  return Math.sqrt(variance)
}

export function calculateMaxDrawdown(equityHistory: EquityPoint[]): { maxDrawdown: number; maxDrawdownPeriod: [number, number] } {
  let maxDrawdown = 0
  let peak = 0
  let peakIndex = 0
  let troughIndex = 0
  let maxDrawdownPeriod: [number, number] = [0, 0]
  
  equityHistory.forEach((point, index) => {
    if (point.equity > peak) {
      peak = point.equity
      peakIndex = index
    }
    
    const drawdown = (peak - point.equity) / peak
    
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown
      troughIndex = index
      maxDrawdownPeriod = [peakIndex, troughIndex]
    }
  })
  
  return {
    maxDrawdown: maxDrawdown * 100, // Convert to percentage
    maxDrawdownPeriod
  }
}

export function calculatePerformanceRank(metrics: PerformanceMetrics[]): PerformanceMetrics[] {
  return metrics.map(metric => ({ ...metric })).sort((a, b) => {
    // Primary sort: Total return
    if (Math.abs(b.totalReturn - a.totalReturn) > 0.01) {
      return b.totalReturn - a.totalReturn
    }
    
    // Secondary sort: Sharpe ratio
    if (Math.abs(b.sharpeRatio - a.sharpeRatio) > 0.001) {
      return b.sharpeRatio - a.sharpeRatio
    }
    
    // Tertiary sort: Max drawdown (lower is better)
    return a.maxDrawdown - b.maxDrawdown
  })
}

export function calculateRiskScore(metrics: PerformanceMetrics): number {
  // Risk score from 0 (low risk) to 100 (high risk)
  let score = 0
  
  // Max drawdown component (0-40 points)
  score += Math.min(metrics.maxDrawdown * 0.8, 40)
  
  // Volatility component (0-30 points)
  score += Math.min(metrics.volatility * 0.3, 30)
  
  // Win rate component (0-20 points, inverted - low win rate = high risk)
  score += Math.max(0, 20 - (metrics.winRate * 0.2))
  
  // Sharpe ratio component (0-10 points, inverted - low Sharpe = high risk)
  const sharpeComponent = metrics.sharpeRatio > 0 
    ? Math.max(0, 10 - (metrics.sharpeRatio * 5))
    : 10
  score += sharpeComponent
  
  return Math.min(Math.round(score), 100)
}

export function getPerformanceGrade(metrics: PerformanceMetrics): 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F' {
  const return_score = Math.max(0, metrics.totalReturn)
  const risk_score = calculateRiskScore(metrics)
  const sharpe_score = Math.max(0, metrics.sharpeRatio * 20)
  
  // Composite score weighted by return (40%), risk (35%), and risk-adjusted return (25%)
  const composite = (return_score * 0.4) + ((100 - risk_score) * 0.35) + (sharpe_score * 0.25)
  
  if (composite >= 90) return 'A+'
  if (composite >= 80) return 'A'
  if (composite >= 70) return 'B+'
  if (composite >= 60) return 'B'
  if (composite >= 50) return 'C+'
  if (composite >= 40) return 'C'
  if (composite >= 30) return 'D'
  return 'F'
}

// Portfolio-level metrics for comparing multiple models
export function calculatePortfolioMetrics(allMetrics: PerformanceMetrics[]): {
  averageReturn: number
  bestPerformer: number
  worstPerformer: number
  correlation: number
  diversificationBenefit: number
} {
  if (allMetrics.length === 0) {
    return {
      averageReturn: 0,
      bestPerformer: 0,
      worstPerformer: 0,
      correlation: 0,
      diversificationBenefit: 0
    }
  }
  
  const returns = allMetrics.map(m => m.totalReturn)
  const averageReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length
  const bestPerformer = Math.max(...returns)
  const worstPerformer = Math.min(...returns)
  
  // Simple correlation approximation (would need actual time series for proper calculation)
  const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - averageReturn, 2), 0) / returns.length
  const correlation = variance > 0 ? Math.min(variance / (bestPerformer - worstPerformer), 1) : 0
  
  // Diversification benefit (reduction in portfolio volatility vs average individual volatility)
  const avgVolatility = allMetrics.reduce((sum, m) => sum + m.volatility, 0) / allMetrics.length
  const portfolioVolatility = Math.sqrt(variance) // Approximation
  const diversificationBenefit = avgVolatility > 0 ? (1 - portfolioVolatility / avgVolatility) * 100 : 0
  
  return {
    averageReturn: Number(averageReturn.toFixed(2)),
    bestPerformer: Number(bestPerformer.toFixed(2)),
    worstPerformer: Number(worstPerformer.toFixed(2)),
    correlation: Number(correlation.toFixed(3)),
    diversificationBenefit: Number(Math.max(0, diversificationBenefit).toFixed(2))
  }
}