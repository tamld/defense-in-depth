FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY evaluator.py .

ENV DSPY_PROVIDER=ollama
ENV DSPY_PORT=8080

EXPOSE 8080

CMD ["python", "evaluator.py"]
