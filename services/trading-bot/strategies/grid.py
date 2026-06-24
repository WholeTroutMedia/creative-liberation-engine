"""
CLE Trading Bot — Grid Trading Strategy
Places buy/sell limit orders at fixed price intervals to profit from ranging markets.
"""

import logging
import math
from datetime import datetime
from typing import Optional

import numpy as np

logger = logging.getLogger("cle.trading.grid")


class GridLevel:
    """Represents a single level in the grid."""

    def __init__(self, price: float, order_size: float):
        self.price = round(price, 2)
        self.order_size = order_size
        self.buy_order_id: Optional[str] = None
        self.sell_order_id: Optional[str] = None
        self.is_filled_buy = False
        self.is_filled_sell = False

    def __repr__(self):
        status = "BOUGHT" if self.is_filled_buy else ("SELLING" if self.sell_order_id else "WAITING")
        return f"Grid(${self.price:.2f}, {status})"


class GridStrategy:
    """
    Grid Trading strategy.
    
    Places buy limit orders below current price and sell limit orders above.
    When a buy fills, it places a sell at the next grid level up.
    When a sell fills, it places a buy at the next grid level down.
    Profits come from the spread between grid levels.
    
    Best in: Sideways/ranging markets.
    Worst in: Strong directional trends (catches falling knives or misses rallies).
    """

    def __init__(self, config, trading_client, risk_manager):
        self.config = config.grid
        self.bot_config = config
        self.client = trading_client
        self.risk = risk_manager
        self.grid_levels: list[GridLevel] = []
        self._initialized = False
        self._total_realized_pnl = 0.0
        self._trade_count = 0

    @property
    def is_enabled(self) -> bool:
        return self.config.enabled

    def initialize_grid(self, current_price: float) -> bool:
        """
        Set up the grid around the current price.
        If upper/lower bounds are 0, auto-detect from recent price action.
        """
        if self.config.auto_detect_range:
            # Auto-detect: ±3% from current price
            spread_pct = 0.03
            upper = current_price * (1 + spread_pct)
            lower = current_price * (1 - spread_pct)
            logger.info(f"Grid: Auto-detected range ${lower:.2f} — ${upper:.2f} (±{spread_pct*100}% from ${current_price:.2f})")
        else:
            upper = self.config.upper_price
            lower = self.config.lower_price

        if upper <= lower:
            logger.error(f"Grid: Invalid range — upper ${upper} must be > lower ${lower}")
            return False

        # Create evenly-spaced grid levels
        prices = np.linspace(lower, upper, self.config.grid_levels)
        self.grid_levels = [GridLevel(price=p, order_size=self.config.order_size) for p in prices]

        self._initialized = True
        logger.info(
            f"Grid: Initialized {len(self.grid_levels)} levels from "
            f"${lower:.2f} to ${upper:.2f} | "
            f"Level spacing: ${(upper - lower) / (self.config.grid_levels - 1):.2f}"
        )
        return True

    def execute(self, current_price: float, current_equity: float) -> list[dict]:
        """
        Main execution loop. Checks grid state and places/adjusts orders.
        Returns list of actions taken.
        """
        if not self.is_enabled:
            return []

        if not self._initialized:
            if not self.initialize_grid(current_price):
                return []

        actions = []

        # Check for levels below current price where we should have buy orders
        for level in self.grid_levels:
            if level.price < current_price and not level.buy_order_id and not level.is_filled_buy:
                # Risk check
                allowed, reason = self.risk.can_trade(level.order_size, current_equity)
                if not allowed:
                    logger.debug(f"Grid: Skipping buy at ${level.price:.2f} — {reason}")
                    continue

                action = self._place_buy(level)
                if action:
                    actions.append(action)

        # Check for filled buys that need corresponding sells
        for i, level in enumerate(self.grid_levels):
            if level.is_filled_buy and not level.sell_order_id:
                # Place sell at next level up
                if i + 1 < len(self.grid_levels):
                    sell_price = self.grid_levels[i + 1].price
                else:
                    # Top of grid — sell at current level + one spacing
                    if len(self.grid_levels) >= 2:
                        spacing = self.grid_levels[-1].price - self.grid_levels[-2].price
                        sell_price = level.price + spacing
                    else:
                        sell_price = level.price * 1.01

                action = self._place_sell(level, sell_price)
                if action:
                    actions.append(action)

        return actions

    def check_fills(self) -> list[dict]:
        """
        Check order statuses and process fills.
        Returns list of fill events.
        """
        fills = []

        for level in self.grid_levels:
            # Check buy orders
            if level.buy_order_id and not level.is_filled_buy:
                try:
                    order = self.client.get_order_by_id(level.buy_order_id)
                    if str(order.status) == "filled":
                        level.is_filled_buy = True
                        fills.append({
                            "event": "BUY_FILLED",
                            "price": level.price,
                            "order_id": level.buy_order_id,
                            "timestamp": datetime.utcnow().isoformat(),
                        })
                        logger.info(f"Grid: BUY FILLED at ${level.price:.2f}")
                except Exception as e:
                    logger.error(f"Grid: Error checking buy order {level.buy_order_id}: {e}")

            # Check sell orders
            if level.sell_order_id and not level.is_filled_sell:
                try:
                    order = self.client.get_order_by_id(level.sell_order_id)
                    if str(order.status) == "filled":
                        level.is_filled_sell = True
                        # Calculate profit (sell price - buy price)
                        pnl = level.order_size * 0.01  # Approximate grid profit
                        self._total_realized_pnl += pnl
                        self._trade_count += 1
                        self.risk.record_trade(pnl)

                        fills.append({
                            "event": "SELL_FILLED",
                            "price": level.price,
                            "order_id": level.sell_order_id,
                            "pnl": pnl,
                            "timestamp": datetime.utcnow().isoformat(),
                        })
                        logger.info(f"Grid: SELL FILLED — P&L: ${pnl:.2f} | Total: ${self._total_realized_pnl:.2f}")

                        # Reset level for next cycle
                        level.buy_order_id = None
                        level.sell_order_id = None
                        level.is_filled_buy = False
                        level.is_filled_sell = False
                except Exception as e:
                    logger.error(f"Grid: Error checking sell order {level.sell_order_id}: {e}")

        return fills

    def _place_buy(self, level: GridLevel) -> Optional[dict]:
        """Place a limit buy order at the grid level."""
        try:
            from alpaca.trading.requests import LimitOrderRequest
            from alpaca.trading.enums import OrderSide, TimeInForce

            # Calculate qty from notional and price
            qty = round(level.order_size / level.price, 4)
            if qty < 0.001:
                logger.debug(f"Grid: Order too small at ${level.price:.2f} (qty={qty})")
                return None

            order_request = LimitOrderRequest(
                symbol=self.config.symbol,
                qty=qty,
                side=OrderSide.BUY,
                time_in_force=TimeInForce.GTC,
                limit_price=level.price,
            )

            order = self.client.submit_order(order_request)
            level.buy_order_id = str(order.id)

            action = {
                "strategy": "GRID",
                "action": "BUY_PLACED",
                "symbol": self.config.symbol,
                "price": level.price,
                "qty": qty,
                "order_id": str(order.id),
                "timestamp": datetime.utcnow().isoformat(),
            }

            logger.info(f"Grid: BUY order placed at ${level.price:.2f} × {qty} shares")
            return action

        except Exception as e:
            logger.error(f"Grid: Failed to place buy at ${level.price:.2f} — {e}")
            return None

    def _place_sell(self, level: GridLevel, sell_price: float) -> Optional[dict]:
        """Place a limit sell order above the buy level."""
        try:
            from alpaca.trading.requests import LimitOrderRequest
            from alpaca.trading.enums import OrderSide, TimeInForce

            qty = round(level.order_size / level.price, 4)

            order_request = LimitOrderRequest(
                symbol=self.config.symbol,
                qty=qty,
                side=OrderSide.SELL,
                time_in_force=TimeInForce.GTC,
                limit_price=round(sell_price, 2),
            )

            order = self.client.submit_order(order_request)
            level.sell_order_id = str(order.id)

            action = {
                "strategy": "GRID",
                "action": "SELL_PLACED",
                "symbol": self.config.symbol,
                "price": sell_price,
                "qty": qty,
                "order_id": str(order.id),
                "timestamp": datetime.utcnow().isoformat(),
            }

            logger.info(f"Grid: SELL order placed at ${sell_price:.2f} × {qty} shares")
            return action

        except Exception as e:
            logger.error(f"Grid: Failed to place sell at ${sell_price:.2f} — {e}")
            return None

    def cancel_all_orders(self):
        """Cancel all active grid orders (for shutdown or grid reset)."""
        for level in self.grid_levels:
            for order_id in [level.buy_order_id, level.sell_order_id]:
                if order_id:
                    try:
                        self.client.cancel_order_by_id(order_id)
                        logger.info(f"Grid: Cancelled order {order_id}")
                    except Exception as e:
                        logger.debug(f"Grid: Could not cancel {order_id}: {e}")

    def status(self) -> dict:
        """Return current grid strategy status."""
        active_buys = sum(1 for l in self.grid_levels if l.buy_order_id and not l.is_filled_buy)
        active_sells = sum(1 for l in self.grid_levels if l.sell_order_id and not l.is_filled_sell)
        filled_buys = sum(1 for l in self.grid_levels if l.is_filled_buy)

        return {
            "enabled": self.is_enabled,
            "initialized": self._initialized,
            "symbol": self.config.symbol,
            "grid_levels": len(self.grid_levels),
            "active_buy_orders": active_buys,
            "active_sell_orders": active_sells,
            "filled_positions": filled_buys,
            "total_realized_pnl": self._total_realized_pnl,
            "total_trades": self._trade_count,
        }
