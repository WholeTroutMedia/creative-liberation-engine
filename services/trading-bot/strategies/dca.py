"""
CLE Trading Bot — DCA Strategy
Dollar-Cost Averaging: systematic periodic purchases of index ETFs.
"""

import logging
from datetime import datetime, timedelta
from typing import Optional

logger = logging.getLogger("cle.trading.dca")


class DCAStrategy:
    """
    Dollar-Cost Averaging strategy.
    
    Buys a fixed dollar amount of specified symbols on a regular schedule.
    Supports fractional shares for micro-capital deployment.
    """

    def __init__(self, config, trading_client, risk_manager):
        self.config = config.dca
        self.client = trading_client
        self.risk = risk_manager
        self._last_execution: Optional[datetime] = None
        self._trade_count = 0

    @property
    def is_enabled(self) -> bool:
        return self.config.enabled

    def _should_execute(self) -> bool:
        """Check if it's time to execute the DCA schedule."""
        now = datetime.utcnow()

        if self._last_execution is None:
            return True

        if self.config.schedule == "daily":
            return (now - self._last_execution) >= timedelta(hours=23)
        elif self.config.schedule == "weekly":
            return (now - self._last_execution) >= timedelta(days=6, hours=23)
        elif self.config.schedule == "biweekly":
            return (now - self._last_execution) >= timedelta(days=13, hours=23)

        return False

    def execute(self, current_equity: float) -> list[dict]:
        """
        Execute DCA purchases if schedule permits.
        Returns list of executed trades.
        """
        if not self.is_enabled:
            return []

        if not self._should_execute():
            logger.debug("DCA: Not time to execute yet")
            return []

        trades = []
        amount_per_symbol = self.config.amount_per_trade

        for symbol in self.config.symbols:
            # Risk check for each order
            allowed, reason = self.risk.can_trade(amount_per_symbol, current_equity)
            if not allowed:
                logger.warning(f"DCA: Skipping {symbol} — {reason}")
                continue

            trade = self._place_market_order(symbol, amount_per_symbol)
            if trade:
                trades.append(trade)

        if trades:
            self._last_execution = datetime.utcnow()
            self._trade_count += len(trades)

        return trades

    def _place_market_order(self, symbol: str, notional: float) -> Optional[dict]:
        """
        Place a fractional market buy order.
        Uses 'notional' (dollar amount) instead of 'qty' for fractional support.
        """
        try:
            from alpaca.trading.requests import MarketOrderRequest
            from alpaca.trading.enums import OrderSide, TimeInForce

            order_request = MarketOrderRequest(
                symbol=symbol,
                notional=round(notional, 2),
                side=OrderSide.BUY,
                time_in_force=TimeInForce.DAY,
            )

            order = self.client.submit_order(order_request)

            trade_record = {
                "strategy": "DCA",
                "symbol": symbol,
                "side": "BUY",
                "notional": notional,
                "order_id": str(order.id),
                "status": str(order.status),
                "timestamp": datetime.utcnow().isoformat(),
            }

            logger.info(f"DCA: BUY ${notional:.2f} of {symbol} — Order {order.id} ({order.status})")
            return trade_record

        except Exception as e:
            logger.error(f"DCA: Failed to buy {symbol} — {e}")
            return None

    def status(self) -> dict:
        """Return current DCA strategy status."""
        return {
            "enabled": self.is_enabled,
            "symbols": self.config.symbols,
            "amount_per_trade": self.config.amount_per_trade,
            "schedule": self.config.schedule,
            "last_execution": self._last_execution.isoformat() if self._last_execution else None,
            "total_trades": self._trade_count,
        }
