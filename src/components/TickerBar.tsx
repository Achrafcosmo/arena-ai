'use client'
import { useEffect, useState } from 'react'

interface CoinPrice {
  id: string
  symbol: string
  usd: number
  change24h: number
}

const COINS = [
  { id: 'bitcoin', symbol: 'BTC' },
  { id: 'ethereum', symbol: 'ETH' },
  { id: 'solana', symbol: 'SOL' },
  { id: 'binancecoin', symbol: 'BNB' },
  { id: 'dogecoin', symbol: 'DOGE' },
  { id: 'ripple', symbol: 'XRP' },
]

export default function TickerBar() {
  const [prices, setPrices] = useState<CoinPrice[]>([])

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const res = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,binancecoin,dogecoin,ripple&vs_currencies=usd&include_24hr_change=true'
        )
        const data = await res.json()
        const parsed = COINS.map(c => ({
          id: c.id,
          symbol: c.symbol,
          usd: data[c.id]?.usd ?? 0,
          change24h: data[c.id]?.usd_24h_change ?? 0,
        }))
        setPrices(parsed)
      } catch {
        // silent fail
      }
    }
    fetchPrices()
    const iv = setInterval(fetchPrices, 60000)
    return () => clearInterval(iv)
  }, [])

  if (!prices.length) return null

  const items = [...prices, ...prices] // duplicate for seamless scroll

  return (
    <div className="bg-[#111118] border-b border-gray-800 overflow-hidden h-8 flex items-center">
      <div className="flex animate-scroll whitespace-nowrap">
        {items.map((p, i) => (
          <span key={`${p.id}-${i}`} className="mx-6 text-xs font-mono flex items-center gap-2">
            <span className="text-gray-400">{p.symbol}</span>
            <span className="text-white">${p.usd.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            <span className={p.change24h >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}>
              {p.change24h >= 0 ? '+' : ''}{p.change24h.toFixed(2)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}
