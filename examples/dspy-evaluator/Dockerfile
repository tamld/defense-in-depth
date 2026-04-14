FROM python:3.12-slim

# Install curl for HEALTHCHECK
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m appuser

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY evaluator.py .
RUN chown -R appuser:appuser /app

USER appuser

ENV DSPY_PROVIDER=ollama
ENV DSPY_PORT=8080

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${DSPY_PORT}/health || exit 1

CMD ["python", "evaluator.py"]
