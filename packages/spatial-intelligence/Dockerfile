FROM nvidia/cuda:12.1.1-devel-ubuntu22.04
ENV DEBIAN_FRONTEND=noninteractive PYTHONUNBUFFERED=1
RUN apt-get update && apt-get install -y python3.11 python3.11-dev python3-pip git wget libgl1-mesa-glx libglib2.0-0 && rm -rf /var/lib/apt/lists/*
RUN update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1
RUN python3 -m pip install --upgrade pip setuptools wheel
WORKDIR /app
RUN pip3 install torch==2.3.0 torchvision --index-url https://download.pytorch.org/whl/cu121
RUN pip3 install grpcio>=1.60 grpcio-tools>=1.60 protobuf>=4.25 transformers>=4.40 timm safetensors huggingface-hub numpy scipy open3d
RUN pip3 install flash-attn --no-build-isolation || true
RUN pip3 install spconv-cu121 || true
RUN pip3 install pointcept || true
COPY . /app/spatial-intelligence
WORKDIR /app/spatial-intelligence
RUN chmod +x scripts/download_models.sh && ./scripts/download_models.sh
RUN python3 -m grpc_tools.protoc -I proto --python_out=src --grpc_python_out=src proto/spatial.proto
EXPOSE 50051
CMD ["python3", "src/server.py", "--port", "50051"]