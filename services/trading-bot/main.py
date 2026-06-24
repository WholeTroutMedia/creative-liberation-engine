"""
CLE Trading Bot — Main Orchestrator
Runs the trading loop, coordinates strategies, and emits heartbeats.
"""

import json
import logging
import signal
import sys
import time
import threading
from datetime import datetime
from typing import Optional

import requests

from config import BotConfig
from risk_manager import RiskManager
from strategies.dca import DCAStrategy
from strategies.grid import GridStrategy

# ──────────────────────────────────────────────
# Logging Setup
# ──────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger("cle.trading.main")


class CLETradingBot:
    """
    Main trading bot orchestrator.
    
    Coordinates DCA and Grid strategies, manages risk,
    and emits heartbeats to the CLE Dispatch server.
    """

    def __init__(self):
        self.config = BotConfig()
        self.running = False
        self.client = None
        self.risk_manager = None
        self.dca_strategy = None
        self.grid_strategy = None
        self._heartbeat_thread: Optional[threading.Thread] = None
        self._trade_log: list[dict] = []

    def initialize(self):
        """Initialize the bot: validate config, connect to Alpaca, set up strategies."""
        logger.info("═══ CLE TRADING BOT — INITIALIZING ═══")

        # Validate configuration
        try:
            self.config.validate()
        except ValueError as e:
            logger.critical(f"Configuration error: {e}")
            sys.exit(1)

        logger.info(self.config.summary())

        # Connect to Alpaca
        self._connect_alpaca()

        # Initialize risk manager
        self.risk_manager = RiskManager(self.config)

        # Initialize strategies
        if self.config.dca.enabled:
            self.dca_strategy = DCAStrategy(self.config, self.client, self.risk_manager)
            logger.info("DCA strategy: LOADED")

        if self.config.grid.enabled:
            self.grid_strategy = GridStrategy(self.config, self.client, self.risk_manager)
            logger.info("Grid strategy: LOADED")

        # Register signal handlers for graceful shutdown
        signal.signal(signal.SIGINT, self._handle_shutdown)
        signal.signal(signal.SIGTERM, self._handle_shutdown)

        logger.info("═══ INITIALIZATION COMPLETE ═══")

    def _connect_alpaca(self):
        """Establish connection to Alpaca API."""
        try:
            from alpaca.trading.client import TradingClient

            self.client = TradingClient(
                api_key=self.config.alpaca.api_key,
                secret_key=self.config.alpaca.secret_key,
                paper=self.config.alpaca.is_paper,
            )

            # Verify connection by fetching account
            account = self.client.get_account()
            logger.info(
                f"Connected to Alpaca ({'PAPER' if self.config.alpaca.is_paper else 'LIVE'})"
                f" | Account: {account.account_number}"
                f" | Equity: ${float(account.equity):.2f}"
                f" | Buying Power: ${float(account.buying_power):.2f}"
            )

        except Exception as e:
            logger.critical(f"Failed to connect to Alpaca: {e}")
            sys.exit(1)

    def _get_account_equity(self) -> float:
        """Fetch current account equity."""
        try:
            account = self.client.get_account()
            return float(account.equity)
        except Exception as e:
            logger.error(f"Failed to fetch account equity: {e}")
            return 0.0

    def _get_current_price(self, symbol: str) -> float:
        """Fetch the current market price for a symbol."""
        try:
            from alpaca.data.historical import StockHistoricalDataClient
            from alpaca.data.requests import StockLatestQuoteRequest

            data_client = StockHistoricalDataClient(
                api_key=self.config.alpaca.api_key,
                secret_key=self.config.alpaca.secret_key,
            )

            request = StockLatestQuoteRequest(symbol_or_symbols=symbol)
            quotes = data_client.get_stock_latest_quote(request)

            if symbol in quotes:
                # Use midpoint of bid/ask
                bid = float(quotes[symbol].bid_price)
                ask = float(quotes[symbol].ask_price)
                return (bid + ask) / 2

        except Exception as e:
            logger.error(f"Failed to fetch price for {symbol}: {e}")

        return 0.0

    def _is_market_open(self) -> bool:
        """Check if the US stock market is currently open."""
        try:
            clock = self.client.get_clock()
            return clock.is_open
        except Exception as e:
            logger.error(f"Failed to check market clock: {e}")
            return False

    def run(self):
        """Main trading loop."""
        self.initialize()
        self.running = True

        # Start heartbeat thread
        self._start_heartbeat()

        logger.info("═══ TRADING LOOP STARTED ═══")
        loop_interval = 60  # seconds between strategy checks

        while self.running:
            try:
                # Check if market is open (stocks only trade during market hours)
                if not self._is_market_open():
                    logger.debug("Market closed — sleeping")
                    time.sleep(300)  # Check every 5 min when closed
                    continue

                # Check kill switch
                if self.risk_manager.is_halted:
                    logger.warning(f"Trading halted: {self.risk_manager.halt_reason}")
                    time.sleep(loop_interval)
                    continue

                current_equity = self._get_account_equity()
                if current_equity == 0:
                    logger.warning("Could not fetch equity — skipping cycle")
                    time.sleep(loop_interval)
                    continue

                # Execute DCA strategy
                if self.dca_strategy:
                    dca_trades = self.dca_strategy.execute(current_equity)
                    self._trade_log.extend(dca_trades)

                # Execute Grid strategy
                if self.grid_strategy:
                    current_price = self._get_current_price(self.config.grid.symbol)
                    if current_price > 0:
                        grid_actions = self.grid_strategy.execute(current_price, current_equity)
                        self._trade_log.extend(grid_actions)

                        # Check for filled grid orders
                        fills = self.grid_strategy.check_fills()
                        self._trade_log.extend(fills)

                time.sleep(loop_interval)

            except KeyboardInterrupt:
                self._handle_shutdown(None, None)
            except Exception as e:
                logger.error(f"Error in trading loop: {e}", exc_info=True)
                time.sleep(loop_interval)

    def _start_heartbeat(self):
        """Start background heartbeat thread."""
        def heartbeat_loop():
            while self.running:
                self._emit_heartbeat()
                time.sleep(self.config.monitoring.heartbeat_interval)

        self._heartbeat_thread = threading.Thread(target=heartbeat_loop, daemon=True)
        self._heartbeat_thread.start()
        logger.info(f"Heartbeat: every {self.config.monitoring.heartbeat_interval}s → {self.config.monitoring.dispatch_url}")

    def _emit_heartbeat(self):
        """Send heartbeat status to the CLE Dispatch server."""
        status = {
            "service": "trading-bot",
            "timestamp": datetime.utcnow().isoformat(),
            "trading_mode": self.config.alpaca.trading_mode,
            "risk": self.risk_manager.status(),
            "strategies": {},
        }

        if self.dca_strategy:
            status["strategies"]["dca"] = self.dca_strategy.status()
        if self.grid_strategy:
            status["strategies"]["grid"] = self.grid_strategy.status()

        try:
            response = requests.post(
                f"{self.config.monitoring.dispatch_url}/api/heartbeat",
                json=status,
                timeout=5,
            )
            if response.status_code != 200:
                logger.debug(f"Heartbeat: non-200 response ({response.status_code})")
        except requests.exceptions.ConnectionError:
            logger.debug("Heartbeat: dispatch server unreachable")
        except Exception as e:
            logger.debug(f"Heartbeat: {e}")

    def _send_alert(self, message: str):
        """Send SMS alert via Telnyx."""
        if not self.config.monitoring.telnyx_enabled:
            return

        try:
            import telnyx
            telnyx.api_key = self.config.monitoring.telnyx_api_key
            telnyx.Message.create(
                from_=self.config.monitoring.telnyx_from,
                to=self.config.monitoring.telnyx_to,
                text=f"🤖 CLE TRADING BOT: {message}",
            )
            logger.info(f"Alert sent: {message}")
        except Exception as e:
            logger.error(f"Failed to send alert: {e}")

    def _handle_shutdown(self, signum, frame):
        """Graceful shutdown handler."""
        logger.info("═══ SHUTDOWN SIGNAL RECEIVED ═══")
        self.running = False

        # Cancel all active grid orders
        if self.grid_strategy:
            logger.info("Cancelling active grid orders...")
            self.grid_strategy.cancel_all_orders()

        # Save trade log
        if self._trade_log:
            log_path = self.config.monitoring.log_file
            try:
                with open(log_path, "w") as f:
                    json.dump(self._trade_log, f, indent=2)
                logger.info(f"Trade log saved: {log_path} ({len(self._trade_log)} entries)")
            except Exception as e:
                logger.error(f"Failed to save trade log: {e}")

        # Final status
        equity = self._get_account_equity()
        logger.info(f"Final equity: ${equity:.2f}")
        logger.info(f"Risk status: {json.dumps(self.risk_manager.status(), indent=2)}")
        logger.info("═══ SHUTDOWN COMPLETE ═══")

        sys.exit(0)


if __name__ == "__main__":
    bot = CLETradingBot()
    bot.run()
