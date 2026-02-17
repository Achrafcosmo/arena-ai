'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2 } from 'lucide-react'
import { supabaseAdmin } from '@/lib/supabase'

interface Model {
  id: string
  display_name: string
  provider: string
  model_id: string
  base_url?: string
  strategy_mode?: string
  icon_url?: string
  enabled: boolean
  daily_budget_cap: number
  daily_budget_used: number
  error_count: number
  created_at: string
}

export default function ModelsPage() {
  const [models, setModels] = useState<Model[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingModel, setEditingModel] = useState<Model | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchModels()
  }, [])

  const fetchModels = async () => {
    try {
      const { data, error } = await supabaseAdmin
        .from('arena_models')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setModels(data || [])
    } catch (error) {
      console.error('Error fetching models:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const toggleModel = async (modelId: string, enabled: boolean) => {
    try {
      const { error } = await supabaseAdmin
        .from('arena_models')
        .update({ enabled })
        .eq('id', modelId)
      
      if (error) throw error
      fetchModels()
    } catch (error) {
      console.error('Error toggling model:', error)
    }
  }

  const deleteModel = async (modelId: string) => {
    if (!confirm('Are you sure you want to delete this model?')) return
    
    try {
      const { error } = await supabaseAdmin
        .from('arena_models')
        .delete()
        .eq('id', modelId)
      
      if (error) throw error
      fetchModels()
    } catch (error) {
      console.error('Error deleting model:', error)
    }
  }

  if (isLoading) {
    return <div className="text-white">Loading models...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-white">AI Models</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center px-4 py-2 bg-[#10b981] text-white rounded-lg hover:bg-[#059669] transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Model
        </button>
      </div>

      {/* Models Table */}
      <div className="bg-[#111118] rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#1a1a24]">
              <tr>
                <th className="text-left p-4 text-gray-300 font-medium">Name</th>
                <th className="text-left p-4 text-gray-300 font-medium">Provider</th>
                <th className="text-left p-4 text-gray-300 font-medium">Model ID</th>
                <th className="text-left p-4 text-gray-300 font-medium">Strategy</th>
                <th className="text-left p-4 text-gray-300 font-medium">Status</th>
                <th className="text-left p-4 text-gray-300 font-medium">Budget</th>
                <th className="text-left p-4 text-gray-300 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {models.map((model) => (
                <tr key={model.id} className="border-t border-gray-700">
                  <td className="p-4">
                    <div className="flex items-center">
                      {model.icon_url && (
                        <img src={model.icon_url} alt="" className="w-6 h-6 rounded mr-2" />
                      )}
                      <span className="text-white font-medium">{model.display_name}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-1 bg-[#1a1a24] text-gray-300 text-sm rounded capitalize">
                      {model.provider}
                    </span>
                  </td>
                  <td className="p-4 text-gray-300">{model.model_id}</td>
                  <td className="p-4 text-gray-300">{model.strategy_mode || '-'}</td>
                  <td className="p-4">
                    <button
                      onClick={() => toggleModel(model.id, !model.enabled)}
                      className={`px-2 py-1 text-sm rounded ${
                        model.enabled
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-600 text-gray-300'
                      }`}
                    >
                      {model.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </td>
                  <td className="p-4 text-gray-300">
                    ${model.daily_budget_used.toFixed(2)} / ${model.daily_budget_cap.toFixed(2)}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          setEditingModel(model)
                          setShowForm(true)
                        }}
                        className="p-1 text-gray-400 hover:text-white transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteModel(model.id)}
                        className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Model Form Modal */}
      {showForm && (
        <ModelForm
          model={editingModel}
          onClose={() => {
            setShowForm(false)
            setEditingModel(null)
          }}
          onSave={() => {
            fetchModels()
            setShowForm(false)
            setEditingModel(null)
          }}
        />
      )}
    </div>
  )
}

function ModelForm({ model, onClose, onSave }: {
  model: Model | null
  onClose: () => void
  onSave: () => void
}) {
  const [formData, setFormData] = useState({
    display_name: model?.display_name || '',
    provider: model?.provider || 'openai',
    model_id: model?.model_id || '',
    base_url: model?.base_url || '',
    strategy_mode: model?.strategy_mode || '',
    icon_url: model?.icon_url || '',
    enabled: model?.enabled ?? true,
    daily_budget_cap: model?.daily_budget_cap || 1.0
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      if (model) {
        // Update existing model
        const { error } = await supabaseAdmin
          .from('arena_models')
          .update(formData)
          .eq('id', model.id)
        
        if (error) throw error
      } else {
        // Create new model
        const { error } = await supabaseAdmin
          .from('arena_models')
          .insert([formData])
        
        if (error) throw error
      }
      
      onSave()
    } catch (error) {
      console.error('Error saving model:', error)
      alert('Error saving model')
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-[#111118] rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold text-white mb-4">
          {model ? 'Edit Model' : 'Add New Model'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-1">Display Name</label>
            <input
              type="text"
              value={formData.display_name}
              onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
              className="w-full px-3 py-2 bg-[#1a1a24] border border-gray-600 rounded text-white focus:outline-none focus:border-[#10b981]"
              required
            />
          </div>
          
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-1">Provider</label>
            <select
              value={formData.provider}
              onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
              className="w-full px-3 py-2 bg-[#1a1a24] border border-gray-600 rounded text-white focus:outline-none focus:border-[#10b981]"
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="xai">xAI</option>
              <option value="google">Google</option>
              <option value="deepseek">DeepSeek</option>
              <option value="ollama">Ollama</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-1">Model ID</label>
            <input
              type="text"
              value={formData.model_id}
              onChange={(e) => setFormData({ ...formData, model_id: e.target.value })}
              className="w-full px-3 py-2 bg-[#1a1a24] border border-gray-600 rounded text-white focus:outline-none focus:border-[#10b981]"
              placeholder="e.g., gpt-4, claude-3-sonnet"
              required
            />
          </div>
          
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-1">Base URL (optional)</label>
            <input
              type="text"
              value={formData.base_url}
              onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
              className="w-full px-3 py-2 bg-[#1a1a24] border border-gray-600 rounded text-white focus:outline-none focus:border-[#10b981]"
              placeholder="For custom endpoints"
            />
          </div>
          
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-1">Strategy Mode</label>
            <input
              type="text"
              value={formData.strategy_mode}
              onChange={(e) => setFormData({ ...formData, strategy_mode: e.target.value })}
              className="w-full px-3 py-2 bg-[#1a1a24] border border-gray-600 rounded text-white focus:outline-none focus:border-[#10b981]"
              placeholder="e.g., MONK MODE, MAX LEVERAGE"
            />
          </div>
          
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-1">Icon URL (optional)</label>
            <input
              type="url"
              value={formData.icon_url}
              onChange={(e) => setFormData({ ...formData, icon_url: e.target.value })}
              className="w-full px-3 py-2 bg-[#1a1a24] border border-gray-600 rounded text-white focus:outline-none focus:border-[#10b981]"
            />
          </div>
          
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-1">Daily Budget Cap ($)</label>
            <input
              type="number"
              step="0.01"
              value={formData.daily_budget_cap}
              onChange={(e) => setFormData({ ...formData, daily_budget_cap: parseFloat(e.target.value) })}
              className="w-full px-3 py-2 bg-[#1a1a24] border border-gray-600 rounded text-white focus:outline-none focus:border-[#10b981]"
            />
          </div>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={formData.enabled}
              onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
              className="mr-2"
            />
            <label className="text-gray-300 text-sm">Enabled</label>
          </div>
          
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
              {model ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}