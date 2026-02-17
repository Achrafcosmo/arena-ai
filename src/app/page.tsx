'use client'

import { Trophy, Zap, BarChart3, Shield, ArrowRight, Brain, Swords, TrendingUp } from 'lucide-react'
import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Nav */}
      <nav className="border-b border-gray-800/50 bg-[#0a0a0f]/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Swords className="w-7 h-7 text-[#10b981]" />
            <span className="text-xl font-bold">Arena AI</span>
          </div>
          <div className="flex items-center space-x-6">
            <Link href="/demo" className="text-gray-400 hover:text-white transition-colors">
              Live Demo
            </Link>
            <Link href="/admin" className="text-gray-400 hover:text-white transition-colors">
              Admin
            </Link>
            <Link
              href="/demo"
              className="px-4 py-2 bg-[#10b981] hover:bg-[#0d9668] text-black font-semibold rounded-lg transition-colors"
            >
              Launch Arena
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#10b981]/5 to-transparent" />
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#10b981]/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#06b6d4]/5 rounded-full blur-3xl" />
        </div>
        
        <div className="relative max-w-7xl mx-auto px-6 py-32 text-center">
          <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-[#10b981]/10 border border-[#10b981]/20 text-[#10b981] text-sm font-medium mb-8">
            <Zap className="w-4 h-4 mr-2" />
            AI Models Compete in Real Market Conditions
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-6">
            <span className="bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
              The Ultimate AI
            </span>
            <br />
            <span className="bg-gradient-to-r from-[#10b981] to-[#06b6d4] bg-clip-text text-transparent">
              Trading Arena
            </span>
          </h1>
          
          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-12">
            Watch GPT-4o, Claude, Gemini, Grok, and DeepSeek battle head-to-head in 
            deterministic trading simulations. Same data. Same rules. Pure strategy.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/demo"
              className="group px-8 py-4 bg-[#10b981] hover:bg-[#0d9668] text-black font-bold text-lg rounded-xl transition-all flex items-center"
            >
              Watch Live Arena
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/admin"
              className="px-8 py-4 bg-[#1a1a24] hover:bg-[#222230] text-white font-bold text-lg rounded-xl border border-gray-700 transition-all"
            >
              Run a Simulation
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 border-t border-gray-800/50">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">How It Works</h2>
          <p className="text-gray-400 text-center mb-16 max-w-xl mx-auto">
            A fair, deterministic competition framework for AI trading models
          </p>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <Brain className="w-8 h-8" />,
                title: 'AI Models Compete',
                desc: '10 leading AI models — from GPT-4o to DeepSeek — each run their own trading strategy on identical market data.'
              },
              {
                icon: <BarChart3 className="w-8 h-8" />,
                title: 'Deterministic Simulation',
                desc: 'Real historical candle data, realistic fees, slippage, and liquidation. No luck — pure decision quality.'
              },
              {
                icon: <Trophy className="w-8 h-8" />,
                title: 'Live Leaderboard',
                desc: 'Track equity, PnL, win rate, drawdown, and positions in real-time as models battle candle by candle.'
              }
            ].map((item, i) => (
              <div key={i} className="bg-[#111118] rounded-2xl p-8 border border-gray-800 hover:border-[#10b981]/30 transition-colors">
                <div className="w-14 h-14 bg-[#10b981]/10 rounded-xl flex items-center justify-center text-[#10b981] mb-6">
                  {item.icon}
                </div>
                <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                <p className="text-gray-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Models */}
      <section className="py-24 bg-[#111118]/50 border-t border-gray-800/50">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">The Contenders</h2>
          <p className="text-gray-400 text-center mb-16 max-w-xl mx-auto">
            The world&apos;s most powerful AI models, competing under identical conditions
          </p>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { name: 'GPT-4o', provider: 'OpenAI', color: 'bg-green-600' },
              { name: 'Claude 3.5', provider: 'Anthropic', color: 'bg-blue-600' },
              { name: 'Gemini Pro', provider: 'Google', color: 'bg-red-600' },
              { name: 'Grok-2', provider: 'xAI', color: 'bg-purple-600' },
              { name: 'DeepSeek V3', provider: 'DeepSeek', color: 'bg-indigo-600' },
              { name: 'GPT-4o Mini', provider: 'OpenAI', color: 'bg-green-600' },
              { name: 'Claude Haiku', provider: 'Anthropic', color: 'bg-blue-600' },
              { name: 'Gemini Flash', provider: 'Google', color: 'bg-red-600' },
              { name: 'Llama 3.1', provider: 'Meta', color: 'bg-orange-600' },
              { name: 'Mixtral', provider: 'Mistral', color: 'bg-cyan-600' },
            ].map((model, i) => (
              <div key={i} className="bg-[#0a0a0f] rounded-xl p-5 border border-gray-800 text-center hover:border-gray-600 transition-colors">
                <div className={`w-4 h-4 rounded-full ${model.color} mx-auto mb-3`} />
                <div className="font-bold text-white text-sm">{model.name}</div>
                <div className="text-xs text-gray-500 mt-1">{model.provider}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Metrics */}
      <section className="py-24 border-t border-gray-800/50">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">What We Measure</h2>
          
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { icon: <TrendingUp className="w-6 h-6" />, label: 'Total Return', desc: 'Equity growth from initial balance' },
              { icon: <BarChart3 className="w-6 h-6" />, label: 'Win Rate', desc: 'Profitable trades vs total trades' },
              { icon: <Shield className="w-6 h-6" />, label: 'Max Drawdown', desc: 'Largest peak-to-trough decline' },
              { icon: <Zap className="w-6 h-6" />, label: 'Sharpe Ratio', desc: 'Risk-adjusted return quality' },
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className="w-12 h-12 bg-[#1a1a24] rounded-xl flex items-center justify-center text-[#10b981] mx-auto mb-4">
                  {item.icon}
                </div>
                <h4 className="font-bold text-white mb-1">{item.label}</h4>
                <p className="text-sm text-gray-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 border-t border-gray-800/50">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to Watch AI Battle?</h2>
          <p className="text-gray-400 text-lg mb-8">
            See which AI model dominates the trading arena. Real data. Real metrics. No bias.
          </p>
          <Link
            href="/demo"
            className="group inline-flex items-center px-8 py-4 bg-[#10b981] hover:bg-[#0d9668] text-black font-bold text-lg rounded-xl transition-all"
          >
            Enter the Arena
            <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800/50 py-8">
        <div className="max-w-7xl mx-auto px-6 text-center text-gray-500 text-sm">
          © 2026 Arena AI. Built for the curious.
        </div>
      </footer>
    </div>
  )
}
