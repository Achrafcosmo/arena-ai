import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { SimulationEngine } from '@/lib/simulation/engine'

export async function POST(request: NextRequest) {
  try {
    const { competitionId } = await request.json()
    
    if (!competitionId) {
      return NextResponse.json({ error: 'Competition ID is required' }, { status: 400 })
    }
    
    // Get competition details
    const { data: competition, error: competitionError } = await getSupabaseAdmin()
      .from('arena_competitions')
      .select('*')
      .eq('id', competitionId)
      .single()
    
    if (competitionError || !competition) {
      return NextResponse.json({ error: 'Competition not found' }, { status: 404 })
    }
    
    // Get participating models
    const { data: competitionModels, error: modelsError } = await getSupabaseAdmin()
      .from('arena_competition_models')
      .select(`
        model_id,
        model:arena_models(*)
      `)
      .eq('competition_id', competitionId)
    
    if (modelsError) {
      return NextResponse.json({ error: 'Failed to fetch models' }, { status: 500 })
    }
    
    const models = competitionModels
      ?.map(cm => (cm as any).model)
      .filter(model => model && model.enabled)
    
    if (!models || models.length === 0) {
      return NextResponse.json({ error: 'No enabled models found for this competition' }, { status: 400 })
    }
    
    // Create new run
    const { data: run, error: runError } = await getSupabaseAdmin()
      .from('arena_runs')
      .insert({
        competition_id: competitionId,
        status: 'pending'
      })
      .select()
      .single()
    
    if (runError || !run) {
      return NextResponse.json({ error: 'Failed to create run' }, { status: 500 })
    }
    
    // Start simulation in background
    setImmediate(async () => {
      await runSimulation(run.id, competition, models)
    })
    
    return NextResponse.json({ 
      success: true, 
      runId: run.id,
      message: 'Simulation started'
    })
    
  } catch (error) {
    console.error('Error starting simulation:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: String(error)
    }, { status: 500 })
  }
}

async function runSimulation(runId: string, competition: any, models: any[]) {
  console.log(`Starting simulation ${runId} for competition ${competition.name}`)
  
  try {
    // Initialize simulation engine
    const engine = new SimulationEngine({
      competition_id: competition.id,
      market: competition.market,
      timeframe: competition.timeframe,
      initial_balance: competition.initial_balance,
      max_leverage: competition.max_leverage,
      fee_rate: competition.fee_rate,
      slippage_rate: competition.slippage_rate,
      liquidation_threshold: competition.liquidation_threshold
    }, runId)
    
    // Initialize with models
    const totalCandles = await engine.initialize(models)
    console.log(`Initialized simulation with ${totalCandles} candles`)
    
    // Initialize model states in database
    for (const model of models) {
      await getSupabaseAdmin().from('arena_model_run_state').insert({
        run_id: runId,
        model_id: model.id,
        balance: competition.initial_balance,
        equity: competition.initial_balance,
        position_side: 'none',
        position_size: 0,
        position_leverage: 1,
        unrealized_pnl: 0,
        realized_pnl: 0,
        total_trades: 0,
        winning_trades: 0,
        max_drawdown: 0,
        peak_equity: competition.initial_balance
      })
    }
    
    // Process each candle
    for (let i = 0; i < totalCandles; i++) {
      // Check if run was stopped
      const { data: currentRun } = await getSupabaseAdmin()
        .from('arena_runs')
        .select('status')
        .eq('id', runId)
        .single()
      
      if (currentRun?.status !== 'running') {
        console.log(`Simulation ${runId} was stopped`)
        return
      }
      
      await engine.processCandle(i, models)
      
      // Add small delay to prevent overwhelming the system
      if (i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      
      // Log progress every 50 candles
      if (i % 50 === 0) {
        console.log(`Simulation ${runId}: processed ${i + 1}/${totalCandles} candles (${((i + 1) / totalCandles * 100).toFixed(1)}%)`)
      }
    }
    
    // Complete simulation
    await engine.complete()
    console.log(`Simulation ${runId} completed successfully`)
    
    // Log completion
    await getSupabaseAdmin().from('arena_logs').insert({
      run_id: runId,
      level: 'info',
      message: `Simulation completed successfully. Processed ${totalCandles} candles.`,
      metadata: { 
        totalCandles,
        modelsCount: models.length,
        competition: competition.name
      }
    })
    
  } catch (error) {
    console.error(`Simulation ${runId} failed:`, error)
    
    // Mark run as failed
    await getSupabaseAdmin()
      .from('arena_runs')
      .update({ 
        status: 'failed',
        completed_at: new Date().toISOString()
      })
      .eq('id', runId)
    
    // Log error
    await getSupabaseAdmin().from('arena_logs').insert({
      run_id: runId,
      level: 'error',
      message: `Simulation failed: ${String(error)}`,
      metadata: { error: String(error), stack: (error as Error).stack }
    })
  }
}