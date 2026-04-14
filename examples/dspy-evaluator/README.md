# DSPy Evaluator — Reference Implementation

> Sample server for Defense-in-Depth's semantic quality evaluation (v0.5).

## Attribution

This evaluator is built on top of [**DSPy**](https://dspy.ai) — a framework for programming (not prompting) language models, developed by [Stanford NLP](https://github.com/stanfordnlp/dspy).

- **Homepage**: [https://dspy.ai](https://dspy.ai)
- **GitHub**: [https://github.com/stanfordnlp/dspy](https://github.com/stanfordnlp/dspy)
- **License**: MIT
- **Citation**: Omar Khattab et al., *"DSPy: Compiling Declarative Language Model Calls into State-of-the-Art Pipelines"*, ICLR 2024.

We thank the DSPy contributors for making this open-source framework available.

## What This Does

When `useDspy: true` is set in `defense.config.yml`, the `hollow-artifact` guard sends artifacts to a DSPy HTTP endpoint for **LLM-as-Judge** evaluation. This directory provides a working reference implementation of that endpoint.

## Quick Start

### Option A: Ollama (Free, Local — Recommended for Dev)

```bash
# 1. Install Ollama (https://ollama.ai)
curl -fsSL https://ollama.ai/install.sh | sh

# 2. Pull a small model
ollama pull llama3.2:3b

# 3. Start the evaluator
cd examples/dspy-evaluator
pip install -r requirements.txt
python evaluator.py
# → Listening on http://localhost:8080
```

### Option B: Google Gemini (Free Tier Available)

```bash
export DSPY_PROVIDER=gemini
export DSPY_API_KEY=your_gemini_api_key
python evaluator.py
```

### Option C: OpenAI (Paid)

```bash
export DSPY_PROVIDER=openai
export DSPY_API_KEY=sk-...
python evaluator.py
```

### Option D: Docker

```bash
docker build -t did-evaluator .
docker run -p 8080:8080 \
  -e DSPY_PROVIDER=gemini \
  -e DSPY_API_KEY=your_key \
  did-evaluator
```

## Configuration

| Environment Variable | Default | Description |
|:---|:---|:---|
| `DSPY_PROVIDER` | `ollama` | Provider: `ollama`, `openai`, `gemini`, `anthropic` |
| `DSPY_MODEL` | *(auto per provider)* | Override model name (e.g., `openai/gpt-4o`) |
| `DSPY_API_KEY` | *(empty)* | API key for cloud providers |
| `DSPY_API_BASE` | `http://localhost:11434` | API base URL (Ollama default) |
| `DSPY_PORT` | `8080` | Server port |

### Default Models Per Provider

| Provider | Default Model | Cost | Best For |
|:---|:---|:---|:---|
| `ollama` | `llama3.2:3b` | Free (local) | Development, testing |
| `openai` | `gpt-4o-mini` | [Pay-per-token](https://openai.com/api/pricing/) | Production (fast) |
| `gemini` | `gemini-2.5-flash` | [Free tier / pay-per-token](https://ai.google.dev/gemini-api/docs/pricing) | Best free cloud option |
| `anthropic` | `claude-haiku-3.5` | [Pay-per-token](https://docs.anthropic.com/en/docs/about-claude/pricing) | Premium quality |

> **Note:** Pricing changes frequently. Always verify current rates on the provider's official pricing page linked above.

## API Contract

### `POST /evaluate`

**Request:**
```json
{
  "artifactPath": "docs/design.md",
  "content": "# Design Document\n\nThis system uses..."
}
```

**Response:**
```json
{
  "score": 0.85,
  "feedback": "Document has clear structure and specific implementation details.",
  "dimensions": null
}
```

- `score`: Float 0.0–1.0 (below 0.5 triggers WARN in DiD)
- `feedback`: Human-readable quality assessment
- `dimensions`: Reserved for future per-dimension scoring

### `GET /health`

Returns server status and configured provider.

## Connecting to Defense-in-Depth

In your project's `defense.config.yml`:

```yaml
guards:
  hollowArtifact:
    enabled: true
    useDspy: true
    dspyEndpoint: "http://localhost:8080/evaluate"
    dspyTimeoutMs: 5000
```

Then run:
```bash
npx defense-in-depth verify   # Uses DSPy during guard pipeline
npx defense-in-depth eval <file>  # Standalone evaluation
```

## Lane Recommendations

| Use Case | Provider | Model | Timeout |
|:---|:---|:---|:---|
| CI/CD hooks (fast) | ollama | llama3.2:1b | 2000ms |
| Interactive CLI | gemini | gemini-2.5-flash | 5000ms |
| PR quality gate | openai | gpt-4o-mini | 8000ms |
| Deep code review | anthropic | claude-sonnet-4.5 | 15000ms |
