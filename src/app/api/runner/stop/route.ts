import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { runId } = await request.json()
    
    if (!runId) {
      return NextResponse.json({ error: 'Run ID is required' }, { status: 400 })
    }
    
    // Get run details
    const { data: run, error: runError } = await supabaseAdmin
      .from('arena_runs')
      .select('*')
      .eq('id', runId)
      .single()
    
    if (runError || !run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    }
    
    // Check if run can be stopped
    if (!['pending', 'running'].includes(run.status)) {
      return NextResponse.json({ 
        error: `Cannot stop run with status: ${run.status}` 
      }, { status: 400 })
    }
    
    // Update run status to completed (stopped)
    const { error: updateError } = await supabaseAdmin
      .from('arena_runs')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', runId)
    
    if (updateError) {
      console.error('Error stopping run:', updateError)
      return NextResponse.json({ error: 'Failed to stop run' }, { status: 500 })
    }
    
    // Log the stop action
    await supabaseAdmin.from('arena_logs').insert({
      run_id: runId,
      level: 'info',
      message: 'Simulation manually stopped by admin',
      metadata: { 
        stopped_at: new Date().toISOString(),
        candles_processed: run.current_candle_index,
        total_candles: run.total_candles,
        completion_percentage: run.total_candles > 0 
          ? ((run.current_candle_index / run.total_candles) * 100).toFixed(1)
          : 0
      }
    })
    
    console.log(`Run ${runId} stopped manually`)
    
    return NextResponse.json({ 
      success: true,
      message: 'Run stopped successfully',
      runId
    })
    
  } catch (error) {
    console.error('Error stopping run:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: String(error)
    }, { status: 500 })
  }
}

// Additional endpoint to stop all running simulations
export async function DELETE(request: NextRequest) {
  try {
    // Get all running simulations
    const { data: activeRuns, error: fetchError } = await supabaseAdmin
      .from('arena_runs')
      .select('id, status')
      .in('status', ['pending', 'running'])
    
    if (fetchError) {
      return NextResponse.json({ error: 'Failed to fetch active runs' }, { status: 500 })
    }
    
    if (!activeRuns || activeRuns.length === 0) {
      return NextResponse.json({ 
        success: true,
        message: 'No active runs to stop',
        stoppedRuns: []
      })
    }
    
    // Stop all active runs
    const runIds = activeRuns.map(run => run.id)
    
    const { error: updateError } = await supabaseAdmin
      .from('arena_runs')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .in('id', runIds)
    
    if (updateError) {
      console.error('Error stopping all runs:', updateError)
      return NextResponse.json({ error: 'Failed to stop all runs' }, { status: 500 })
    }
    
    // Log the bulk stop action
    for (const runId of runIds) {
      await supabaseAdmin.from('arena_logs').insert({
        run_id: runId,
        level: 'info',
        message: 'Simulation stopped by admin (bulk stop)',
        metadata: { 
          bulk_stop: true,
          stopped_at: new Date().toISOString()
        }
      })
    }
    
    console.log(`Stopped ${runIds.length} active simulations`)
    
    return NextResponse.json({ 
      success: true,
      message: `Stopped ${runIds.length} active simulations`,
      stoppedRuns: runIds
    })
    
  } catch (error) {
    console.error('Error stopping all runs:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: String(error)
    }, { status: 500 })
  }
}