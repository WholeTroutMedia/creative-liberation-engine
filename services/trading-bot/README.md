# CLE Trading Bot — Autonomous Micro-Trading Service

> **Version:** 1.0.0  
> **Service Type:** NAS-deployed Docker container  
> **Strategy:** Hybrid DCA + Grid Trading  
> **Platform:** Alpaca Markets (commission-free, API-first)

## Overview

Autonomous trading bot that runs 24/7 on the NAS, executing systematic DCA (Dollar-Cost Averaging) and Grid Trading strategies on US equities/ETFs via the Alpaca API.

## Strategies

### DCA (Dollar-Cost Averaging)
- Systematic periodic purchases of index ETFs (SPY, QQQ, VOO)
- Configurable schedule (daily, weekly, bi-weekly)
- Fractional share support for micro-capital deployment

### Grid Trading
- Places buy/sell limit orders at fixed price intervals
- Profits from sideways/ranging market conditions
- Automatically adjusts grid on significant trend changes

## Safety Systems

- **Max daily loss:** Configurable (default: 5% of portfolio)
- **Max position size:** Configurable (default: 25% of portfolio)
- **Kill switch:** Manual override via API/SMS
- **Paper trading mode:** Full simulation with real market data
- **Heartbeat monitoring:** Emits status to CLE Dispatch

## Deployment

```bash
docker compose -f docker-compose.trading.yml up -d
```

## Configuration

All configuration via environment variables — see `.env.example`.
