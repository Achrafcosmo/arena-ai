export interface CandleData {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

// Cache for market data to avoid repeated API calls
const candleCache = new Map<string, { data: CandleData[]; timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export async function fetchCandles(
  market: string,
  timeframe: string,
  limit: number = 1000
): Promise<CandleData[]> {
  const cacheKey = `${market}-${timeframe}-${limit}`
  const cached = candleCache.get(cacheKey)
  
  // Return cached data if still valid
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data
  }

  try {
    // Convert timeframe to Binance format
    const binanceInterval = convertTimeframe(timeframe)
    const symbol = convertSymbol(market)
    
    // Fetch from Binance public API
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${binanceInterval}&limit=${limit}`
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Arena-AI/1.0'
      }
    })
    
    if (!response.ok) {
      throw new Error(`Binance API error: ${response.status} ${response.statusText}`)
    }
    
    const data = await response.json()
    
    // Convert Binance kline data to our format
    const candles: CandleData[] = data.map((kline: any[]) => ({
      timestamp: kline[0], // Open time
      open: parseFloat(kline[1]),
      high: parseFloat(kline[2]),
      low: parseFloat(kline[3]),
      close: parseFloat(kline[4]),
      volume: parseFloat(kline[5])
    }))
    
    // Cache the data
    candleCache.set(cacheKey, {
      data: candles,
      timestamp: Date.now()
    })
    
    console.log(`Fetched ${candles.length} candles for ${market} ${timeframe}`)
    return candles
    
  } catch (error) {
    console.error(`Error fetching market data for ${market}:`, error)
    
    // Return mock data for development/demo if API fails
    return generateMockCandles(limit)
  }
}

function convertTimeframe(timeframe: string): string {
  const mapping: { [key: string]: string } = {
    '1m': '1m',
    '5m': '5m',
    '15m': '15m',
    '30m': '30m',
    '1h': '1h',
    '4h': '4h',
    '1d': '1d',
    '1w': '1w'
  }
  
  return mapping[timeframe] || '1h'
}

function convertSymbol(market: string): string {
  const mapping: { [key: string]: string } = {
    'BTC': 'BTCUSDT',
    'ETH': 'ETHUSDT',
    'SOL': 'SOLUSDT',
    'ADA': 'ADAUSDT',
    'DOT': 'DOTUSDT',
    'LINK': 'LINKUSDT',
    'UNI': 'UNIUSDT',
    'AVAX': 'AVAXUSDT',
    'MATIC': 'MATICUSDT',
    'ATOM': 'ATOMUSDT'
  }
  
  return mapping[market.toUpperCase()] || 'BTCUSDT'
}

function generateMockCandles(limit: number): CandleData[] {
  const candles: CandleData[] = []
  const now = Date.now()
  const interval = 60 * 60 * 1000 // 1 hour intervals
  
  let price = 50000 + Math.random() * 20000 // Random starting price between 50k-70k
  
  for (let i = limit - 1; i >= 0; i--) {
    const timestamp = now - (i * interval)
    
    // Generate realistic price movement
    const volatility = 0.02 // 2% volatility
    const trend = (Math.random() - 0.5) * 0.001 // Small trend component
    const change = (Math.random() - 0.5) * volatility + trend
    
    const open = price
    const close = open * (1 + change)
    
    // Generate high/low with realistic spread
    const highLowSpread = Math.abs(change) + Math.random() * 0.01
    const high = Math.max(open, close) * (1 + highLowSpread / 2)
    const low = Math.min(open, close) * (1 - highLowSpread / 2)
    
    // Generate volume (random but realistic)
    const volume = 100 + Math.random() * 500
    
    candles.push({
      timestamp,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: Number(volume.toFixed(2))
    })
    
    price = close // Update price for next candle
  }
  
  console.log(`Generated ${candles.length} mock candles (API unavailable)`)
  return candles
}

export async function getCurrentPrice(market: string): Promise<number> {
  try {
    const symbol = convertSymbol(market)
    const url = `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`
    
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Binance price API error: ${response.status}`)
    }
    
    const data = await response.json()
    return parseFloat(data.price)
    
  } catch (error) {
    console.error(`Error fetching current price for ${market}:`, error)
    
    // Return mock price
    return 50000 + Math.random() * 20000
  }
}

// Technical indicators for enhanced market analysis
export function calculateSMA(candles: CandleData[], period: number): number[] {
  const sma: number[] = []
  
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      sma.push(NaN)
    } else {
      const sum = candles.slice(i - period + 1, i + 1)
        .reduce((acc, candle) => acc + candle.close, 0)
      sma.push(sum / period)
    }
  }
  
  return sma
}

export function calculateEMA(candles: CandleData[], period: number): number[] {
  const ema: number[] = []
  const multiplier = 2 / (period + 1)
  
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      ema.push(candles[0].close)
    } else {
      ema.push((candles[i].close - ema[i - 1]) * multiplier + ema[i - 1])
    }
  }
  
  return ema
}

export function calculateRSI(candles: CandleData[], period: number = 14): number[] {
  const rsi: number[] = []
  const gains: number[] = []
  const losses: number[] = []
  
  for (let i = 1; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close
    gains.push(change > 0 ? change : 0)
    losses.push(change < 0 ? Math.abs(change) : 0)
  }
  
  for (let i = 0; i < gains.length; i++) {
    if (i < period - 1) {
      rsi.push(NaN)
    } else {
      const avgGain = gains.slice(i - period + 1, i + 1)
        .reduce((acc, gain) => acc + gain, 0) / period
      const avgLoss = losses.slice(i - period + 1, i + 1)
        .reduce((acc, loss) => acc + loss, 0) / period
      
      if (avgLoss === 0) {
        rsi.push(100)
      } else {
        const rs = avgGain / avgLoss
        rsi.push(100 - (100 / (1 + rs)))
      }
    }
  }
  
  // Add NaN for first candle since we need at least 2 candles for RSI
  rsi.unshift(NaN)
  
  return rsi
}

export function calculateVolatility(candles: CandleData[], period: number = 20): number {
  if (candles.length < period) {
    return 0
  }
  
  const recentCandles = candles.slice(-period)
  const returns = recentCandles.slice(1).map((candle, i) => 
    Math.log(candle.close / recentCandles[i].close)
  )
  
  const mean = returns.reduce((acc, ret) => acc + ret, 0) / returns.length
  const variance = returns.reduce((acc, ret) => acc + Math.pow(ret - mean, 2), 0) / returns.length
  
  // Annualized volatility (assuming hourly data)
  return Math.sqrt(variance * 24 * 365)
}