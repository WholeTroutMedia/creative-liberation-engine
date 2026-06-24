"""
CLE Trading Bot — Configuration Module
Loads and validates environment configuration for all trading strategies.
"""

import os
from dataclasses import dataclass, field
from typing import List
from dotenv import load_dotenv

load_dotenv()


@dataclass
class AlpacaConfig:
    """Alpaca API connection configuration."""
    api_key: str = ""
    secret_key: str = ""
    base_url: str = "https://paper-api.alpaca.markets"
    trading_mode: str = "paper"  # paper | live

    def __post_init__(self):
        self.api_key = os.getenv("ALPACA_API_KEY", self.api_key)
        self.secret_key = os.getenv("ALPACA_SECRET_KEY", self.secret_key)
        self.base_url = os.getenv("ALPACA_BASE_URL", self.base_url)
        self.trading_mode = os.getenv("TRADING_MODE", self.trading_mode)

    @property
    def is_paper(self) -> bool:
        return self.trading_mode == "paper"

    @property
    def is_live(self) -> bool:
        return self.trading_mode == "live"

    def validate(self) -> bool:
        if not self.api_key or self.api_key == "your_api_key_here":
            raise ValueError("ALPACA_API_KEY not configured")
        if not self.secret_key or self.secret_key == "your_secret_key_here":
            raise ValueError("ALPACA_SECRET_KEY not configured")
        return True


@dataclass
class DCAConfig:
    """Dollar-Cost Averaging strategy configuration."""
    enabled: bool = True
    symbols: List[str] = field(default_factory=lambda: ["SPY", "QQQ", "VOO"])
    amount_per_trade: float = 5.00
    schedule: str = "daily"  # daily | weekly | biweekly

    def __post_init__(self):
        self.enabled = os.getenv("DCA_ENABLED", "true").lower() == "true"
        symbols_str = os.getenv("DCA_SYMBOLS", "SPY,QQQ,VOO")
        self.symbols = [s.strip() for s in symbols_str.split(",")]
        self.amount_per_trade = float(os.getenv("DCA_AMOUNT_PER_TRADE", "5.00"))
        self.schedule = os.getenv("DCA_SCHEDULE", "daily")


@dataclass
class GridConfig:
    """Grid Trading strategy configuration."""
    enabled: bool = True
    symbol: str = "SPY"
    upper_price: float = 0.0  # 0 = auto-detect
    lower_price: float = 0.0  # 0 = auto-detect
    grid_levels: int = 10
    order_size: float = 5.00

    def __post_init__(self):
        self.enabled = os.getenv("GRID_ENABLED", "true").lower() == "true"
        self.symbol = os.getenv("GRID_SYMBOL", "SPY")
        self.upper_price = float(os.getenv("GRID_UPPER_PRICE", "0"))
        self.lower_price = float(os.getenv("GRID_LOWER_PRICE", "0"))
        self.grid_levels = int(os.getenv("GRID_LEVELS", "10"))
        self.order_size = float(os.getenv("GRID_ORDER_SIZE", "5.00"))

    @property
    def auto_detect_range(self) -> bool:
        return self.upper_price == 0 or self.lower_price == 0


@dataclass
class RiskConfig:
    """Risk management configuration."""
    max_daily_loss_percent: float = 5.0
    max_position_percent: float = 25.0
    max_portfolio_value: float = 200.0
    kill_switch: bool = False

    def __post_init__(self):
        self.max_daily_loss_percent = float(os.getenv("MAX_DAILY_LOSS_PERCENT", "5.0"))
        self.max_position_percent = float(os.getenv("MAX_POSITION_PERCENT", "25.0"))
        self.max_portfolio_value = float(os.getenv("MAX_PORTFOLIO_VALUE", "200.0"))
        self.kill_switch = os.getenv("KILL_SWITCH", "false").lower() == "true"


@dataclass
class MonitoringConfig:
    """Heartbeat and alerting configuration."""
    heartbeat_interval: int = 60
    dispatch_url: str = "http://127.0.0.1:5150"
    telnyx_enabled: bool = False
    telnyx_api_key: str = ""
    telnyx_from: str = ""
    telnyx_to: str = ""
    log_level: str = "INFO"
    log_file: str = "/var/log/trading-bot/trades.log"

    def __post_init__(self):
        self.heartbeat_interval = int(os.getenv("HEARTBEAT_INTERVAL_SECONDS", "60"))
        self.dispatch_url = os.getenv("DISPATCH_URL", self.dispatch_url)
        self.telnyx_enabled = os.getenv("TELNYX_ALERT_ENABLED", "false").lower() == "true"
        self.telnyx_api_key = os.getenv("TELNYX_API_KEY", "")
        self.telnyx_from = os.getenv("TELNYX_FROM_NUMBER", "")
        self.telnyx_to = os.getenv("TELNYX_TO_NUMBER", "")
        self.log_level = os.getenv("LOG_LEVEL", "INFO")
        self.log_file = os.getenv("LOG_FILE", self.log_file)


@dataclass
class BotConfig:
    """Master configuration aggregating all sub-configs."""
    alpaca: AlpacaConfig = field(default_factory=AlpacaConfig)
    dca: DCAConfig = field(default_factory=DCAConfig)
    grid: GridConfig = field(default_factory=GridConfig)
    risk: RiskConfig = field(default_factory=RiskConfig)
    monitoring: MonitoringConfig = field(default_factory=MonitoringConfig)

    def validate(self) -> bool:
        self.alpaca.validate()
        if not self.dca.enabled and not self.grid.enabled:
            raise ValueError("At least one strategy (DCA or Grid) must be enabled")
        return True

    def summary(self) -> str:
        mode = "🟢 LIVE" if self.alpaca.is_live else "🟡 PAPER"
        lines = [
            f"═══ CLE Trading Bot ═══",
            f"  Mode: {mode}",
            f"  DCA: {'ON' if self.dca.enabled else 'OFF'} — {', '.join(self.dca.symbols)} @ ${self.dca.amount_per_trade}/trade ({self.dca.schedule})",
            f"  Grid: {'ON' if self.grid.enabled else 'OFF'} — {self.grid.symbol} × {self.grid.grid_levels} levels @ ${self.grid.order_size}/order",
            f"  Risk: max loss {self.risk.max_daily_loss_percent}%/day, max position {self.risk.max_position_percent}%",
            f"  Portfolio cap: ${self.risk.max_portfolio_value}",
            f"  Kill switch: {'🔴 ACTIVE' if self.risk.kill_switch else '⚪ OFF'}",
            f"═════════════════════════════",
        ]
        return "\n".join(lines)
