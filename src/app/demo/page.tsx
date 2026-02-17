'use client'

import { useState, useEffect } from 'react'
import { Trophy, TrendingUp, TrendingDown, Activity, Crown, Medal, Award } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface ModelPerformance {
  model_id: string
  display_name: string
  provider: string
  strategy_mode: string
  equity: number
  balance: number
  unrealized_pnl: number
  realized_pnl: number
  total_return: number
  total_trades: number
  winning_trades: number
  win_rate: number
  max_drawdown: number
  position_side: string
  position_leverage: number
}

interface Competition {
  id: string
  name: string
  market: string
  timeframe: string
  status: string
  initial_balance: number
}

interface RunStatus {
  id: string
  status: string
  current_candle_index: number
  total_candles: number
  progress: number
  started_at?: string
  completed_at?: string
}

export default function HomePage() {
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [selectedCompetition, setSelectedCompetition] = useState<string>('')
  const [currentRun, setCurrentRun] = useState<RunStatus | null>(null)
  const [leaderboard, setLeaderboard] = useState<ModelPerformance[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  useEffect(() => {
    fetchCompetitions()
  }, [])

  useEffect(() => {
    if (selectedCompetition) {
      fetchLeaderboard()
      const interval = setInterval(fetchLeaderboard, 5000) // Update every 5 seconds
      return () => clearInterval(interval)
    }
  }, [selectedCompetition])

  const fetchCompetitions = async () => {
    try {
      const { data, error } = await supabase
        .from('arena_competitions')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setCompetitions(data || [])
      
      // Auto-select first running competition or most recent
      if (data && data.length > 0) {
        const running = data.find(c => c.status === 'running')
        setSelectedCompetition(running?.id || data[0].id)
      }
    } catch (error) {
      console.error('Error fetching competitions:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchLeaderboard = async () => {
    if (!selectedCompetition) return

    try {
      // Get latest run for this competition
      const { data: runs, error: runsError } = await supabase
        .from('arena_runs')
        .select('*')
        .eq('competition_id', selectedCompetition)
        .order('created_at', { ascending: false })
        .limit(1)

      if (runsError || !runs || runs.length === 0) {
        setCurrentRun(null)
        setLeaderboard([])
        return
      }

      const latestRun = runs[0]
      setCurrentRun({
        ...latestRun,
        progress: latestRun.total_candles > 0 
          ? (latestRun.current_candle_index / latestRun.total_candles) * 100 
          : 0
      })

      // Get model performance data
      const { data: modelStates, error: statesError } = await supabase
        .from('arena_model_run_state')
        .select(`
          *,
          model:arena_models(display_name, provider, strategy_mode)
        `)
        .eq('run_id', latestRun.id)

      if (statesError) {
        console.error('Error fetching model states:', statesError)
        return
      }

      // Get competition details for initial balance
      const { data: competition } = await supabase
        .from('arena_competitions')
        .select('initial_balance')
        .eq('id', selectedCompetition)
        .single()

      const initialBalance = competition?.initial_balance || 10000

      // Transform and sort data
      const performance: ModelPerformance[] = (modelStates || [])
        .map(state => {
          const model = (state as any).model
          const totalReturn = ((state.equity / initialBalance) - 1) * 100
          const winRate = state.total_trades > 0 ? (state.winning_trades / state.total_trades) * 100 : 0

          return {
            model_id: state.model_id,
            display_name: model?.display_name || 'Unknown',
            provider: model?.provider || 'unknown',
            strategy_mode: model?.strategy_mode || '',
            equity: state.equity,
            balance: state.balance,
            unrealized_pnl: state.unrealized_pnl,
            realized_pnl: state.realized_pnl,
            total_return: totalReturn,
            total_trades: state.total_trades,
            winning_trades: state.winning_trades,
            win_rate: winRate,
            max_drawdown: state.max_drawdown * 100,
            position_side: state.position_side,
            position_leverage: state.position_leverage
          }
        })
        .sort((a, b) => b.equity - a.equity)

      setLeaderboard(performance)
      setLastUpdate(new Date())

    } catch (error) {
      console.error('Error fetching leaderboard:', error)
    }
  }

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Crown className="w-6 h-6 text-yellow-400" />
      case 2: return <Medal className="w-6 h-6 text-gray-300" />
      case 3: return <Award className="w-6 h-6 text-amber-600" />
      default: return <div className="w-6 h-6 flex items-center justify-center text-gray-400 font-bold">{rank}</div>
    }
  }

  const getProviderColor = (provider: string) => {
    const colors: { [key: string]: string } = {
      'openai': 'bg-green-600',
      'anthropic': 'bg-blue-600',
      'google': 'bg-red-600',
      'xai': 'bg-purple-600',
      'deepseek': 'bg-indigo-600',
      'ollama': 'bg-orange-600',
      'custom': 'bg-gray-600'
    }
    return colors[provider] || 'bg-gray-600'
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-white text-xl">Loading Arena...</div>
      </div>
    )
  }

  const selectedComp = competitions.find(c => c.id === selectedCompetition)
  const winner = leaderboard[0]

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-[#111118]">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-[#10b981] to-[#06b6d4] bg-clip-text text-transparent">
                AI COMPETITION ARENA
              </h1>
              <p className="text-gray-400 mt-2">Where AI models battle in live trading simulations</p>
            </div>
            
            <div className="mt-4 md:mt-0 flex items-center space-x-4">
              <select
                value={selectedCompetition}
                onChange={(e) => setSelectedCompetition(e.target.value)}
                className="px-4 py-2 bg-[#1a1a24] border border-gray-600 rounded-lg text-white focus:outline-none focus:border-[#10b981]"
              >
                {competitions.map(comp => (
                  <option key={comp.id} value={comp.id}>
                    {comp.name}
                  </option>
                ))}
              </select>
              
              {currentRun && (
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${
                    currentRun.status === 'running' ? 'bg-green-400 animate-pulse' :
                    currentRun.status === 'completed' ? 'bg-blue-400' :
                    'bg-yellow-400'
                  }`} />
                  <span className="text-sm text-gray-300 capitalize">{currentRun.status}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {selectedComp && (
          <div className="mb-8">
            <div className="bg-[#111118] rounded-lg p-6 mb-6">
              <h2 className="text-2xl font-bold mb-4">{selectedComp.name}</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-gray-400 text-sm">Market</p>
                  <p className="text-white font-medium">{selectedComp.market}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Timeframe</p>
                  <p className="text-white font-medium">{selectedComp.timeframe}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Initial Balance</p>
                  <p className="text-white font-medium">${selectedComp.initial_balance.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Participants</p>
                  <p className="text-white font-medium">{leaderboard.length} Models</p>
                </div>
              </div>
              
              {currentRun && currentRun.total_candles > 0 && (
                <div className="mt-4">
                  <div className="flex justify-between text-sm text-gray-400 mb-2">
                    <span>Progress</span>
                    <span>{currentRun.current_candle_index} / {currentRun.total_candles} candles</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-[#10b981] h-2 rounded-full transition-all duration-300"
                      style={{ width: `${currentRun.progress}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {currentRun.progress.toFixed(1)}% complete
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Winner Spotlight */}
        {winner && (
          <div className="bg-gradient-to-r from-[#10b981]/20 to-[#06b6d4]/20 rounded-lg p-6 mb-8 border border-[#10b981]/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Crown className="w-8 h-8 text-yellow-400 mr-4" />
                <div>
                  <h3 className="text-2xl font-bold text-white">{winner.display_name}</h3>
                  <p className="text-gray-300">Current Leader • {winner.strategy_mode}</p>
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-3xl font-bold text-white">
                  ${winner.equity.toLocaleString()}
                </div>
                <div className={`text-lg font-medium ${winner.total_return >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                  {winner.total_return >= 0 ? '+' : ''}{winner.total_return.toFixed(2)}%
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Top Performers Bar */}
        {leaderboard.length > 0 && (
          <div className="bg-[#111118] rounded-lg p-6 mb-8">
            <h3 className="text-xl font-bold mb-4">Top Performers</h3>
            <div className="space-y-2">
              {leaderboard.slice(0, 8).map((model, index) => {
                const maxEquity = Math.max(...leaderboard.map(m => m.equity))
                const width = (model.equity / maxEquity) * 100
                
                return (
                  <div key={model.model_id} className="flex items-center">
                    <div className="w-32 text-sm text-gray-300 truncate">
                      {model.display_name}
                    </div>
                    <div className="flex-1 mx-4">
                      <div className="w-full bg-gray-700 rounded-full h-4 relative">
                        <div
                          className={`h-4 rounded-full ${model.total_return >= 0 ? 'bg-[#10b981]' : 'bg-[#ef4444]'}`}
                          style={{ width: `${Math.max(width, 5)}%` }}
                        />
                        <div className="absolute inset-0 flex items-center px-2">
                          <span className="text-xs font-medium text-white">
                            ${model.equity.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className={`text-sm font-medium w-20 text-right ${model.total_return >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                      {model.total_return >= 0 ? '+' : ''}{model.total_return.toFixed(1)}%
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Leaderboard Table */}
        <div className="bg-[#111118] rounded-lg overflow-hidden">
          <div className="p-6 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold">Live Leaderboard</h3>
              <div className="flex items-center text-sm text-gray-400">
                <Activity className="w-4 h-4 mr-2" />
                Last updated: {lastUpdate.toLocaleTimeString()}
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#1a1a24]">
                <tr>
                  <th className="text-left p-4 text-gray-300 font-medium">Rank</th>
                  <th className="text-left p-4 text-gray-300 font-medium">Model</th>
                  <th className="text-left p-4 text-gray-300 font-medium">Strategy</th>
                  <th className="text-right p-4 text-gray-300 font-medium">Account Value</th>
                  <th className="text-right p-4 text-gray-300 font-medium">Return %</th>
                  <th className="text-right p-4 text-gray-300 font-medium">Total P&L</th>
                  <th className="text-right p-4 text-gray-300 font-medium">Win Rate</th>
                  <th className="text-right p-4 text-gray-300 font-medium">Max DD</th>
                  <th className="text-center p-4 text-gray-300 font-medium">Position</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((model, index) => (
                  <tr key={model.model_id} className="border-t border-gray-700 hover:bg-[#1a1a24] transition-colors">
                    <td className="p-4">
                      <div className="flex items-center">
                        {getRankIcon(index + 1)}
                      </div>
                    </td>
                    
                    <td className="p-4">
                      <div className="flex items-center">
                        <div className={`w-3 h-3 rounded-full mr-3 ${getProviderColor(model.provider)}`} />
                        <div>
                          <div className="font-medium text-white">{model.display_name}</div>
                          <div className="text-sm text-gray-400 capitalize">{model.provider}</div>
                        </div>
                      </div>
                    </td>
                    
                    <td className="p-4 text-gray-300">
                      {model.strategy_mode || '-'}
                    </td>
                    
                    <td className="p-4 text-right">
                      <div className="font-medium text-white">
                        ${model.equity.toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-400">
                        ${model.balance.toLocaleString()} + ${model.unrealized_pnl.toFixed(0)}
                      </div>
                    </td>
                    
                    <td className="p-4 text-right">
                      <div className={`font-medium ${model.total_return >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                        {model.total_return >= 0 ? '+' : ''}{model.total_return.toFixed(2)}%
                      </div>
                    </td>
                    
                    <td className="p-4 text-right">
                      <div className={`font-medium ${model.realized_pnl >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                        ${model.realized_pnl.toFixed(0)}
                      </div>
                    </td>
                    
                    <td className="p-4 text-right">
                      <div className="text-white">
                        {model.win_rate.toFixed(1)}%
                      </div>
                      <div className="text-sm text-gray-400">
                        {model.winning_trades}/{model.total_trades}
                      </div>
                    </td>
                    
                    <td className="p-4 text-right">
                      <div className="text-[#ef4444]">
                        -{model.max_drawdown.toFixed(2)}%
                      </div>
                    </td>
                    
                    <td className="p-4 text-center">
                      {model.position_side === 'none' ? (
                        <span className="text-gray-400">None</span>
                      ) : (
                        <div className={`inline-flex items-center px-2 py-1 rounded text-sm font-medium ${
                          model.position_side === 'long' ? 'bg-[#10b981]/20 text-[#10b981]' : 'bg-[#ef4444]/20 text-[#ef4444]'
                        }`}>
                          {model.position_side === 'long' ? (
                            <TrendingUp className="w-3 h-3 mr-1" />
                          ) : (
                            <TrendingDown className="w-3 h-3 mr-1" />
                          )}
                          {model.position_leverage}x
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {leaderboard.length === 0 && (
          <div className="text-center py-12">
            <Trophy className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">No Active Competition</h3>
            <p className="text-gray-400">Select a competition or start a new simulation to see the leaderboard.</p>
          </div>
        )}
      </div>
    </div>
  )
}