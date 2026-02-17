'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import NavBar from '@/components/NavBar'
import TickerBar from '@/components/TickerBar'
import { getModelColor } from '@/components/constants'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell,
  CartesianGrid, ReferenceLine, Area, ComposedChart
} from 'recharts'
import { Crown, Medal, Award, ChevronDown, ChevronUp, X, TrendingUp, TrendingDown, MessageSquare, Filter } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// ─── Types ────────────────────────────────────────────────────────
interface Competition {
  id: string; name: string; market: string; timeframe: string; status: string;
  initial_balance: number; max_leverage: number; fee_rate: number; slippage_rate: number; created_at: string
}
interface Model {
  id: string; display_name: string; provider: string; model_id: string; strategy_mode: string; enabled: boolean
}
interface RunState {
  id: string; run_id: string; model_id: string; balance: number; equity: number;
  position_side: string; position_size: number; position_entry_price: number; position_leverage: number;
  unrealized_pnl: number; realized_pnl: number; total_trades: number; winning_trades: number;
  max_drawdown: number; peak_equity: number
}
interface EquitySnap {
  run_id: string; model_id: string; candle_index: number; equity: number; balance: number; unrealized_pnl: number
}
interface Trade {
  id: string; run_id: string; model_id: string; candle_index: number; action: string;
  leverage: number; size_pct: number; entry_price: number; pnl: number; fee: number;
  reason: string; created_at: string
}
interface Run {
  id: string; competition_id: string; status: string; current_candle_index: number;
  total_candles: number; started_at: string; completed_at: string | null
}

// ─── Main Component ───────────────────────────────────────────────
export default function DemoPage() {
  const [activeTab, setActiveTab] = useState('LIVE')
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [selectedCompId, setSelectedCompId] = useState<string>('')
  const [models, setModels] = useState<Model[]>([])
  const [currentRun, setCurrentRun] = useState<Run | null>(null)
  const [runStates, setRunStates] = useState<RunState[]>([])
  const [equitySnaps, setEquitySnaps] = useState<EquitySnap[]>([])
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)

  // Chart controls
  const [chartMode, setChartMode] = useState<'$' | '%'>('$')
  const [timeframe, setTimeframe] = useState<'ALL' | '72H'>('ALL')

  // Leaderboard tab
  const [lbTab, setLbTab] = useState<'overall' | 'advanced'>('overall')

  // ModelChat filter
  const [chatFilter, setChatFilter] = useState('ALL')

  // Models section modal
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)

  // ─── Data fetching ──────────────────────────────────────────────
  const fetchAll = useCallback(async (compId: string) => {
    // models for this competition
    const { data: compModels } = await supabase
      .from('arena_competition_models')
      .select('model_id')
      .eq('competition_id', compId)
    const modelIds = (compModels || []).map(cm => cm.model_id)

    if (modelIds.length) {
      const { data: modelsData } = await supabase
        .from('arena_models')
        .select('*')
        .in('id', modelIds)
      setModels(modelsData || [])
    } else {
      // fallback: get all enabled models
      const { data: modelsData } = await supabase.from('arena_models').select('*').eq('enabled', true)
      setModels(modelsData || [])
    }

    // latest run
    const { data: runs } = await supabase
      .from('arena_runs')
      .select('*')
      .eq('competition_id', compId)
      .order('created_at', { ascending: false })
      .limit(1)

    if (!runs?.length) { setCurrentRun(null); setRunStates([]); setEquitySnaps([]); setTrades([]); return }
    const run = runs[0] as Run
    setCurrentRun(run)

    // parallel fetch
    const [statesRes, snapsRes, tradesRes] = await Promise.all([
      supabase.from('arena_model_run_state').select('*').eq('run_id', run.id),
      supabase.from('arena_equity_snapshots').select('*').eq('run_id', run.id).order('candle_index', { ascending: true }),
      supabase.from('arena_trades').select('*').eq('run_id', run.id).order('candle_index', { ascending: false }),
    ])
    setRunStates(statesRes.data || [])
    setEquitySnaps(snapsRes.data || [])
    setTrades(tradesRes.data || [])
  }, [])

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.from('arena_competitions').select('*').order('created_at', { ascending: false })
      setCompetitions(data || [])
      if (data?.length) {
        const running = data.find((c: Competition) => c.status === 'running')
        setSelectedCompId(running?.id || data[0].id)
      }
      setLoading(false)
    })()
  }, [])

  useEffect(() => {
    if (selectedCompId) fetchAll(selectedCompId)
  }, [selectedCompId, fetchAll])

  // Realtime subscriptions
  useEffect(() => {
    if (!currentRun) return
    const ch = supabase
      .channel('arena-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'arena_model_run_state', filter: `run_id=eq.${currentRun.id}` }, (payload) => {
        setRunStates(prev => {
          const updated = payload.new as RunState
          const idx = prev.findIndex(s => s.model_id === updated.model_id)
          if (idx >= 0) { const n = [...prev]; n[idx] = updated; return n }
          return [...prev, updated]
        })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'arena_equity_snapshots', filter: `run_id=eq.${currentRun.id}` }, (payload) => {
        setEquitySnaps(prev => [...prev, payload.new as EquitySnap])
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [currentRun])

  // ─── Derived data ───────────────────────────────────────────────
  const selectedComp = competitions.find(c => c.id === selectedCompId)
  const initialBalance = selectedComp?.initial_balance || 10000

  const modelMap = useMemo(() => {
    const m: Record<string, Model> = {}
    models.forEach(mod => { m[mod.id] = mod })
    return m
  }, [models])

  // Leaderboard sorted
  const leaderboard = useMemo(() => {
    return [...runStates]
      .map(s => {
        const mod = modelMap[s.model_id]
        const totalReturn = ((s.equity / initialBalance) - 1) * 100
        const winRate = s.total_trades > 0 ? (s.winning_trades / s.total_trades) * 100 : 0
        // compute fees & biggest win/loss from trades
        const modelTrades = trades.filter(t => t.model_id === s.model_id)
        const totalFees = modelTrades.reduce((acc, t) => acc + (t.fee || 0), 0)
        const pnls = modelTrades.filter(t => t.pnl !== null && t.pnl !== 0).map(t => t.pnl)
        const biggestWin = pnls.length ? Math.max(...pnls, 0) : 0
        const biggestLoss = pnls.length ? Math.min(...pnls, 0) : 0
        const wins = pnls.filter(p => p > 0)
        const losses = pnls.filter(p => p < 0)
        const avgWin = wins.length ? wins.reduce((a, b) => a + b, 0) / wins.length : 0
        const avgLoss = losses.length ? Math.abs(losses.reduce((a, b) => a + b, 0) / losses.length) : 0
        const profitFactor = avgLoss > 0 ? (wins.reduce((a, b) => a + b, 0)) / Math.abs(losses.reduce((a, b) => a + b, 0) || 1) : wins.length > 0 ? Infinity : 0
        // simple sharpe approximation from trade returns
        const tradeReturns = pnls.map(p => p / initialBalance)
        const meanRet = tradeReturns.length ? tradeReturns.reduce((a, b) => a + b, 0) / tradeReturns.length : 0
        const stdRet = tradeReturns.length > 1
          ? Math.sqrt(tradeReturns.reduce((acc, r) => acc + (r - meanRet) ** 2, 0) / (tradeReturns.length - 1))
          : 0
        const sharpe = stdRet > 0 ? (meanRet / stdRet) * Math.sqrt(252) : 0

        return {
          ...s,
          display_name: mod?.display_name || 'Unknown',
          provider: mod?.provider || 'custom',
          strategy_mode: mod?.strategy_mode || '',
          totalReturn, winRate, totalFees, biggestWin, biggestLoss,
          sharpe, profitFactor,
          avgWinLossRatio: avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0,
        }
      })
      .sort((a, b) => b.equity - a.equity)
  }, [runStates, modelMap, trades, initialBalance])

  // Chart data
  const chartData = useMemo(() => {
    if (!equitySnaps.length) return []
    const maxCandle = Math.max(...equitySnaps.map(s => s.candle_index))
    const cutoff = timeframe === '72H' ? Math.max(maxCandle - 72, 0) : 0

    const byCandle: Record<number, Record<string, number>> = {}
    equitySnaps.forEach(s => {
      if (s.candle_index < cutoff) return
      if (!byCandle[s.candle_index]) byCandle[s.candle_index] = {}
      const val = chartMode === '%'
        ? ((s.equity / initialBalance) - 1) * 100
        : s.equity
      byCandle[s.candle_index][s.model_id] = val
    })

    return Object.entries(byCandle)
      .map(([ci, vals]) => ({ candle: Number(ci), ...vals }))
      .sort((a, b) => a.candle - b.candle)
  }, [equitySnaps, chartMode, timeframe, initialBalance])

  const chartModelIds = useMemo(() => {
    const ids = new Set<string>()
    equitySnaps.forEach(s => ids.add(s.model_id))
    return Array.from(ids)
  }, [equitySnaps])

  // Filtered trades for chat
  const filteredTrades = useMemo(() => {
    if (chatFilter === 'ALL') return trades
    return trades.filter(t => t.model_id === chatFilter)
  }, [trades, chatFilter])

  // ─── Render helpers ─────────────────────────────────────────────
  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="w-5 h-5 text-yellow-400" />
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-300" />
    if (rank === 3) return <Award className="w-5 h-5 text-amber-600" />
    return <span className="text-gray-500 font-mono text-sm">{rank}</span>
  }

  const fmt = (n: number, d = 2) => n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d })
  const fmtUsd = (n: number) => '$' + fmt(n)

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-[#10b981] text-lg font-mono animate-pulse">Loading Arena...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <NavBar activeTab={activeTab} onTabChange={setActiveTab} />
      <TickerBar />

      {/* Competition tabs */}
      <div className="border-b border-gray-800 bg-[#0a0a0f]">
        <div className="max-w-[1600px] mx-auto px-4 flex gap-1 overflow-x-auto py-2">
          {competitions.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedCompId(c.id)}
              className={`px-4 py-1.5 text-xs font-medium rounded whitespace-nowrap transition-colors ${
                selectedCompId === c.id
                  ? 'bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/40'
                  : 'text-gray-400 hover:text-white border border-transparent hover:border-gray-700'
              }`}
            >
              {c.name}
              {c.status === 'running' && <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />}
            </button>
          ))}
        </div>
      </div>

      {/* Run progress bar */}
      {currentRun && currentRun.total_candles > 0 && (
        <div className="max-w-[1600px] mx-auto px-4 pt-3">
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
              currentRun.status === 'running' ? 'bg-[#10b981]/20 text-[#10b981]' :
              currentRun.status === 'completed' ? 'bg-blue-500/20 text-blue-400' : 'bg-yellow-500/20 text-yellow-400'
            }`}>{currentRun.status.toUpperCase()}</span>
            <div className="flex-1 bg-gray-800 rounded-full h-1.5">
              <div className="bg-[#10b981] h-1.5 rounded-full transition-all" style={{ width: `${(currentRun.current_candle_index / currentRun.total_candles) * 100}%` }} />
            </div>
            <span className="font-mono">{currentRun.current_candle_index}/{currentRun.total_candles}</span>
          </div>
        </div>
      )}

      <div className="max-w-[1600px] mx-auto px-4 py-6">
        {/* ═══════════════ LIVE SECTION ═══════════════ */}
        {activeTab === 'LIVE' && (
          <div className="flex gap-4">
            {/* Chart area */}
            <div className="flex-1 min-w-0">
              <div className="bg-[#111118] rounded-lg border border-gray-800 p-4">
                {/* Controls */}
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold">Equity Performance</h2>
                  <div className="flex gap-2">
                    {(['$', '%'] as const).map(m => (
                      <button key={m} onClick={() => setChartMode(m)}
                        className={`px-3 py-1 text-xs rounded font-medium ${chartMode === m ? 'bg-[#10b981]/20 text-[#10b981]' : 'text-gray-400 hover:text-white'}`}>
                        {m === '$' ? 'USD' : 'Return %'}
                      </button>
                    ))}
                    <div className="w-px bg-gray-700 mx-1" />
                    {(['ALL', '72H'] as const).map(t => (
                      <button key={t} onClick={() => setTimeframe(t)}
                        className={`px-3 py-1 text-xs rounded font-medium ${timeframe === t ? 'bg-[#06b6d4]/20 text-[#06b6d4]' : 'text-gray-400 hover:text-white'}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={420}>
                    <LineChart data={chartData} margin={{ top: 5, right: 120, bottom: 5, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a1a24" />
                      <XAxis dataKey="candle" stroke="#555" tick={{ fontSize: 10 }} />
                      <YAxis stroke="#555" tick={{ fontSize: 10 }} tickFormatter={v => chartMode === '%' ? `${v.toFixed(1)}%` : `$${v.toLocaleString()}`} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#111118', border: '1px solid #333', borderRadius: 8, fontSize: 12 }}
                        labelFormatter={v => `Candle ${v}`}
                        formatter={(value: number | undefined, name: string | undefined) => {
                          const mod = modelMap[name || '']
                          const label = mod?.display_name || name || ''
                          const v = value ?? 0
                          return [chartMode === '%' ? `${v.toFixed(2)}%` : fmtUsd(v), label]
                        }}
                      />
                      {chartMode === '%' && <ReferenceLine y={0} stroke="#555" strokeDasharray="3 3" />}
                      {chartModelIds.map(mid => (
                        <Line
                          key={mid}
                          type="monotone"
                          dataKey={mid}
                          stroke={getModelColor(modelMap[mid]?.provider || 'custom')}
                          dot={false}
                          strokeWidth={2}
                          name={mid}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[420px] flex items-center justify-center text-gray-500">No equity data yet</div>
                )}

                {/* Legend */}
                <div className="flex flex-wrap gap-3 mt-3">
                  {chartModelIds.map(mid => {
                    const mod = modelMap[mid]
                    const lastSnap = equitySnaps.filter(s => s.model_id === mid).slice(-1)[0]
                    const val = lastSnap ? (chartMode === '%' ? ((lastSnap.equity / initialBalance) - 1) * 100 : lastSnap.equity) : null
                    return (
                      <div key={mid} className="flex items-center gap-1.5 text-xs">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getModelColor(mod?.provider || 'custom') }} />
                        <span className="text-gray-300">{mod?.display_name || mid}</span>
                        {val !== null && (
                          <span className="font-mono text-gray-400">
                            {chartMode === '%' ? `${val.toFixed(2)}%` : fmtUsd(val)}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* ModelChat sidebar */}
            <div className="w-80 flex-shrink-0 hidden lg:block">
              <div className="bg-[#111118] rounded-lg border border-gray-800 h-[540px] flex flex-col">
                <div className="p-3 border-b border-gray-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-[#06b6d4]" />
                    <span className="text-sm font-medium">Model Reasoning</span>
                  </div>
                  <select
                    value={chatFilter}
                    onChange={e => setChatFilter(e.target.value)}
                    className="text-xs bg-[#1a1a24] border border-gray-700 rounded px-2 py-1 text-gray-300"
                  >
                    <option value="ALL">All Models</option>
                    {models.map(m => <option key={m.id} value={m.id}>{m.display_name}</option>)}
                  </select>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {filteredTrades.slice(0, 50).map(t => (
                    <TradeReasonCard key={t.id} trade={t} model={modelMap[t.model_id]} />
                  ))}
                  {filteredTrades.length === 0 && (
                    <div className="text-gray-500 text-xs text-center mt-8">No trades yet</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════ LEADERBOARD SECTION ═══════════════ */}
        {activeTab === 'LEADERBOARD' && (
          <div>
            {/* Toggle */}
            <div className="flex gap-2 mb-4">
              {(['overall', 'advanced'] as const).map(tab => (
                <button key={tab} onClick={() => setLbTab(tab)}
                  className={`px-4 py-2 text-sm rounded font-medium ${lbTab === tab ? 'bg-[#10b981]/20 text-[#10b981]' : 'text-gray-400 hover:text-white'}`}>
                  {tab === 'overall' ? 'Overall Stats' : 'Advanced Analytics'}
                </button>
              ))}
            </div>

            <div className="bg-[#111118] rounded-lg border border-gray-800 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#0d0d14]">
                  <tr>
                    <th className="text-left p-3 text-gray-400 font-medium">#</th>
                    <th className="text-left p-3 text-gray-400 font-medium">Model</th>
                    <th className="text-left p-3 text-gray-400 font-medium">Strategy</th>
                    <th className="text-right p-3 text-gray-400 font-medium">Acct Value</th>
                    <th className="text-right p-3 text-gray-400 font-medium">Return %</th>
                    <th className="text-right p-3 text-gray-400 font-medium">P&L</th>
                    <th className="text-right p-3 text-gray-400 font-medium">Fees</th>
                    <th className="text-right p-3 text-gray-400 font-medium">Win Rate</th>
                    <th className="text-right p-3 text-gray-400 font-medium">Best</th>
                    <th className="text-right p-3 text-gray-400 font-medium">Worst</th>
                    <th className="text-right p-3 text-gray-400 font-medium">Sharpe</th>
                    <th className="text-right p-3 text-gray-400 font-medium">Trades</th>
                    {lbTab === 'advanced' && (
                      <>
                        <th className="text-right p-3 text-gray-400 font-medium">Profit Factor</th>
                        <th className="text-right p-3 text-gray-400 font-medium">W/L Ratio</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((m, i) => (
                    <tr key={m.model_id} className="border-t border-gray-800/50 hover:bg-[#1a1a24]/50 transition-colors">
                      <td className="p-3">{getRankIcon(i + 1)}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getModelColor(m.provider) }} />
                          <span className="font-medium">{m.display_name}</span>
                        </div>
                      </td>
                      <td className="p-3 text-gray-400">{m.strategy_mode || '-'}</td>
                      <td className="p-3 text-right font-mono">{fmtUsd(m.equity)}</td>
                      <td className={`p-3 text-right font-mono ${m.totalReturn >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                        {m.totalReturn >= 0 ? '+' : ''}{m.totalReturn.toFixed(2)}%
                      </td>
                      <td className={`p-3 text-right font-mono ${m.realized_pnl >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                        {fmtUsd(m.realized_pnl)}
                      </td>
                      <td className="p-3 text-right font-mono text-gray-400">{fmtUsd(m.totalFees)}</td>
                      <td className="p-3 text-right font-mono">{m.winRate.toFixed(1)}%</td>
                      <td className="p-3 text-right font-mono text-[#10b981]">{fmtUsd(m.biggestWin)}</td>
                      <td className="p-3 text-right font-mono text-[#ef4444]">{fmtUsd(m.biggestLoss)}</td>
                      <td className="p-3 text-right font-mono">{m.sharpe.toFixed(2)}</td>
                      <td className="p-3 text-right font-mono">{m.total_trades}</td>
                      {lbTab === 'advanced' && (
                        <>
                          <td className="p-3 text-right font-mono">{m.profitFactor === Infinity ? '∞' : m.profitFactor.toFixed(2)}</td>
                          <td className="p-3 text-right font-mono">{m.avgWinLossRatio === Infinity ? '∞' : m.avgWinLossRatio.toFixed(2)}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-gray-500 mt-3 italic">
              All statistics (except Account Value and P&L) reflect completed trades only.
            </p>

            {/* Winner Spotlight bar chart */}
            {leaderboard.length > 0 && (
              <div className="bg-[#111118] rounded-lg border border-gray-800 p-4 mt-6">
                <h3 className="text-sm font-medium text-gray-300 mb-4">🏆 Winner Spotlight — Top 8 by Equity</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={leaderboard.slice(0, 8).map(m => ({ name: m.display_name, equity: m.equity, provider: m.provider }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a24" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#999' }} angle={-20} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 10, fill: '#999' }} tickFormatter={v => `$${(v/1000).toFixed(1)}k`} />
                    <Tooltip contentStyle={{ backgroundColor: '#111118', border: '1px solid #333', borderRadius: 8, fontSize: 12 }} formatter={(v) => [fmtUsd(v as number), 'Equity']} />
                    <Bar dataKey="equity" radius={[4, 4, 0, 0]}>
                      {leaderboard.slice(0, 8).map((m, i) => (
                        <Cell key={i} fill={getModelColor(m.provider)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ MODELS SECTION ═══════════════ */}
        {activeTab === 'MODELS' && (
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {models.map(mod => {
                const state = runStates.find(s => s.model_id === mod.id)
                const ret = state ? ((state.equity / initialBalance) - 1) * 100 : 0
                return (
                  <motion.div
                    key={mod.id}
                    whileHover={{ scale: 1.02 }}
                    className="bg-[#111118] border border-gray-800 rounded-lg p-4 cursor-pointer hover:border-[#10b981]/40 transition-colors"
                    onClick={() => setSelectedModelId(mod.id)}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: getModelColor(mod.provider) }} />
                      <div>
                        <div className="font-medium text-sm">{mod.display_name}</div>
                        <div className="text-xs text-gray-500 capitalize">{mod.provider}</div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 mb-2">
                      <span className="bg-[#1a1a24] px-2 py-0.5 rounded">{mod.strategy_mode || 'default'}</span>
                    </div>
                    {state && (
                      <div className="flex justify-between items-end mt-3">
                        <span className="font-mono text-sm">{fmtUsd(state.equity)}</span>
                        <span className={`font-mono text-sm ${ret >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                          {ret >= 0 ? '+' : ''}{ret.toFixed(2)}%
                        </span>
                      </div>
                    )}
                  </motion.div>
                )
              })}
            </div>

            {/* Model detail modal */}
            <AnimatePresence>
              {selectedModelId && (
                <ModelModal
                  modelId={selectedModelId}
                  model={modelMap[selectedModelId]}
                  equitySnaps={equitySnaps.filter(s => s.model_id === selectedModelId)}
                  initialBalance={initialBalance}
                  onClose={() => setSelectedModelId(null)}
                />
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── TradeReasonCard ──────────────────────────────────────────────
function TradeReasonCard({ trade, model }: { trade: Trade; model?: Model }) {
  const [expanded, setExpanded] = useState(false)
  const reason = trade.reason || ''
  const isLong = reason.length > 120

  return (
    <div className="text-xs border-b border-gray-800/50 pb-2">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getModelColor(model?.provider || 'custom') }} />
        <span className="font-medium text-gray-200">{model?.display_name || 'Unknown'}</span>
        <span className="bg-[#1a1a24] px-1.5 py-0.5 rounded text-[10px] text-gray-400">{trade.action}</span>
        <span className="text-gray-600 ml-auto text-[10px]">#{trade.candle_index}</span>
      </div>
      <p className="text-gray-400 leading-relaxed">
        {isLong && !expanded ? reason.slice(0, 120) + '...' : reason}
      </p>
      {isLong && (
        <button onClick={() => setExpanded(!expanded)} className="text-[#06b6d4] hover:underline mt-0.5">
          {expanded ? 'collapse' : 'expand'}
        </button>
      )}
    </div>
  )
}

// ─── ModelModal ───────────────────────────────────────────────────
function ModelModal({ modelId, model, equitySnaps, initialBalance, onClose }: {
  modelId: string; model?: Model; equitySnaps: EquitySnap[]; initialBalance: number; onClose: () => void
}) {
  const data = equitySnaps.map(s => ({
    candle: s.candle_index,
    equity: s.equity,
    above: s.equity >= initialBalance ? s.equity : initialBalance,
    below: s.equity < initialBalance ? s.equity : initialBalance,
  }))

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
        className="bg-[#111118] border border-gray-800 rounded-lg p-6 max-w-2xl w-full"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: getModelColor(model?.provider || 'custom') }} />
            <h3 className="text-lg font-bold">{model?.display_name || modelId}</h3>
            <span className="text-xs text-gray-400 capitalize">{model?.provider}</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a24" />
              <XAxis dataKey="candle" stroke="#555" tick={{ fontSize: 10 }} />
              <YAxis stroke="#555" tick={{ fontSize: 10 }} tickFormatter={v => `$${v.toLocaleString()}`} />
              <ReferenceLine y={initialBalance} stroke="#555" strokeDasharray="5 5" label={{ value: 'Initial', fill: '#666', fontSize: 10 }} />
              <Tooltip contentStyle={{ backgroundColor: '#111118', border: '1px solid #333', borderRadius: 8, fontSize: 12 }} formatter={(v) => [`$${(v as number).toLocaleString()}`, 'Equity']} />
              <Area type="monotone" dataKey="above" fill="#10b981" fillOpacity={0.15} stroke="none" baseValue={initialBalance} />
              <Area type="monotone" dataKey="below" fill="#ef4444" fillOpacity={0.15} stroke="none" baseValue={initialBalance} />
              <Line type="monotone" dataKey="equity" stroke={getModelColor(model?.provider || 'custom')} dot={false} strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-gray-500">No data yet</div>
        )}
      </motion.div>
    </motion.div>
  )
}
