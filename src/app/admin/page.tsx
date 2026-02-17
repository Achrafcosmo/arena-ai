'use client'

import { useState, useEffect } from 'react'
import { Trophy, Users, Play, TrendingUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Stats {
  totalModels: number
  totalCompetitions: number
  activeRuns: number
  totalTrades: number
}

export default function AdminOverview() {
  const [stats, setStats] = useState<Stats>({
    totalModels: 0,
    totalCompetitions: 0,
    activeRuns: 0,
    totalTrades: 0
  })

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const [modelsRes, competitionsRes, runsRes, tradesRes] = await Promise.all([
        supabase.from('arena_models').select('*', { count: 'exact' }),
        supabase.from('arena_competitions').select('*', { count: 'exact' }),
        supabase.from('arena_runs').select('*', { count: 'exact' }).eq('status', 'running'),
        supabase.from('arena_trades').select('*', { count: 'exact' })
      ])

      setStats({
        totalModels: modelsRes.count || 0,
        totalCompetitions: competitionsRes.count || 0,
        activeRuns: runsRes.count || 0,
        totalTrades: tradesRes.count || 0
      })
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-8">Admin Overview</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Models"
          value={stats.totalModels}
          icon={<Users className="w-8 h-8" />}
          color="text-blue-400"
        />
        <StatCard
          title="Total Competitions"
          value={stats.totalCompetitions}
          icon={<Trophy className="w-8 h-8" />}
          color="text-yellow-400"
        />
        <StatCard
          title="Active Runs"
          value={stats.activeRuns}
          icon={<Play className="w-8 h-8" />}
          color="text-green-400"
        />
        <StatCard
          title="Total Trades"
          value={stats.totalTrades}
          icon={<TrendingUp className="w-8 h-8" />}
          color="text-purple-400"
        />
      </div>

      <div className="bg-[#111118] rounded-lg p-6">
        <h2 className="text-xl font-bold text-white mb-4">System Status</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Database Connection</span>
            <span className="px-2 py-1 bg-green-600 text-white text-sm rounded">Online</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Simulation Engine</span>
            <span className="px-2 py-1 bg-green-600 text-white text-sm rounded">Ready</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Market Data Feed</span>
            <span className="px-2 py-1 bg-green-600 text-white text-sm rounded">Connected</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value, icon, color }: { title: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-[#111118] rounded-lg p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-sm">{title}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
        </div>
        <div className={color}>{icon}</div>
      </div>
    </div>
  )
}