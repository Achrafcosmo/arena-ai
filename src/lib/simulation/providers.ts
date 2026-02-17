interface MarketData {
  current_price: number
  candles: {
    timestamp: number
    open: number
    high: number
    low: number
    close: number
    volume: number
  }[]
}

interface AccountState {
  balance: number
  equity: number
  position_side: 'none' | 'long' | 'short'
  position_size: number
  position_entry_price?: number
  position_leverage: number
  unrealized_pnl: number
  realized_pnl: number
  total_trades: number
  winning_trades: number
}

interface SimulationConfig {
  market: string
  timeframe: string
  initial_balance: number
  max_leverage: number
  fee_rate: number
  slippage_rate: number
  liquidation_threshold: number
}

interface TradeDecision {
  action: 'LONG' | 'SHORT' | 'CLOSE' | 'HOLD'
  leverage: number
  size_pct: number
  reason: string
}

export class ModelProvider {
  private provider: string
  private modelId: string
  private baseUrl?: string

  constructor(provider: string, modelId: string, baseUrl?: string) {
    this.provider = provider
    this.modelId = modelId
    this.baseUrl = baseUrl
  }

  async getTradeDecision(
    marketData: MarketData,
    accountState: AccountState,
    config: SimulationConfig
  ): Promise<TradeDecision> {
    const prompt = this.buildPrompt(marketData, accountState, config)
    
    try {
      switch (this.provider) {
        case 'openai':
          return await this.callOpenAI(prompt)
        case 'anthropic':
          return await this.callAnthropic(prompt)
        case 'google':
          return await this.callGoogle(prompt)
        case 'xai':
          return await this.callXAI(prompt)
        case 'deepseek':
          return await this.callDeepSeek(prompt)
        case 'ollama':
          return await this.callOllama(prompt)
        case 'custom':
          return await this.callCustom(prompt)
        default:
          return this.generateRandomDecision(config)
      }
    } catch (error) {
      console.error(`Provider ${this.provider} error:`, error)
      return this.generateRandomDecision(config)
    }
  }

  private buildPrompt(marketData: MarketData, accountState: AccountState, config: SimulationConfig): string {
    const recentCandles = marketData.candles.slice(-20) // Last 20 candles for context
    
    const candleData = recentCandles.map((c, i) => 
      `${i + 1}: O:${c.open} H:${c.high} L:${c.low} C:${c.close} V:${c.volume}`
    ).join('\n')

    return `You are an AI trading model participating in a ${config.market} trading competition.
    
MARKET DATA (${config.timeframe} timeframe):
Current Price: $${marketData.current_price}
Recent Candles (most recent last):
${candleData}

ACCOUNT STATE:
Balance: $${accountState.balance.toFixed(2)}
Equity: $${accountState.equity.toFixed(2)}
Current Position: ${accountState.position_side} 
Position Size: ${accountState.position_size.toFixed(6)}
Entry Price: ${accountState.position_entry_price ? '$' + accountState.position_entry_price.toFixed(2) : 'None'}
Leverage: ${accountState.position_leverage}x
Unrealized P&L: $${accountState.unrealized_pnl.toFixed(2)}
Realized P&L: $${accountState.realized_pnl.toFixed(2)}
Total Trades: ${accountState.total_trades}
Winning Trades: ${accountState.winning_trades}
Win Rate: ${accountState.total_trades > 0 ? (accountState.winning_trades / accountState.total_trades * 100).toFixed(1) : '0'}%

COMPETITION RULES:
- Max Leverage: ${config.max_leverage}x
- Fee Rate: ${(config.fee_rate * 100).toFixed(3)}%
- Slippage: ${(config.slippage_rate * 100).toFixed(3)}%
- Liquidation Threshold: ${(config.liquidation_threshold * 100).toFixed(1)}%

RESPOND WITH VALID JSON ONLY:
{
  "action": "LONG|SHORT|CLOSE|HOLD",
  "leverage": 1-${config.max_leverage},
  "size_pct": 0.0-1.0,
  "reason": "Brief explanation of your decision"
}

RULES:
- LONG: Buy/long position
- SHORT: Sell/short position  
- CLOSE: Close current position
- HOLD: Do nothing
- leverage: Integer between 1 and ${config.max_leverage}
- size_pct: Decimal 0.0 to 1.0 (percentage of balance to use)
- Only valid JSON response accepted
- Consider technical indicators, risk management, and market trends
- Manage risk carefully - preserve capital
- If uncertain, use HOLD

Make your trading decision now:`
  }

  private async callOpenAI(prompt: string): Promise<TradeDecision> {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OpenAI API key not configured')
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.modelId,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 200,
        timeout: 10000
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content?.trim()
    
    return this.parseDecision(content)
  }

  private async callAnthropic(prompt: string): Promise<TradeDecision> {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error('Anthropic API key not configured')
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.modelId,
        max_tokens: 200,
        temperature: 0.1,
        messages: [{ role: 'user', content: prompt }]
      })
    })

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`)
    }

    const data = await response.json()
    const content = data.content[0]?.text?.trim()
    
    return this.parseDecision(content)
  }

  private async callGoogle(prompt: string): Promise<TradeDecision> {
    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) {
      throw new Error('Google API key not configured')
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.modelId}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 200
        }
      })
    })

    if (!response.ok) {
      throw new Error(`Google API error: ${response.status}`)
    }

    const data = await response.json()
    const content = data.candidates[0]?.content?.parts[0]?.text?.trim()
    
    return this.parseDecision(content)
  }

  private async callXAI(prompt: string): Promise<TradeDecision> {
    const apiKey = process.env.XAI_API_KEY
    if (!apiKey) {
      throw new Error('xAI API key not configured')
    }

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.modelId,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 200,
        stream: false
      })
    })

    if (!response.ok) {
      throw new Error(`xAI API error: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content?.trim()
    
    return this.parseDecision(content)
  }

  private async callDeepSeek(prompt: string): Promise<TradeDecision> {
    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) {
      throw new Error('DeepSeek API key not configured')
    }

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.modelId,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 200,
        stream: false
      })
    })

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content?.trim()
    
    return this.parseDecision(content)
  }

  private async callOllama(prompt: string): Promise<TradeDecision> {
    const baseUrl = this.baseUrl || 'http://localhost:11434'
    
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.modelId,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.1
        }
      })
    })

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`)
    }

    const data = await response.json()
    const content = data.response?.trim()
    
    return this.parseDecision(content)
  }

  private async callCustom(prompt: string): Promise<TradeDecision> {
    if (!this.baseUrl) {
      throw new Error('Custom endpoint URL not configured')
    }

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.modelId,
        prompt: prompt,
        temperature: 0.1,
        max_tokens: 200
      })
    })

    if (!response.ok) {
      throw new Error(`Custom API error: ${response.status}`)
    }

    const data = await response.json()
    const content = data.response || data.content || data.text
    
    return this.parseDecision(content)
  }

  private parseDecision(content: string): TradeDecision {
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) || content.match(/(\{[\s\S]*?\})/)
      const jsonStr = jsonMatch ? jsonMatch[1] : content
      
      const parsed = JSON.parse(jsonStr.trim())
      
      return {
        action: parsed.action || 'HOLD',
        leverage: parseInt(parsed.leverage) || 1,
        size_pct: parseFloat(parsed.size_pct) || 0,
        reason: parsed.reason || 'No reason provided'
      }
    } catch (error) {
      console.error('Failed to parse AI response:', content, error)
      return {
        action: 'HOLD',
        leverage: 1,
        size_pct: 0,
        reason: 'Parse error - defaulting to HOLD'
      }
    }
  }

  private generateRandomDecision(config: SimulationConfig): TradeDecision {
    // For MVP demo when no API keys are configured
    const actions = ['LONG', 'SHORT', 'CLOSE', 'HOLD'] as const
    const weights = [0.2, 0.2, 0.1, 0.5] // Favor HOLD for safety
    
    let random = Math.random()
    let actionIndex = 0
    
    for (let i = 0; i < weights.length; i++) {
      random -= weights[i]
      if (random <= 0) {
        actionIndex = i
        break
      }
    }
    
    return {
      action: actions[actionIndex],
      leverage: Math.floor(Math.random() * Math.min(3, config.max_leverage)) + 1,
      size_pct: Math.random() * 0.2 + 0.1, // 10-30% position size
      reason: 'Simulated decision (no API key configured)'
    }
  }
}