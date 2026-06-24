FROM python:3.11-slim
WORKDIR /app
COPY . /app
RUN pip install requests sseclient-py playwright
RUN playwright install --with-deps chromium
CMD ["python", "-u", "main.py"]
