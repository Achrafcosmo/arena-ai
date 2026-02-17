import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://xfrzkferqgzbflwhrqtf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmcnprZmVycWd6YmZsd2hycXRmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDcxNTUzNCwiZXhwIjoyMDg2MjkxNTM0fQ.H5IN56JwoNK9AeNps5rO2jVVeDP9YRMSPiXh5Ipa_60'
)

const COMPETITION_ID = 'ad6bd58d-f2dc-4cf8-8ca7-341b3ff1670c'
const INITIAL_BALANCE = 10000
const TOTAL_CANDLES = 100

// Model configurations with target performance
const MODEL_CONFIGS = [
  {
    id: '45dd47f1-b30c-44d7-a775-f970f960b241',
    name: 'GPT-4o',
    strategy: 'BASELINE',
    finalEquity: 11200,
    winRate: 0.58,
    maxDrawdownPct: 0.08,
    volatility: 0.3,
    tradeCount: 25
  },
  {
    id: 'b9d4052d-9918-4130-adf0-92d84f7b61f3',
    name: 'Claude Sonnet',
    strategy: 'MONK MODE', 
    finalEquity: 10800,
    winRate: 0.65,
    maxDrawdownPct: 0.04,
    volatility: 0.15,
    tradeCount: 20
  },
  {
    id: 'ccefbd07-8700-4034-a81b-5ab6d490cd5a',
    name: 'Grok',
    strategy: 'CONTRARIAN',
    finalEquity: 12500,
    winRate: 0.45,
    maxDrawdownPct: 0.18,
    volatility: 0.8,
    tradeCount: 30
  },
  {
    id: '3f9c9439-6847-469b-87e9-2e87f9e18c29',
    name: 'Claude Opus',
    strategy: 'MAX LEVERAGE',
    finalEquity: 13000,
    winRate: 0.50,
    maxDrawdownPct: 0.25,
    volatility: 0.9,
    tradeCount: 28
  },
  {
    id: 'f94d20c5-7b8d-483c-a11b-ac5f74e4743d',
    name: 'GPT-4o-mini',
    strategy: 'SPEED DEMON',
    finalEquity: 10500,
    winRate: 0.52,
    maxDrawdownPct: 0.06,
    volatility: 0.2,
    tradeCount: 35
  },
  {
    id: 'b9a892e9-42e4-48f5-a614-1f93d378eecc',
    name: 'Claude Haiku',
    strategy: 'QUICK THINKER',
    finalEquity: 10300,
    winRate: 0.55,
    maxDrawdownPct: 0.05,
    volatility: 0.18,
    tradeCount: 22
  },
  {
    id: 'c79b0ab3-6d87-4827-a9f9-568f72c60461',
    name: 'Gemini Pro',
    strategy: 'DEEP ANALYSIS',
    finalEquity: 11500,
    winRate: 0.60,
    maxDrawdownPct: 0.07,
    volatility: 0.25,
    tradeCount: 24
  },
  {
    id: '7a893551-0961-4caf-ac68-df75b9499a8a',
    name: 'Gemini Flash',
    strategy: 'FLASH TRADER',
    finalEquity: 9800,
    winRate: 0.48,
    maxDrawdownPct: 0.09,
    volatility: 0.35,
    tradeCount: 26
  },
  {
    id: '1d5b8254-a91e-40b2-a30c-3a1b72c198c7',
    name: 'DeepSeek V3',
    strategy: 'VALUE HUNTER',
    finalEquity: 11000,
    winRate: 0.57,
    maxDrawdownPct: 0.06,
    volatility: 0.22,
    tradeCount: 23
  },
  {
    id: 'b54c6ff4-b7ba-409e-b389-58c8f46eed5f',
    name: 'GPT-3.5-turbo',
    strategy: 'OLD SCHOOL',
    finalEquity: 9200,
    winRate: 0.42,
    maxDrawdownPct: 0.12,
    volatility: 0.4,
    tradeCount: 27
  }
]

function generateEquityCurve(config) {
  const points = []
  let currentEquity = INITIAL_BALANCE
  const finalTarget = config.finalEquity
  const growthRate = (finalTarget / INITIAL_BALANCE - 1) / TOTAL_CANDLES
  
  // Calculate max drawdown point (around 30-60% through)
  const drawdownStart = Math.floor(TOTAL_CANDLES * 0.3 + Math.random() * 0.3 * TOTAL_CANDLES)
  const drawdownDepth = config.maxDrawdownPct
  
  let maxEquitySoFar = INITIAL_BALANCE
  let actualMaxDrawdown = 0
  
  for (let i = 0; i < TOTAL_CANDLES; i++) {
    let change = 0
    
    // Apply major drawdown period
    if (i >= drawdownStart && i < drawdownStart + 10) {
      change = -config.volatility * (0.5 + Math.random() * 1.0) / 100 * currentEquity
    } else {
      // Normal volatility with trend toward final target
      const trendComponent = growthRate * currentEquity
      const randomComponent = (Math.random() - 0.5) * config.volatility / 100 * currentEquity
      change = trendComponent + randomComponent
    }
    
    currentEquity += change
    
    // Track max drawdown
    if (currentEquity > maxEquitySoFar) {
      maxEquitySoFar = currentEquity
    }
    const currentDrawdown = (maxEquitySoFar - currentEquity) / maxEquitySoFar
    if (currentDrawdown > actualMaxDrawdown) {
      actualMaxDrawdown = currentDrawdown
    }
    
    points.push({
      candle_index: i,
      equity: Math.max(currentEquity, 0), // Prevent negative equity
      timestamp: new Date(Date.now() - (TOTAL_CANDLES - i) * 15 * 60 * 1000).toISOString()
    })
  }
  
  // Adjust final point to match target
  points[points.length - 1].equity = finalTarget
  
  return { points, maxDrawdown: Math.max(actualMaxDrawdown, drawdownDepth) }
}

function generateTrades(config, equityPoints) {
  const trades = []
  const tradeCount = config.tradeCount
  const winCount = Math.round(tradeCount * config.winRate)
  
  for (let i = 0; i < tradeCount; i++) {
    const isWin = i < winCount
    const candleIndex = Math.floor((i + 1) * (TOTAL_CANDLES / tradeCount))
    const side = Math.random() > 0.5 ? 'LONG' : 'SHORT'
    const leverage = Math.floor(1 + Math.random() * 4) // 1-5x leverage
    
    // Entry trade
    trades.push({
      candle_index: Math.max(0, candleIndex - 2),
      action: side,
      leverage: leverage,
      reason: `${config.strategy} signal detected`,
      timestamp: new Date(Date.now() - (TOTAL_CANDLES - candleIndex + 2) * 15 * 60 * 1000).toISOString()
    })
    
    // Close trade after 1-5 candles
    const closeIndex = Math.min(TOTAL_CANDLES - 1, candleIndex + Math.floor(1 + Math.random() * 4))
    trades.push({
      candle_index: closeIndex,
      action: 'CLOSE',
      leverage: 1,
      reason: isWin ? 'Take profit' : 'Stop loss',
      timestamp: new Date(Date.now() - (TOTAL_CANDLES - closeIndex) * 15 * 60 * 1000).toISOString()
    })
  }
  
  return trades.sort((a, b) => a.candle_index - b.candle_index)
}

async function seedDemoData() {
  console.log('🚀 Starting Arena AI demo data seeding...')
  
  try {
    // 1. Create the demo run
    console.log('📊 Creating demo run...')
    const runData = {
      id: crypto.randomUUID(),
      competition_id: COMPETITION_ID,
      status: 'completed',
      current_candle_index: TOTAL_CANDLES,
      total_candles: TOTAL_CANDLES,
      started_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 24 hours ago
      completed_at: new Date().toISOString()
    }
    
    const { error: runError } = await supabase
      .from('arena_runs')
      .insert(runData)
    
    if (runError) throw runError
    console.log('✅ Demo run created:', runData.id)
    
    // 2. Create model run states, equity snapshots, and trades
    for (const config of MODEL_CONFIGS) {
      console.log(`🤖 Processing ${config.name}...`)
      
      // Generate equity curve and trades
      const { points: equityPoints, maxDrawdown } = generateEquityCurve(config)
      const trades = generateTrades(config, equityPoints)
      
      const finalEquity = config.finalEquity
      const realizedPnl = finalEquity - INITIAL_BALANCE
      const totalTrades = trades.filter(t => t.action === 'CLOSE').length
      const winningTrades = Math.round(totalTrades * config.winRate)
      
      // Create model run state
      const modelState = {
        run_id: runData.id,
        model_id: config.id,
        equity: finalEquity,
        balance: finalEquity, // Assuming no open position
        unrealized_pnl: 0,
        realized_pnl: realizedPnl,
        total_trades: totalTrades,
        winning_trades: winningTrades,
        max_drawdown: maxDrawdown,
        position_side: 'none',
        position_leverage: 1,
        updated_at: new Date().toISOString()
      }
      
      const { error: stateError } = await supabase
        .from('arena_model_run_state')
        .insert(modelState)
      
      if (stateError) throw stateError
      
      // Create equity snapshots in batches
      const equitySnapshots = equityPoints.map(point => ({
        run_id: runData.id,
        model_id: config.id,
        candle_index: point.candle_index,
        equity: point.equity,
        balance: point.equity, // For demo, assume no open positions
        unrealized_pnl: 0
      }))
      
      // Insert in batches of 20
      for (let i = 0; i < equitySnapshots.length; i += 20) {
        const batch = equitySnapshots.slice(i, i + 20)
        const { error: snapshotError } = await supabase
          .from('arena_equity_snapshots')
          .insert(batch)
        
        if (snapshotError) throw snapshotError
      }
      
      // Create trades
      const tradeRecords = trades.map(trade => ({
        run_id: runData.id,
        model_id: config.id,
        candle_index: trade.candle_index,
        action: trade.action,
        leverage: trade.leverage,
        reason: trade.reason,
        entry_price: 45000 + Math.random() * 10000, // Random BTC price around 45-55k
        fee: Math.random() * 50,
        size_pct: 0.1 + Math.random() * 0.4, // 10-50% position size
        pnl: trade.action === 'CLOSE' ? (Math.random() - 0.5) * 1000 : null,
        raw_response: JSON.stringify({ action: trade.action, leverage: trade.leverage, reason: trade.reason })
      }))
      
      if (tradeRecords.length > 0) {
        const { error: tradesError } = await supabase
          .from('arena_trades')
          .insert(tradeRecords)
        
        if (tradesError) throw tradesError
      }
      
      console.log(`✅ ${config.name}: ${totalTrades} trades, ${winningTrades} wins (${(config.winRate * 100).toFixed(1)}%), final equity: $${finalEquity.toLocaleString()}`)
    }
    
    console.log('🎉 Demo data seeding completed successfully!')
    console.log(`🔗 Run ID: ${runData.id}`)
    console.log(`🏆 Competition ID: ${COMPETITION_ID}`)
    
  } catch (error) {
    console.error('❌ Error seeding demo data:', error)
    process.exit(1)
  }
}

seedDemoData()