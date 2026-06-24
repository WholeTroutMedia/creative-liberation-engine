FROM python:3.12-slim

LABEL maintainer="Creative Liberation Engine — AVERI Collective"
LABEL description="Autonomous Trading Bot — DCA + Grid Strategies via Alpaca API"

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Create log directory
RUN mkdir -p /var/log/trading-bot

# Health check — verifies the process is running
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD pgrep -f "python main.py" || exit 1

# Run as non-root
RUN useradd -m trader
USER trader

CMD ["python", "-u", "main.py"]
