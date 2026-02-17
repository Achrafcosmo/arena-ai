'use client'

import { useState, useEffect } from 'react'
import { AlertCircle, Info, AlertTriangle, RefreshCw, Filter } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface LogEntry {
  id: string
  run_id: string
  model_id: string
  level: 'info' | 'warn' | 'error'
  message: string
  metadata: any
  created_at: string
  model?: {
    display_name: string
  }
  run?: {
    competition?: {
      name: string
    }
  }
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(false)

  useEffect(() => {
    fetchLogs()
  }, [])

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    if (autoRefresh) {
      interval = setInterval(fetchLogs, 5000) // Refresh every 5 seconds
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [autoRefresh])

  useEffect(() => {
    filterLogs()
  }, [logs, levelFilter, searchQuery])

  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('arena_logs')
        .select(`
          *,
          model:arena_models(display_name),
          run:arena_runs(
            competition:arena_competitions(name)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(500)
      
      if (error) throw error
      setLogs(data || [])
    } catch (error) {
      console.error('Error fetching logs:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const filterLogs = () => {
    let filtered = logs

    // Filter by level
    if (levelFilter !== 'all') {
      filtered = filtered.filter(log => log.level === levelFilter)
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(log =>
        log.message.toLowerCase().includes(query) ||
        (log.model as any)?.display_name?.toLowerCase().includes(query) ||
        JSON.stringify(log.metadata).toLowerCase().includes(query)
      )
    }

    setFilteredLogs(filtered)
  }

  const clearLogs = async () => {
    if (!confirm('Are you sure you want to clear all logs? This action cannot be undone.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('arena_logs')
        .delete()
        .gte('id', '00000000-0000-0000-0000-000000000000')
      
      if (error) throw error
      fetchLogs()
    } catch (error) {
      console.error('Error clearing logs:', error)
      alert('Error clearing logs')
    }
  }

  const getLogIcon = (level: string) => {
    switch (level) {
      case 'error': return <AlertCircle className="w-5 h-5 text-red-400" />
      case 'warn': return <AlertTriangle className="w-5 h-5 text-yellow-400" />
      default: return <Info className="w-5 h-5 text-blue-400" />
    }
  }

  const getLogColor = (level: string) => {
    switch (level) {
      case 'error': return 'border-red-500 bg-red-950/20'
      case 'warn': return 'border-yellow-500 bg-yellow-950/20'
      default: return 'border-blue-500 bg-blue-950/20'
    }
  }

  if (isLoading) {
    return <div className="text-white">Loading logs...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-white">System Logs</h1>
        
        <div className="flex items-center space-x-4">
          <label className="flex items-center text-gray-300">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="mr-2"
            />
            Auto-refresh
          </label>
          
          <button
            onClick={fetchLogs}
            className="flex items-center px-3 py-2 bg-[#1a1a24] text-gray-300 rounded hover:text-white transition-colors"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
          
          <button
            onClick={clearLogs}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Clear All Logs
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex items-center space-x-2">
          <Filter className="w-5 h-5 text-gray-400" />
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="px-3 py-2 bg-[#1a1a24] border border-gray-600 rounded text-white focus:outline-none focus:border-[#10b981]"
          >
            <option value="all">All Levels</option>
            <option value="info">Info</option>
            <option value="warn">Warning</option>
            <option value="error">Error</option>
          </select>
        </div>
        
        <input
          type="text"
          placeholder="Search logs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 px-3 py-2 bg-[#1a1a24] border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-[#10b981]"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-[#111118] rounded-lg p-4">
          <div className="flex items-center">
            <Info className="w-5 h-5 text-blue-400 mr-2" />
            <div>
              <p className="text-gray-400 text-sm">Info</p>
              <p className="text-white font-bold">
                {logs.filter(log => log.level === 'info').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-[#111118] rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-yellow-400 mr-2" />
            <div>
              <p className="text-gray-400 text-sm">Warnings</p>
              <p className="text-white font-bold">
                {logs.filter(log => log.level === 'warn').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-[#111118] rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-400 mr-2" />
            <div>
              <p className="text-gray-400 text-sm">Errors</p>
              <p className="text-white font-bold">
                {logs.filter(log => log.level === 'error').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-[#111118] rounded-lg p-4">
          <div className="flex items-center">
            <RefreshCw className="w-5 h-5 text-gray-400 mr-2" />
            <div>
              <p className="text-gray-400 text-sm">Total</p>
              <p className="text-white font-bold">{logs.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Logs List */}
      <div className="space-y-3">
        {filteredLogs.map((log) => (
          <div
            key={log.id}
            className={`border-l-4 bg-[#111118] rounded-r-lg p-4 ${getLogColor(log.level)}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3 flex-1">
                {getLogIcon(log.level)}
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-white font-medium">{log.message}</span>
                    <span className={`px-2 py-1 text-xs rounded uppercase font-medium ${
                      log.level === 'error' ? 'bg-red-600 text-white' :
                      log.level === 'warn' ? 'bg-yellow-600 text-white' :
                      'bg-blue-600 text-white'
                    }`}>
                      {log.level}
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-4 text-sm text-gray-400">
                    {(log.model as any)?.display_name && (
                      <span>Model: {(log.model as any).display_name}</span>
                    )}
                    {(log.run as any)?.competition?.name && (
                      <span>Competition: {(log.run as any).competition.name}</span>
                    )}
                    <span>
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </div>
                  
                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <details className="mt-2">
                      <summary className="text-gray-400 text-sm cursor-pointer hover:text-white">
                        Metadata
                      </summary>
                      <pre className="mt-2 p-2 bg-[#1a1a24] rounded text-xs text-gray-300 overflow-x-auto">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredLogs.length === 0 && (
        <div className="text-center py-12">
          <Info className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">No Logs Found</h3>
          <p className="text-gray-400">
            {searchQuery || levelFilter !== 'all' 
              ? 'No logs match your current filters.'
              : 'System logs will appear here as simulations run.'
            }
          </p>
        </div>
      )}
    </div>
  )
}