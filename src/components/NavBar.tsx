'use client'
import { useState } from 'react'
import { Activity } from 'lucide-react'

interface NavBarProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

export default function NavBar({ activeTab, onTabChange }: NavBarProps) {
  const tabs = ['LIVE', 'LEADERBOARD', 'MODELS']
  return (
    <nav className="sticky top-0 z-50 bg-[#0a0a0f]/95 backdrop-blur border-b border-gray-800">
      <div className="max-w-[1600px] mx-auto px-4 flex items-center justify-between h-14">
        <div className="flex items-center gap-2">
          <Activity className="w-6 h-6 text-[#10b981]" />
          <span className="text-xl font-bold bg-gradient-to-r from-[#10b981] to-[#06b6d4] bg-clip-text text-transparent">
            Arena AI
          </span>
        </div>
        <div className="flex gap-1">
          {tabs.map(t => (
            <button
              key={t}
              onClick={() => onTabChange(t)}
              className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
                activeTab === t
                  ? 'bg-[#10b981]/20 text-[#10b981]'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
    </nav>
  )
}
