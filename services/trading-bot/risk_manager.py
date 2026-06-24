"""
CLE Trading Bot — Risk Management Module
Enforces position limits, daily loss caps, and kill switch functionality.
"""

import logging
from datetime import datetime, date
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger("cle.trading.risk")


@dataclass
class DailyPnL:
    """Tracks profit/loss for the current trading day."""
    date: date = field(default_factory=date.today)
    starting_equity: float = 0.0
    realized_pnl: float = 0.0
    unrealized_pnl: float = 0.0

    @property
    def total_pnl(self) -> float:
        return self.realized_pnl + self.unrealized_pnl

    @property
    def pnl_percent(self) -> float:
        if self.starting_equity == 0:
            return 0.0
        return (self.total_pnl / self.starting_equity) * 100

    def reset_if_new_day(self, current_equity: float):
        today = date.today()
        if today != self.date:
            logger.info(f"New trading day: {today}. Previous day P&L: ${self.total_pnl:.2f} ({self.pnl_percent:.2f}%)")
            self.date = today
            self.starting_equity = current_equity
            self.realized_pnl = 0.0
            self.unrealized_pnl = 0.0


class RiskManager:
    """
    Central risk management system.
    
    Enforces:
    - Maximum daily loss limits
    - Maximum position size limits
    - Portfolio value caps
    - Kill switch override
    """

    def __init__(self, config):
        self.config = config.risk
        self.daily_pnl = DailyPnL()
        self._kill_switch_active = config.risk.kill_switch
        self._halt_reason: Optional[str] = None

    @property
    def is_halted(self) -> bool:
        return self._kill_switch_active or self._halt_reason is not None

    @property
    def halt_reason(self) -> Optional[str]:
        if self._kill_switch_active:
            return "Kill switch activated"
        return self._halt_reason

    def activate_kill_switch(self, reason: str = "Manual activation"):
        """Immediately halt all trading."""
        self._kill_switch_active = True
        self._halt_reason = f"KILL SWITCH: {reason}"
        logger.critical(f"🔴 KILL SWITCH ACTIVATED: {reason}")

    def deactivate_kill_switch(self):
        """Re-enable trading (requires explicit action)."""
        self._kill_switch_active = False
        self._halt_reason = None
        logger.warning("⚪ Kill switch deactivated — trading resumed")

    def check_daily_loss(self, current_equity: float) -> bool:
        """
        Check if daily loss limit has been breached.
        Returns True if trading is allowed, False if halted.
        """
        self.daily_pnl.reset_if_new_day(current_equity)

        if self.daily_pnl.starting_equity == 0:
            self.daily_pnl.starting_equity = current_equity
            return True

        loss_pct = abs(min(0, self.daily_pnl.pnl_percent))
        if loss_pct >= self.config.max_daily_loss_percent:
            self._halt_reason = f"Daily loss limit breached: {loss_pct:.2f}% >= {self.config.max_daily_loss_percent}%"
            logger.warning(f"🛑 {self._halt_reason}")
            return False

        # Warning at 80% of limit
        warning_threshold = self.config.max_daily_loss_percent * 0.8
        if loss_pct >= warning_threshold:
            logger.warning(f"⚠️ Daily loss at {loss_pct:.2f}% — approaching limit of {self.config.max_daily_loss_percent}%")

        return True

    def check_position_size(self, order_value: float, current_equity: float) -> bool:
        """
        Check if a proposed order exceeds position size limits.
        Returns True if the order is allowed.
        """
        if current_equity == 0:
            return False

        position_pct = (order_value / current_equity) * 100
        if position_pct > self.config.max_position_percent:
            logger.warning(
                f"🛑 Order rejected: ${order_value:.2f} = {position_pct:.1f}% of portfolio "
                f"(limit: {self.config.max_position_percent}%)"
            )
            return False
        return True

    def check_portfolio_cap(self, current_equity: float) -> bool:
        """
        Check if portfolio value is approaching the configured cap.
        Returns True if new orders are allowed.
        """
        if current_equity >= self.config.max_portfolio_value:
            logger.info(
                f"📊 Portfolio cap reached: ${current_equity:.2f} >= ${self.config.max_portfolio_value:.2f}. "
                f"No new buys until cap is raised."
            )
            return False
        return True

    def can_trade(self, order_value: float, current_equity: float) -> tuple[bool, str]:
        """
        Master gate: checks all risk conditions.
        Returns (allowed: bool, reason: str).
        """
        if self.is_halted:
            return False, self.halt_reason or "Trading halted"

        if not self.check_daily_loss(current_equity):
            return False, self._halt_reason or "Daily loss limit"

        if not self.check_portfolio_cap(current_equity):
            return False, f"Portfolio cap reached (${self.config.max_portfolio_value})"

        if not self.check_position_size(order_value, current_equity):
            return False, f"Position too large ({order_value / current_equity * 100:.1f}%)"

        return True, "Approved"

    def record_trade(self, pnl: float):
        """Record a completed trade's P&L."""
        self.daily_pnl.realized_pnl += pnl
        logger.info(f"Trade P&L: ${pnl:.2f} | Daily total: ${self.daily_pnl.total_pnl:.2f} ({self.daily_pnl.pnl_percent:.2f}%)")

    def status(self) -> dict:
        """Return current risk status as a dict (for monitoring/heartbeat)."""
        return {
            "halted": self.is_halted,
            "halt_reason": self.halt_reason,
            "daily_pnl": self.daily_pnl.total_pnl,
            "daily_pnl_percent": self.daily_pnl.pnl_percent,
            "kill_switch": self._kill_switch_active,
            "max_daily_loss_pct": self.config.max_daily_loss_percent,
            "max_position_pct": self.config.max_position_percent,
            "portfolio_cap": self.config.max_portfolio_value,
            "timestamp": datetime.utcnow().isoformat(),
        }
