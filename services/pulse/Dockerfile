FROM python:3.12-slim

# Install system dependencies required for OpenCV, MediaPipe, and rtmidi
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libasound2-dev \
    libjack-jackd2-dev \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements first for Docker layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the service
COPY . .

# Expose ports:
# 9000/udp: OSC
# 8765: WebSocket
# 8766: SSE & Dashboard
EXPOSE 9000/udp
EXPOSE 8765
EXPOSE 8766

# Define environment variables
ENV PYTHONPATH=/app

# Start the service
CMD ["python", "-m", "pulse.main"]
