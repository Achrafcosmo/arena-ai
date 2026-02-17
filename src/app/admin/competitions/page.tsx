'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit, Play, Square, Trophy } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Competition {
  id: string
  name: string
  market: string
  timeframe: string
  initial_balance: number
  max_leverage: number
  fee_rate: number
  slippage_rate: number
  liquidation_threshold: number
  status: 'draft' | 'running' | 'finished'
  created_at: string
  updated_at: string
}

interface Model {
  id: string
  display_name: string
  enabled: boolean
}

export default function CompetitionsPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [models, setModels] = useState<Model[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingCompetition, setEditingCompetition] = useState<Competition | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchCompetitions()
    fetchModels()
  }, [])

  const fetchCompetitions = async () => {
    try {
      const { data, error } = await supabase
        .from('arena_competitions')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setCompetitions(data || [])
    } catch (error) {
      console.error('Error fetching competitions:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchModels = async () => {
    try {
      const { data, error } = await supabase
        .from('arena_models')
        .select('id, display_name, enabled')
        .eq('enabled', true)
      
      if (error) throw error
      setModels(data || [])
    } catch (error) {
      console.error('Error fetching models:', error)
    }
  }

  const updateCompetitionStatus = async (competitionId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('arena_competitions')
        .update({ 
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', competitionId)
      
      if (error) throw error
      fetchCompetitions()
    } catch (error) {
      console.error('Error updating competition status:', error)
    }
  }

  if (isLoading) {
    return <div className="text-white">Loading competitions...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-white">Competitions</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center px-4 py-2 bg-[#10b981] text-white rounded-lg hover:bg-[#059669] transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Create Competition
        </button>
      </div>

      {/* Competitions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {competitions.map((competition) => (
          <CompetitionCard
            key={competition.id}
            competition={competition}
            onStatusChange={updateCompetitionStatus}
            onEdit={() => {
              setEditingCompetition(competition)
              setShowForm(true)
            }}
          />
        ))}
      </div>

      {/* Competition Form Modal */}
      {showForm && (
        <CompetitionForm
          competition={editingCompetition}
          models={models}
          onClose={() => {
            setShowForm(false)
            setEditingCompetition(null)
          }}
          onSave={() => {
            fetchCompetitions()
            setShowForm(false)
            setEditingCompetition(null)
          }}
        />
      )}
    </div>
  )
}

function CompetitionCard({ competition, onStatusChange, onEdit }: {
  competition: Competition
  onStatusChange: (id: string, status: string) => void
  onEdit: () => void
}) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-green-600'
      case 'finished': return 'bg-gray-600'
      default: return 'bg-yellow-600'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <Play className="w-4 h-4" />
      case 'finished': return <Square className="w-4 h-4" />
      default: return <Trophy className="w-4 h-4" />
    }
  }

  return (
    <div className="bg-[#111118] rounded-lg p-6">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-bold text-white">{competition.name}</h3>
        <div className={`flex items-center px-2 py-1 rounded text-sm text-white ${getStatusColor(competition.status)}`}>
          {getStatusIcon(competition.status)}
          <span className="ml-1 capitalize">{competition.status}</span>
        </div>
      </div>
      
      <div className="space-y-2 mb-4">
        <div className="flex justify-between">
          <span className="text-gray-400">Market:</span>
          <span className="text-white">{competition.market}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Timeframe:</span>
          <span className="text-white">{competition.timeframe}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Initial Balance:</span>
          <span className="text-white">${competition.initial_balance.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Max Leverage:</span>
          <span className="text-white">{competition.max_leverage}x</span>
        </div>
      </div>
      
      <div className="flex space-x-2">
        <button
          onClick={onEdit}
          className="flex-1 flex items-center justify-center px-3 py-2 bg-[#1a1a24] text-gray-300 rounded hover:text-white transition-colors"
        >
          <Edit className="w-4 h-4 mr-1" />
          Edit
        </button>
        
        {competition.status === 'draft' && (
          <button
            onClick={() => onStatusChange(competition.id, 'running')}
            className="flex-1 flex items-center justify-center px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          >
            <Play className="w-4 h-4 mr-1" />
            Start
          </button>
        )}
        
        {competition.status === 'running' && (
          <button
            onClick={() => onStatusChange(competition.id, 'finished')}
            className="flex-1 flex items-center justify-center px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            <Square className="w-4 h-4 mr-1" />
            Stop
          </button>
        )}
      </div>
    </div>
  )
}

function CompetitionForm({ competition, models, onClose, onSave }: {
  competition: Competition | null
  models: Model[]
  onClose: () => void
  onSave: () => void
}) {
  const [formData, setFormData] = useState({
    name: competition?.name || '',
    market: competition?.market || 'BTC',
    timeframe: competition?.timeframe || '1h',
    initial_balance: competition?.initial_balance || 10000,
    max_leverage: competition?.max_leverage || 10,
    fee_rate: competition?.fee_rate || 0.001,
    slippage_rate: competition?.slippage_rate || 0.0005,
    liquidation_threshold: competition?.liquidation_threshold || 0.05
  })
  
  const [selectedModels, setSelectedModels] = useState<string[]>([])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      let competitionId = competition?.id
      
      if (competition) {
        // Update existing competition
        const { error } = await supabase
          .from('arena_competitions')
          .update({ 
            ...formData,
            updated_at: new Date().toISOString()
          })
          .eq('id', competition.id)
        
        if (error) throw error
      } else {
        // Create new competition
        const { data, error } = await supabase
          .from('arena_competitions')
          .insert([formData])
          .select()
        
        if (error) throw error
        if (data && data[0]) {
          competitionId = data[0].id
        }
      }

      // Update competition models if creating new competition
      if (!competition && competitionId && selectedModels.length > 0) {
        const competitionModels = selectedModels.map(modelId => ({
          competition_id: competitionId,
          model_id: modelId
        }))

        const { error: modelsError } = await supabase
          .from('arena_competition_models')
          .insert(competitionModels)
        
        if (modelsError) throw modelsError
      }
      
      onSave()
    } catch (error) {
      console.error('Error saving competition:', error)
      alert('Error saving competition')
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-[#111118] rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-white mb-4">
          {competition ? 'Edit Competition' : 'Create New Competition'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-1">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 bg-[#1a1a24] border border-gray-600 rounded text-white focus:outline-none focus:border-[#10b981]"
                placeholder="e.g., BTC Arena - 1H Candles"
                required
              />
            </div>
            
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-1">Market</label>
              <select
                value={formData.market}
                onChange={(e) => setFormData({ ...formData, market: e.target.value })}
                className="w-full px-3 py-2 bg-[#1a1a24] border border-gray-600 rounded text-white focus:outline-none focus:border-[#10b981]"
              >
                <option value="BTC">BTC</option>
                <option value="ETH">ETH</option>
                <option value="SOL">SOL</option>
                <option value="ADA">ADA</option>
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-1">Timeframe</label>
              <select
                value={formData.timeframe}
                onChange={(e) => setFormData({ ...formData, timeframe: e.target.value })}
                className="w-full px-3 py-2 bg-[#1a1a24] border border-gray-600 rounded text-white focus:outline-none focus:border-[#10b981]"
              >
                <option value="5m">5 minutes</option>
                <option value="15m">15 minutes</option>
                <option value="1h">1 hour</option>
                <option value="4h">4 hours</option>
                <option value="1d">1 day</option>
              </select>
            </div>
            
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-1">Initial Balance ($)</label>
              <input
                type="number"
                value={formData.initial_balance}
                onChange={(e) => setFormData({ ...formData, initial_balance: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 bg-[#1a1a24] border border-gray-600 rounded text-white focus:outline-none focus:border-[#10b981]"
                required
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-1">Max Leverage</label>
              <input
                type="number"
                value={formData.max_leverage}
                onChange={(e) => setFormData({ ...formData, max_leverage: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-[#1a1a24] border border-gray-600 rounded text-white focus:outline-none focus:border-[#10b981]"
                min="1"
                max="100"
                required
              />
            </div>
            
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-1">Fee Rate (%)</label>
              <input
                type="number"
                step="0.001"
                value={formData.fee_rate}
                onChange={(e) => setFormData({ ...formData, fee_rate: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 bg-[#1a1a24] border border-gray-600 rounded text-white focus:outline-none focus:border-[#10b981]"
                required
              />
            </div>
            
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-1">Slippage Rate (%)</label>
              <input
                type="number"
                step="0.0001"
                value={formData.slippage_rate}
                onChange={(e) => setFormData({ ...formData, slippage_rate: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 bg-[#1a1a24] border border-gray-600 rounded text-white focus:outline-none focus:border-[#10b981]"
                required
              />
            </div>
          </div>

          {!competition && (
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">Select Models</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto bg-[#1a1a24] rounded p-3">
                {models.map((model) => (
                  <label key={model.id} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedModels.includes(model.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedModels([...selectedModels, model.id])
                        } else {
                          setSelectedModels(selectedModels.filter(id => id !== model.id))
                        }
                      }}
                      className="mr-2"
                    />
                    <span className="text-gray-300 text-sm">{model.display_name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          
          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#10b981] text-white rounded hover:bg-[#059669] transition-colors"
            >
              {competition ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}