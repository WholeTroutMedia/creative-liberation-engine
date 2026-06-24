# Prediction Market Arbitrage — Claude-Powered Trading Bot Strategy

## Source

X thread by @adiix_official (March 27, 2026): Documents the 0x8dxd wallet that turned $313 into $2.38M on Polymarket over 4 months using Claude-powered latency arbitrage.

## TL;DR for Household

This is a real, verified strategy (on-chain data confirms it). A bot exploits the 2–3 second pricing lag between centralized exchanges (Binance/Coinbase) and Polymarket's prediction market contracts. The bot doesn't predict — it reacts to confirmed price moves faster than the market updates.

**However: There are critical legal and practical barriers we need to address first.**

## Legal Status — New York / US Residents

### The Problem

Polymarket's international exchange is technically restricted for US residents. Their ToS explicitly prohibits US persons. However, Polymarket has been re-entering the US market:

- **Polymarket US** (via QCX LLC) is now a CFTC-regulated Designated Contract Market
- Available in beta since late 2025
- Requires: government ID, SSN, proof of residency, live selfie
- Funds through approved futures commission merchants (FCMs), not direct crypto wallets
- Settlement in USDC

### New York Specific

NY has historically been one of the strictest states for crypto/prediction markets. The federal vs. state jurisdiction battle is ongoing as of March 2026:
- CFTC Chairman asserted "exclusive jurisdiction" over prediction markets (Feb 17, 2026)
- Several states (Nevada, Massachusetts, Connecticut) have pushed back
- NY status is in flux — not explicitly blocked like Nevada, but not explicitly cleared either

### Kalshi — The Safer US Alternative

- CFTC-regulated DCM, explicitly legal for US residents
- FDIC-insured accounts up to $250K
- Supports USD funding via ACH, wire, debit
- $6B in 30-day volume (52.6% market share domestically)
- Has crypto price contracts (BTC/ETH short-duration)
- Same latency arbitrage opportunity exists (different execution speed: 78ms vs Polymarket's 45ms)

## The Four Strategies (Ranked by Fit for Us)

### 1. Latency Arbitrage (what 0x8dxd used)
- Win rate: 85–98%
- Monitors Binance/Coinbase WebSocket, trades Polymarket/Kalshi when odds lag
- Requires: fast infrastructure, sub-100ms execution, dedicated RPC nodes
- Risk: edge compression (window dropped from 12s in 2024 to 2.7s in 2026)
- Capital: $500–$1,000 starting, compounds rapidly

### 2. News-Driven Trading (Claude reasoning)
- Win rate: 60–75%
- Claude ingests real-time news, assesses probability impact on open contracts
- Works across ALL market categories (politics, sports, crypto, economics)
- Lower win rate but broader applicability
- This is where our existing Creative Liberation Engine stack adds massive value

### 3. Oracle Arbitrage
- Win rate: 78–85%
- Exploits Chainlink oracle price feed vs Polymarket settlement pricing
- Fewer opportunities but higher certainty
- Requires multi-source data monitoring

### 4. Market Making
- Return: 2–5%/month
- Places both sides of a market, captures bid-ask spread
- Most consistent, hardest to blow up
- Best for larger capital with low risk tolerance

## What We Can Do Right Now

### Phase 1: Infrastructure (Week 1)

1. **Set up Kalshi account** (US-legal, regulated)
   - Fund with $300–$500 initial capital
   - Generate API credentials

2. **Deploy Ollama locally** (already in our Docker stack on NAS)
   - Pull `qwen2.5-coder:32b` for bot code generation
   - Use Claude API for the actual trading logic/reasoning

3. **Prompt Claude to build the bot**
   - Use Claude Code or Claude API
   - Target: Python bot with Binance WebSocket + Kalshi CLOB API
   - Include: paper mode, Kelly sizing, -40% kill switch, Telegram alerts

### Phase 2: Paper Trading (Weeks 2–3)

4. **Run paper mode for minimum 1 week**
   - Target: 200+ completed trades, >70% win rate
   - Monitor: edge calculation, API stability, position sizing
   - If <60% win rate, iterate with Claude on error logs

5. **Configure risk management**
   - Max single position: 8% of portfolio
   - Daily loss limit: -20% with auto-halt
   - Total drawdown kill switch: -40%
   - Telegram notifications on every threshold

### Phase 3: Live Trading (Week 4+)

6. **Go live small** ($1–5 per trade)
   - Compare live vs paper results
   - Only trade markets with >$50K liquidity
   - Scale gradually: double position size every 1–2 weeks on evidence

### Phase 4: Multi-Strategy Expansion

7. **Add news-driven trading** (leverages our full Creative Liberation Engine stack)
   - Connect to real-time news feeds
   - Use Claude reasoning for probability assessment
   - This is our unique edge — most retail bots only do latency arb

## Risk Assessment (Honest)

| Risk | Severity | Mitigation |
|------|----------|------------|
| Edge compression (window shrinking) | HIGH | Treat as time-limited; pivot to news/oracle strategies |
| Legal/regulatory changes | MEDIUM | Use Kalshi (regulated); monitor CFTC/NY state updates |
| Bug in risk management | CRITICAL | Paper trade extensively; hard kill switches |
| Platform rule changes | MEDIUM | Monitor changelogs; diversify across platforms |
| Overleveraging | CRITICAL | Kelly fraction sizing; never >8% single position |
| Infrastructure failure | MEDIUM | Run on NAS with UPS; auto-restart; Telegram alerts |

## What Makes Our Setup Unique

- **Creative Liberation Engine stack**: We already have multi-agent orchestration, which can coordinate data ingestion, analysis, and execution across multiple strategies simultaneously
- **NAS infrastructure**: Always-on compute for 24/7 bot operation
- **Ollama local models**: Free inference for code generation and iteration
- **Claude API access**: Premium reasoning for news-driven strategy
- **Constitutional compliance**: Our agent governance framework ensures risk limits are enforced at the system level, not just the bot level

## Immediate Next Steps

1. Open Kalshi account (household)
2. Verify NY state access status for Kalshi
3. Scaffold Python bot using Claude Code
4. Deploy to NAS Docker container
5. Begin paper trading

## Cross-References

- [antigravity-local-mode.md](./antigravity-local-mode.md) — Local model config for IDE
- [helix-stitch.md](../helix-stitch.md) — Integration patterns
- [ANTIGRAVITY.md](../ANTIGRAVITY.md) — Agent identity protocol
- Source thread: https://x.com/adiix_official/status/2037604599398322682
- Kalshi: https://kalshi.com
- Polymarket US: https://polymarket.com