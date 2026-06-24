FROM python:3.11-slim
WORKDIR /app
COPY . /app
RUN pip install requests sseclient-py
CMD ["python", "-u", "main.py"]
