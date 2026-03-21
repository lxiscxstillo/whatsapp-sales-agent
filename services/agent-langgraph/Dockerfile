# syntax=docker/dockerfile:1

FROM python:3.11-slim
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code and property inventory (Mock-RAG data)
COPY src ./src
COPY data ./data

EXPOSE 8000

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", \
     "--timeout-keep-alive", "75", "--timeout-graceful-shutdown", "30"]
