import { getSupabaseAdmin } from '@/lib/supabase'
import { ModelProvider } from './providers'
import { fetchCandles, CandleData } from './market-data'
import { calculateMetrics } from './metrics'

export interface ModelState {
  id: string
  balance: number
  equity: number
  position_side: 'none' | 'long' | 'short'
  position_size: number
  position_entry_price?: number
  position_leverage: number
  unrealized_pnl: number
  realized_pnl: number
  total_trades: number
  winning_trades: number
  max_drawdown: number
  peak_equity: number
}

export interface TradeDecision {
  action: 'LONG' | 'SHORT' | 'CLOSE' | 'HOLD'
  leverage: number
  size_pct: number
  reason: string
}

export interface SimulationConfig {
  competition_id: string
  market: string
  timeframe: string
  initial_balance: number
  max_leverage: number
  fee_rate: number
  slippage_rate: number
  liquidation_threshold: number
}

export class SimulationEngine {
  private config: SimulationConfig
  private candles: CandleData[] = []
  private modelStates: Map<string, ModelState> = new Map()
  private currentCandleIndex = 0
  private runId: string

  constructor(config: SimulationConfig, runId: string) {
    this.config = config
    this.runId = runId
  }

  async initialize(models: { id: string; provider: string; model_id: string; base_url?: string }[]) {
    // Fetch market data
    this.candles = await fetchCandles(this.config.market, this.config.timeframe, 1000)
    
    // Initialize model states
    models.forEach(model => {
      this.modelStates.set(model.id, {
        id: model.id,
        balance: this.config.initial_balance,
        equity: this.config.initial_balance,
        position_side: 'none',
        position_size: 0,
        position_leverage: 1,
        unrealized_pnl: 0,
        realized_pnl: 0,
        total_trades: 0,
        winning_trades: 0,
        max_drawdown: 0,
        peak_equity: this.config.initial_balance
      })
    })

    // Update run with total candles
    await getSupabaseAdmin()
      .from('arena_runs')
      .update({ 
        total_candles: this.candles.length,
        started_at: new Date().toISOString(),
        status: 'running'
      })
      .eq('id', this.runId)

    return this.candles.length
  }

  async processCandle(candleIndex: number, models: any[]): Promise<void> {
    if (candleIndex >= this.candles.length) {
      return
    }

    this.currentCandleIndex = candleIndex
    const currentCandle = this.candles[candleIndex]
    const historicalCandles = this.candles.slice(Math.max(0, candleIndex - 199), candleIndex + 1)

    // Process each model
    const promises = models.map(async (model) => {
      const state = this.modelStates.get(model.id)
      if (!state) return

      try {
        // Get AI decision
        const decision = await this.getModelDecision(model, state, currentCandle, historicalCandles)
        
        // Execute trade
        await this.executeTrade(model.id, decision, currentCandle)
        
        // Update equity and check liquidation
        this.updateEquity(model.id, currentCandle.close)
        
        // Record trade and equity snapshot
        await this.recordTrade(model.id, candleIndex, decision, currentCandle)
        await this.recordEquitySnapshot(model.id, candleIndex)
        
      } catch (error) {
        console.error(`Error processing model ${model.id}:`, error)
        
        // Log error
        await getSupabaseAdmin().from('arena_logs').insert({
          run_id: this.runId,
          model_id: model.id,
          level: 'error',
          message: `Error processing candle ${candleIndex}: ${error}`,
          metadata: { candleIndex, error: String(error) }
        })
      }
    })

    await Promise.all(promises)
    
    // Update run progress
    await getSupabaseAdmin()
      .from('arena_runs')
      .update({ current_candle_index: candleIndex })
      .eq('id', this.runId)

    // Batch update model states to database
    await this.updateModelStates()
  }

  private async getModelDecision(
    model: any,
    state: ModelState,
    currentCandle: CandleData,
    historicalCandles: CandleData[]
  ): Promise<TradeDecision> {
    try {
      const provider = new ModelProvider(model.provider, model.model_id, model.base_url)
      
      const marketData = {
        current_price: currentCandle.close,
        candles: historicalCandles.map(c => ({
          timestamp: c.timestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume
        }))
      }

      const accountState = {
        balance: state.balance,
        equity: state.equity,
        position_side: state.position_side,
        position_size: state.position_size,
        position_entry_price: state.position_entry_price,
        position_leverage: state.position_leverage,
        unrealized_pnl: state.unrealized_pnl,
        realized_pnl: state.realized_pnl,
        total_trades: state.total_trades,
        winning_trades: state.winning_trades
      }

      const decision = await provider.getTradeDecision(marketData, accountState, this.config)
      
      // Validate and sanitize decision
      return this.validateDecision(decision)
      
    } catch (error) {
      console.error(`Model decision error for ${model.id}:`, error)
      return { action: 'HOLD', leverage: 1, size_pct: 0, reason: 'AI Error - HOLD' }
    }
  }

  private validateDecision(decision: any): TradeDecision {
    const validActions = ['LONG', 'SHORT', 'CLOSE', 'HOLD']
    
    return {
      action: validActions.includes(decision.action) ? decision.action : 'HOLD',
      leverage: Math.min(Math.max(1, Math.floor(decision.leverage || 1)), this.config.max_leverage),
      size_pct: Math.min(Math.max(0, parseFloat(decision.size_pct || 0)), 1),
      reason: String(decision.reason || 'No reason provided').slice(0, 500)
    }
  }

  private async executeTrade(modelId: string, decision: TradeDecision, candle: CandleData): Promise<void> {
    const state = this.modelStates.get(modelId)!
    
    if (decision.action === 'HOLD') {
      return
    }

    const currentPrice = candle.close
    
    if (decision.action === 'CLOSE' && state.position_side !== 'none') {
      // Close existing position
      const pnl = this.calculatePnL(state, currentPrice)
      const fee = Math.abs(state.position_size) * currentPrice * this.config.fee_rate
      
      state.balance += pnl - fee
      state.realized_pnl += pnl - fee
      
      if (pnl > 0) {
        state.winning_trades++
      }
      
      // Reset position
      state.position_side = 'none'
      state.position_size = 0
      state.position_entry_price = undefined
      state.position_leverage = 1
      state.total_trades++
      
    } else if ((decision.action === 'LONG' || decision.action === 'SHORT') && decision.size_pct > 0) {
      // Close existing position first if opposite direction
      if (state.position_side !== 'none' && 
          ((state.position_side === 'long' && decision.action === 'SHORT') ||
           (state.position_side === 'short' && decision.action === 'LONG'))) {
        const pnl = this.calculatePnL(state, currentPrice)
        const closeFee = Math.abs(state.position_size) * currentPrice * this.config.fee_rate
        
        state.balance += pnl - closeFee
        state.realized_pnl += pnl - closeFee
        
        if (pnl > 0) {
          state.winning_trades++
        }
        
        state.total_trades++
      }
      
      // Open new position
      const leverage = decision.leverage
      const sizePct = Math.min(decision.size_pct, 1)
      const positionValue = state.balance * sizePct * leverage
      const positionSize = positionValue / currentPrice
      const fee = positionValue * this.config.fee_rate
      const slippage = positionValue * this.config.slippage_rate
      
      // Apply slippage
      const executionPrice = decision.action === 'LONG' 
        ? currentPrice * (1 + this.config.slippage_rate)
        : currentPrice * (1 - this.config.slippage_rate)
      
      state.balance -= fee + slippage
      state.position_side = decision.action === 'LONG' ? 'long' : 'short'
      state.position_size = decision.action === 'LONG' ? positionSize : -positionSize
      state.position_entry_price = executionPrice
      state.position_leverage = leverage
      
      // Increment trades when opening a new position (not already in a position)
      state.total_trades++
    }
  }

  private calculatePnL(state: ModelState, currentPrice: number): number {
    if (state.position_side === 'none' || !state.position_entry_price) {
      return 0
    }
    
    const priceDiff = currentPrice - state.position_entry_price
    return state.position_size * priceDiff
  }

  private updateEquity(modelId: string, currentPrice: number): void {
    const state = this.modelStates.get(modelId)!
    
    // Calculate unrealized PnL
    state.unrealized_pnl = this.calculatePnL(state, currentPrice)
    
    // Update equity
    state.equity = state.balance + state.unrealized_pnl
    
    // Update peak equity and max drawdown
    if (state.equity > state.peak_equity) {
      state.peak_equity = state.equity
    }
    
    const drawdown = (state.peak_equity - state.equity) / state.peak_equity
    if (drawdown > state.max_drawdown) {
      state.max_drawdown = drawdown
    }
    
    // Check for liquidation
    if (state.equity <= state.peak_equity * (1 - this.config.liquidation_threshold)) {
      // Force close position
      if (state.position_side !== 'none') {
        state.balance += state.unrealized_pnl
        state.realized_pnl += state.unrealized_pnl
        state.position_side = 'none'
        state.position_size = 0
        state.position_entry_price = undefined
        state.position_leverage = 1
        state.unrealized_pnl = 0
        state.equity = state.balance
        state.total_trades++
      }
    }
  }

  private async recordTrade(modelId: string, candleIndex: number, decision: TradeDecision, candle: CandleData): Promise<void> {
    if (decision.action === 'HOLD') return
    
    const state = this.modelStates.get(modelId)!
    
    await getSupabaseAdmin().from('arena_trades').insert({
      run_id: this.runId,
      model_id: modelId,
      candle_index: candleIndex,
      action: decision.action,
      leverage: decision.leverage,
      size_pct: decision.size_pct,
      entry_price: candle.close,
      pnl: decision.action === 'CLOSE' ? state.realized_pnl : null,
      fee: Math.abs(state.position_size) * candle.close * this.config.fee_rate,
      reason: decision.reason,
      raw_response: decision
    })
  }

  private async recordEquitySnapshot(modelId: string, candleIndex: number): Promise<void> {
    const state = this.modelStates.get(modelId)!
    
    await getSupabaseAdmin().from('arena_equity_snapshots').insert({
      run_id: this.runId,
      model_id: modelId,
      candle_index: candleIndex,
      equity: state.equity,
      balance: state.balance,
      unrealized_pnl: state.unrealized_pnl
    })
  }

  private async updateModelStates(): Promise<void> {
    const updates = Array.from(this.modelStates.entries()).map(([modelId, state]) => ({
      run_id: this.runId,
      model_id: modelId,
      balance: state.balance,
      equity: state.equity,
      position_side: state.position_side,
      position_size: state.position_size,
      position_entry_price: state.position_entry_price,
      position_leverage: state.position_leverage,
      unrealized_pnl: state.unrealized_pnl,
      realized_pnl: state.realized_pnl,
      total_trades: state.total_trades,
      winning_trades: state.winning_trades,
      max_drawdown: state.max_drawdown,
      peak_equity: state.peak_equity,
      updated_at: new Date().toISOString()
    }))

    // Upsert all model states
    for (const update of updates) {
      await getSupabaseAdmin()
        .from('arena_model_run_state')
        .upsert(update, { 
          onConflict: 'run_id,model_id'
        })
    }
  }

  async complete(): Promise<void> {
    await getSupabaseAdmin()
      .from('arena_runs')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', this.runId)
  }

  getModelStates(): Map<string, ModelState> {
    return new Map(this.modelStates)
  }
}