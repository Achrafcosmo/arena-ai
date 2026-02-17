'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, Users, Trophy, Play, FileText, LogOut } from 'lucide-react'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const auth = sessionStorage.getItem('admin_auth')
    if (auth === 'authenticated') {
      setIsAuthenticated(true)
    }
    setIsLoading(false)
  }, [])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === 'Arena@2026') {
      sessionStorage.setItem('admin_auth', 'authenticated')
      setIsAuthenticated(true)
    } else {
      alert('Invalid password')
    }
  }

  const handleLogout = () => {
    sessionStorage.removeItem('admin_auth')
    setIsAuthenticated(false)
    router.push('/admin')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="bg-[#111118] p-8 rounded-lg shadow-xl w-96">
          <div className="flex items-center justify-center mb-6">
            <Shield className="w-8 h-8 text-[#10b981] mr-2" />
            <h1 className="text-2xl font-bold text-white">Admin Access</h1>
          </div>
          
          <form onSubmit={handleLogin}>
            <div className="mb-6">
              <label className="block text-gray-300 text-sm font-medium mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-[#1a1a24] border border-gray-600 rounded-lg text-white focus:outline-none focus:border-[#10b981]"
                placeholder="Enter admin password"
                required
              />
            </div>
            
            <button
              type="submit"
              className="w-full bg-[#10b981] text-white py-2 px-4 rounded-lg hover:bg-[#059669] transition-colors font-medium"
            >
              Access Admin Panel
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 bg-[#111118] min-h-screen">
          <div className="p-6">
            <div className="flex items-center mb-8">
              <Shield className="w-8 h-8 text-[#10b981] mr-2" />
              <h1 className="text-xl font-bold text-white">Arena Admin</h1>
            </div>
            
            <nav className="space-y-2">
              <NavLink href="/admin" icon={<Trophy />} text="Overview" />
              <NavLink href="/admin/models" icon={<Users />} text="Models" />
              <NavLink href="/admin/competitions" icon={<Trophy />} text="Competitions" />
              <NavLink href="/admin/runs" icon={<Play />} text="Runs" />
              <NavLink href="/admin/logs" icon={<FileText />} text="Logs" />
            </nav>
            
            <button
              onClick={handleLogout}
              className="flex items-center w-full mt-8 px-3 py-2 text-gray-300 hover:text-white hover:bg-[#1a1a24] rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5 mr-3" />
              Logout
            </button>
          </div>
        </div>
        
        {/* Main Content */}
        <div className="flex-1 p-6">
          {children}
        </div>
      </div>
    </div>
  )
}

function NavLink({ href, icon, text }: { href: string; icon: React.ReactNode; text: string }) {
  return (
    <a
      href={href}
      className="flex items-center px-3 py-2 text-gray-300 hover:text-white hover:bg-[#1a1a24] rounded-lg transition-colors"
    >
      <span className="w-5 h-5 mr-3">{icon}</span>
      {text}
    </a>
  )
}