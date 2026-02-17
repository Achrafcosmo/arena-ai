import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const runId = searchParams.get('runId')
    
    if (!runId) {
      return NextResponse.json({ error: 'Run ID is required' }, { status: 400 })
    }
    
    // Get run details
    const { data: run, error: runError } = await getSupabaseAdmin()
      .from('arena_runs')
      .select(`
        *,
        competition:arena_competitions(name, market, timeframe)
      `)
      .eq('id', runId)
      .single()
    
    if (runError || !run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    }
    
    // Get model states
    const { data: modelStates, error: statesError } = await getSupabaseAdmin()
      .from('arena_model_run_state')
      .select(`
        *,
        model:arena_models(display_name, provider, strategy_mode)
      `)
      .eq('run_id', runId)
    
    if (statesError) {
      console.error('Error fetching model states:', statesError)
    }
    
    // Calculate progress
    const progress = run.total_candles > 0 
      ? (run.current_candle_index / run.total_candles) * 100 
      : 0
    
    // Calculate duration
    let duration = null
    if (run.started_at) {
      const start = new Date(run.started_at)
      const end = run.completed_at ? new Date(run.completed_at) : new Date()
      duration = Math.floor((end.getTime() - start.getTime()) / 1000) // Duration in seconds
    }
    
    // Get recent logs
    const { data: logs, error: logsError } = await getSupabaseAdmin()
      .from('arena_logs')
      .select('*')
      .eq('run_id', runId)
      .order('created_at', { ascending: false })
      .limit(10)
    
    if (logsError) {
      console.error('Error fetching logs:', logsError)
    }
    
    // Sort model states by equity (descending)
    const sortedStates = (modelStates || []).sort((a, b) => b.equity - a.equity)
    
    return NextResponse.json({
      run: {
        ...run,
        progress: Number(progress.toFixed(1)),
        duration
      },
      modelStates: sortedStates,
      logs: logs || [],
      leaderboard: sortedStates.map((state, index) => ({
        rank: index + 1,
        modelName: (state as any).model?.display_name || 'Unknown',
        provider: (state as any).model?.provider || 'unknown',
        strategy: (state as any).model?.strategy_mode,
        equity: Number(state.equity.toFixed(2)),
        balance: Number(state.balance.toFixed(2)),
        unrealizedPnl: Number(state.unrealized_pnl.toFixed(2)),
        realizedPnl: Number(state.realized_pnl.toFixed(2)),
        totalReturn: Number(((state.equity / run.competition.initial_balance - 1) * 100).toFixed(2)),
        position: state.position_side,
        leverage: state.position_leverage,
        totalTrades: state.total_trades,
        winRate: state.total_trades > 0 ? Number((state.winning_trades / state.total_trades * 100).toFixed(1)) : 0,
        maxDrawdown: Number((state.max_drawdown * 100).toFixed(2))
      }))
    })
    
  } catch (error) {
    console.error('Error fetching run status:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: String(error)
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get all active runs status
    const { data: activeRuns, error } = await getSupabaseAdmin()
      .from('arena_runs')
      .select(`
        *,
        competition:arena_competitions(name, market, timeframe)
      `)
      .in('status', ['pending', 'running'])
      .order('created_at', { ascending: false })
    
    if (error) {
      return NextResponse.json({ error: 'Failed to fetch active runs' }, { status: 500 })
    }
    
    const runsWithProgress = activeRuns.map(run => ({
      ...run,
      progress: run.total_candles > 0 
        ? Number(((run.current_candle_index / run.total_candles) * 100).toFixed(1))
        : 0,
      duration: run.started_at 
        ? Math.floor((new Date().getTime() - new Date(run.started_at).getTime()) / 1000)
        : null
    }))
    
    return NextResponse.json({
      activeRuns: runsWithProgress,
      totalActiveRuns: runsWithProgress.length
    })
    
  } catch (error) {
    console.error('Error fetching active runs:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: String(error)
    }, { status: 500 })
  }
}