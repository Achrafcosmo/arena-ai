'use client'

import { useState, useEffect } from 'react'
import { Play, Square, RotateCcw, Clock, CheckCircle, XCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Run {
  id: string
  competition_id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  current_candle_index: number
  total_candles: number
  started_at?: string
  completed_at?: string
  created_at: string
  competition?: {
    name: string
    market: string
    timeframe: string
  }
}

interface Competition {
  id: string
  name: string
  status: string
}

export default function RunsPage() {
  const [runs, setRuns] = useState<Run[]>([])
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [selectedCompetition, setSelectedCompetition] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isStarting, setIsStarting] = useState(false)

  useEffect(() => {
    fetchRuns()
    fetchCompetitions()
  }, [])

  const fetchRuns = async () => {
    try {
      const { data, error } = await supabase
        .from('arena_runs')
        .select(`
          *,
          competition:arena_competitions(name, market, timeframe)
        `)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setRuns(data || [])
    } catch (error) {
      console.error('Error fetching runs:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchCompetitions = async () => {
    try {
      const { data, error } = await supabase
        .from('arena_competitions')
        .select('id, name, status')
        .in('status', ['draft', 'running'])
      
      if (error) throw error
      setCompetitions(data || [])
    } catch (error) {
      console.error('Error fetching competitions:', error)
    }
  }

  const startNewRun = async () => {
    if (!selectedCompetition) {
      alert('Please select a competition first')
      return
    }

    setIsStarting(true)
    try {
      // Call API to start new run
      const response = await fetch('/api/runner/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competitionId: selectedCompetition })
      })

      if (!response.ok) {
        throw new Error('Failed to start run')
      }

      const result = await response.json()
      
      if (result.success) {
        fetchRuns()
        setSelectedCompetition('')
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('Error starting run:', error)
      alert('Error starting run: ' + (error as Error).message)
    } finally {
      setIsStarting(false)
    }
  }

  const stopRun = async (runId: string) => {
    try {
      const response = await fetch('/api/runner/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId })
      })

      if (!response.ok) {
        throw new Error('Failed to stop run')
      }

      fetchRuns()
    } catch (error) {
      console.error('Error stopping run:', error)
      alert('Error stopping run')
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <Play className="w-4 h-4 text-green-400" />
      case 'completed': return <CheckCircle className="w-4 h-4 text-blue-400" />
      case 'failed': return <XCircle className="w-4 h-4 text-red-400" />
      default: return <Clock className="w-4 h-4 text-yellow-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-green-600'
      case 'completed': return 'bg-blue-600'
      case 'failed': return 'bg-red-600'
      default: return 'bg-yellow-600'
    }
  }

  const getProgress = (run: Run) => {
    if (run.total_candles === 0) return 0
    return (run.current_candle_index / run.total_candles) * 100
  }

  if (isLoading) {
    return <div className="text-white">Loading runs...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-white">Simulation Runs</h1>
        
        <div className="flex items-center space-x-4">
          <select
            value={selectedCompetition}
            onChange={(e) => setSelectedCompetition(e.target.value)}
            className="px-3 py-2 bg-[#1a1a24] border border-gray-600 rounded text-white focus:outline-none focus:border-[#10b981]"
          >
            <option value="">Select Competition</option>
            {competitions.map((comp) => (
              <option key={comp.id} value={comp.id}>
                {comp.name} ({comp.status})
              </option>
            ))}
          </select>
          
          <button
            onClick={startNewRun}
            disabled={!selectedCompetition || isStarting}
            className="flex items-center px-4 py-2 bg-[#10b981] text-white rounded-lg hover:bg-[#059669] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isStarting ? (
              <RotateCcw className="w-5 h-5 mr-2 animate-spin" />
            ) : (
              <Play className="w-5 h-5 mr-2" />
            )}
            {isStarting ? 'Starting...' : 'Start New Run'}
          </button>
        </div>
      </div>

      {/* Runs Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {runs.map((run) => (
          <RunCard
            key={run.id}
            run={run}
            onStop={() => stopRun(run.id)}
          />
        ))}
      </div>

      {runs.length === 0 && (
        <div className="text-center py-12">
          <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">No Runs Yet</h3>
          <p className="text-gray-400">Start your first simulation run by selecting a competition above.</p>
        </div>
      )}
    </div>
  )
}

function RunCard({ run, onStop }: { run: Run; onStop: () => void }) {
  const progress = run.total_candles > 0 ? (run.current_candle_index / run.total_candles) * 100 : 0
  
  const formatDuration = (startTime: string, endTime?: string) => {
    const start = new Date(startTime)
    const end = endTime ? new Date(endTime) : new Date()
    const diff = Math.floor((end.getTime() - start.getTime()) / 1000)
    
    const hours = Math.floor(diff / 3600)
    const minutes = Math.floor((diff % 3600) / 60)
    const seconds = diff % 60
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`
    } else {
      return `${seconds}s`
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <Play className="w-4 h-4 text-green-400" />
      case 'completed': return <CheckCircle className="w-4 h-4 text-blue-400" />
      case 'failed': return <XCircle className="w-4 h-4 text-red-400" />
      default: return <Clock className="w-4 h-4 text-yellow-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-green-600'
      case 'completed': return 'bg-blue-600'
      case 'failed': return 'bg-red-600'
      default: return 'bg-yellow-600'
    }
  }

  return (
    <div className="bg-[#111118] rounded-lg p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-bold text-white mb-1">
            {(run as any).competition?.name || 'Unknown Competition'}
          </h3>
          <p className="text-gray-400 text-sm">
            {(run as any).competition?.market} - {(run as any).competition?.timeframe}
          </p>
        </div>
        
        <div className={`flex items-center px-2 py-1 rounded text-sm text-white ${getStatusColor(run.status)}`}>
          {getStatusIcon(run.status)}
          <span className="ml-1 capitalize">{run.status}</span>
        </div>
      </div>
      
      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-400 mb-2">
          <span>Progress</span>
          <span>{run.current_candle_index} / {run.total_candles}</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div
            className="bg-[#10b981] h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="text-xs text-gray-400 mt-1">
          {progress.toFixed(1)}% complete
        </div>
      </div>
      
      {/* Stats */}
      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Created:</span>
          <span className="text-white">
            {new Date(run.created_at).toLocaleDateString()}
          </span>
        </div>
        
        {run.started_at && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Duration:</span>
            <span className="text-white">
              {formatDuration(run.started_at, run.completed_at)}
            </span>
          </div>
        )}
      </div>
      
      {/* Actions */}
      <div className="flex space-x-2">
        <button
          className="flex-1 px-3 py-2 bg-[#1a1a24] text-gray-300 rounded hover:text-white transition-colors"
        >
          View Details
        </button>
        
        {run.status === 'running' && (
          <button
            onClick={onStop}
            className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            <Square className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}