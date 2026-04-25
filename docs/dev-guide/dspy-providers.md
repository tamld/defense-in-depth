# DSPy Providers for defense-in-depth

> **Context**: The `hollowArtifact` guard supports opt-in semantic evaluation via DSPy
> (`useDspy: true` in `defense.config.yml`). This document explains how to connect a
> DSPy inference backend so the guard can score artifact quality without requiring
> paid infrastructure.

---

## Architecture: DSPy is NOT Mandatory

> **Critical design principle**: DSPy is an **optional intelligence layer**, never the
> primary enforcement mechanism. Governance integrity is guaranteed by deterministic
> code — not by AI inference.

The `hollowArtifact` guard has a **three-layer defense chain**. Each layer is
independently sufficient. DSPy only activates as an additive signal on top:

```
Layer 1 (Always ON) — Deterministic Pattern Matching
  └─ Regex: TODO, TBD, PLACEHOLDER, [Insert Here], <Empty>, FILL IN HERE
  └─ Source: hollow-artifact.ts → DEFAULT_HOLLOW_PATTERNS
  └─ Result on match: BLOCK (hard stop, no DSPy call needed)

Layer 2 (Always ON) — Content Length Heuristic
  └─ Strips frontmatter + headers + blank lines → measures real content
  └─ If stripped.length < minContentLength (default: 50) → WARN
  └─ If stripped.length === 0 → BLOCK (headers-only file)
  └─ Source: hollow-artifact.ts → stripBoilerplate()

Layer 3 (Opt-in) — DSPy Semantic Evaluation
  └─ Only runs when: useDspy=true AND file passed L1+L2 AND file is text type
  └─ Score < 0.5 → WARN (never BLOCK — DSPy has no veto power)
  └─ On failure (timeout/network/non-2xx) → null returned, pipeline continues
  └─ Source: dspy-client.ts → callDspy() with AbortController timeout
```

**What this means in practice:**

- If DSPy is **down** → L1+L2 continue enforcing. Zero regression.
- If DSPy is **misconfigured** → `callDspy()` returns `null`, logs a `WARN`, pipeline continues.
- If DSPy returns a **low score** → raises a `WARN` only. A human still decides.
- DSPy findings are **never** `BLOCK` severity — by architectural contract (`dspy-client.ts` line 4: `WARN-NOT-BLOCK`).

---

> **Open questions being tracked:**
> - [Issue #13](https://github.com/tamld/defense-in-depth/issues/13) — Clarify in README/docs why DSPy is opt-in, not the primary engine
> - [Issue #14](https://github.com/tamld/defense-in-depth/issues/14) — Audit and harden the fallback chain with dedicated tests
> - [Issue #15](https://github.com/tamld/defense-in-depth/issues/15) — Design a `--dry-run-dspy` CLI flag to simulate DSPy failure locally

---

## Philosophy: Zero-Infrastructure First

The `useDspy` feature is **disabled by default**. When disabled, the guard runs
deterministic regex/heuristic checks only — no network, no API key, no cost.

When you enable it, you choose your provider:

| Tier | Provider | Cost | Privacy | Best for |
|:---|:---|:---|:---|:---|
| **Local** | Ollama | Free (hardware) | 100% on-device | Development, privacy-sensitive |
| **Cloud Free** | OpenRouter `:free` | Free (rate-limited) | Cloud | CI, shared teams |
| **Cloud Free** | Groq | Free tier | Cloud | Fast inference, prototyping |
| **Cloud Free** | Google Gemini Flash | Free tier (AI Studio) | Cloud | High quality, Google accounts |
| **Cloud Free** | NVIDIA NIM | Free dev credits | Cloud/Self-hosted | Enterprise models, TensorRT-speed |
| **Cloud Paid** | OpenAI, Anthropic | Paid | Cloud | Production, highest accuracy |

> **Principle**: Start with Ollama locally. Graduate to OpenRouter for CI/CD.
> Only pay when free tier limits become a bottleneck.

---

## How DSPy Connects to Any Provider

DSPy uses [LiteLLM](https://docs.litellm.ai/) as a universal bridge. Once you
configure `dspy.configure(lm=...)`, every DSPy program (including DiD's
`hollowArtifact` evaluator) uses that backend transparently.

The DiD server (`dspyEndpoint`) wraps a DSPy `Predict` call and exposes it over
HTTP. You run this server separately — DiD's guard POSTs to it.

---


## Option 1: Ollama (Local, Fully Free)

**Best for**: Development, no internet, privacy-critical environments.

### Setup

```bash
# 1. Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# 2. Pull a lightweight model (3-7B is enough for artifact scoring)
ollama pull llama3.2          # 3B — fast, good enough
ollama pull phi4-mini         # 3.8B — Microsoft, surprisingly good
ollama pull qwen2.5-coder:7b  # 7B — excellent for code artifacts

# 3. Verify it's running
curl http://localhost:11434/api/tags
```

### DSPy Server

```python
# dspy_server.py
import dspy
from fastapi import FastAPI
from pydantic import BaseModel

lm = dspy.LM(
    model="ollama_chat/llama3.2",
    api_base="http://localhost:11434",
    temperature=0,
)
dspy.configure(lm=lm)

class EvaluateRequest(BaseModel):
    content: str
    filePath: str

class EvaluateResponse(BaseModel):
    score: float
    reason: str

app = FastAPI()
evaluator = dspy.Predict("content, filePath -> score: float, reason: str")

@app.post("/evaluate", response_model=EvaluateResponse)
def evaluate(req: EvaluateRequest):
    result = evaluator(content=req.content, filePath=req.filePath)
    return {"score": float(result.score), "reason": result.reason}
```

```bash
# Run the server
pip install dspy-ai fastapi uvicorn
uvicorn dspy_server:app --port 8080
```

### `defense.config.yml`

```yaml
guards:
  hollowArtifact:
    enabled: true
    useDspy: true
    dspyEndpoint: "http://localhost:8080/evaluate"
    dspyTimeoutMs: 10000   # Ollama can be slow on first call
```

---

## Option 2: OpenRouter (Cloud Free Tier, Recommended for CI)

> **Reference**: [openrouter.ai](https://openrouter.ai) — an aggregator routing to
> 200+ models from Anthropic, Google, Meta, Mistral, and more.
> Models with the `:free` suffix have **zero cost** (rate-limited, community tier).

**Why OpenRouter?**
- Single API key → access to dozens of free models
- No GPU hardware required
- Models rotate/upgrade without changing your config
- OpenAI-compatible API — works directly with DSPy's LiteLLM backend

### Getting a Free API Key

1. Sign up at [openrouter.ai](https://openrouter.ai)
2. Go to **Keys** → **Create Key** → no credit card required for free models
3. Copy your key: `sk-or-v1-...`

### Free Models (as of 2025)

| Model | Context | Quality | Notes |
|:---|:---|:---|:---|
| `meta-llama/llama-3.1-8b-instruct:free` | 131K | ★★★★ | Best free baseline |
| `meta-llama/llama-3.2-3b-instruct:free` | 131K | ★★★ | Fast, smaller |
| `google/gemma-3-12b-it:free` | 131K | ★★★★ | Google, strong reasoning |
| `mistralai/mistral-7b-instruct:free` | 32K | ★★★ | Reliable, widely tested |
| `qwen/qwen3-8b:free` | 40K | ★★★★ | Excellent for code/docs |
| `openrouter/auto` | — | Varies | Auto-selects best free model |

> Check current free models: [openrouter.ai/models?q=free](https://openrouter.ai/models?q=free)

### DSPy Server (OpenRouter)

```python
# dspy_server.py
import os
import dspy
from fastapi import FastAPI
from pydantic import BaseModel

lm = dspy.LM(
    model="openrouter/meta-llama/llama-3.1-8b-instruct:free",
    api_key=os.environ["OPENROUTER_API_KEY"],
    api_base="https://openrouter.ai/api/v1",
    temperature=0,
    # Recommended: attribute requests for OpenRouter analytics
    extra_headers={
        "HTTP-Referer": "https://github.com/tamld/defense-in-depth",
        "X-Title": "defense-in-depth",
    },
)
dspy.configure(lm=lm)

class EvaluateRequest(BaseModel):
    content: str
    filePath: str

class EvaluateResponse(BaseModel):
    score: float
    reason: str

app = FastAPI()
evaluator = dspy.Predict("content, filePath -> score: float, reason: str")

@app.post("/evaluate", response_model=EvaluateResponse)
def evaluate(req: EvaluateRequest):
    result = evaluator(content=req.content, filePath=req.filePath)
    return {"score": float(result.score), "reason": result.reason}
```

```bash
export OPENROUTER_API_KEY="sk-or-v1-YOUR_KEY_HERE"
uvicorn dspy_server:app --port 8080
```

### `defense.config.yml`

```yaml
guards:
  hollowArtifact:
    enabled: true
    useDspy: true
    dspyEndpoint: "http://localhost:8080/evaluate"
    dspyTimeoutMs: 5000
```

---

## Option 3: Groq (Cloud Free Tier, Fastest Inference)

> **Reference**: [console.groq.com](https://console.groq.com) — specializes in
> ultra-low-latency inference via custom LPU hardware. Free tier available.

```python
import os
import dspy

lm = dspy.LM(
    model="groq/llama-3.1-8b-instant",
    api_key=os.environ["GROQ_API_KEY"],
    temperature=0,
)
dspy.configure(lm=lm)
```

**Free tier limits**: ~14,400 requests/day at 30 req/min for Llama 3.1 8B.
Sufficient for most DiD CI pipelines.

Get a free key: [console.groq.com/keys](https://console.groq.com/keys)

---

## Option 4: NVIDIA NIM (Free Developer Credits, Enterprise Quality)

> **Reference**: [build.nvidia.com](https://build.nvidia.com) — NVIDIA Inference
> Microservices. TensorRT-LLM optimized inference. Free developer credits on signup
> (no credit card required, `nvapi-` key).

**Why NVIDIA NIM?**
- TensorRT-LLM optimization: same model runs significantly faster than vanilla HuggingFace
- Access to domain-specific and reasoning-specialized models (Llama Nemotron, etc.)
- Fully OpenAI-compatible — zero DSPy code changes
- **Self-hostable**: download the same NIM Docker container to your own GPU for production

### Getting a Free API Key

1. Sign up at [build.nvidia.com](https://build.nvidia.com) (NVIDIA Developer account, free)
2. Open any model page → click **"Get API Key"**
3. Your key: `nvapi-...` — free tier: ~40 requests/minute

### Recommended Models for Artifact Evaluation

| Model ID | Strength |
|:---|:---|
| `meta/llama-3.1-8b-instruct` | Balanced, fast |
| `meta/llama-3.1-nemotron-70b-instruct` | Best reasoning quality |
| `mistralai/mistral-7b-instruct-v0.3` | Lightweight, low latency |
| `microsoft/phi-3-mini-128k-instruct` | Long-context artifact analysis |

> Browse all models: [build.nvidia.com/explore/reasoning](https://build.nvidia.com/explore/reasoning)

```python
import os
import dspy

lm = dspy.LM(
    model="nvidia_nim/meta/llama-3.1-8b-instruct",
    api_key=os.environ["NVIDIA_API_KEY"],
    api_base="https://integrate.api.nvidia.com/v1",
    temperature=0,
)
dspy.configure(lm=lm)
```

```bash
export NVIDIA_API_KEY="nvapi-YOUR_KEY_HERE"
uvicorn dspy_server:app --port 8080
```

---

## Option 5: Google Gemini Flash (Free via Google AI Studio)

> **Reference**: [aistudio.google.com](https://aistudio.google.com) — Google's
> free developer tier. Gemini 2.5 Flash is the recommended model for cost-quality balance.

```python
import os
import dspy

lm = dspy.LM(
    model="gemini/gemini-2.5-flash",
    api_key=os.environ["GEMINI_API_KEY"],
    temperature=0,
)
dspy.configure(lm=lm)
```

Get a free key: [aistudio.google.com/apikey](https://aistudio.google.com/apikey)

**Free tier limits**: 1,500 req/day, 1M tokens/day (as of 2025).

---

## Running the DSPy Server in CI (GitHub Actions)

> **Tip**: For CI/CD, OpenRouter `:free` or NVIDIA NIM are preferred over Ollama
> because they require no GPU hardware on the runner.

```yaml
# .github/workflows/defense-in-depth.yml (excerpt)
jobs:
  verify:
    runs-on: ubuntu-latest
    env:
      OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Start DSPy server (background)
        run: |
          pip install dspy-ai fastapi uvicorn
          uvicorn dspy_server:app --port 8080 &
          sleep 3  # Wait for server to initialize

      - uses: tamld/defense-in-depth/.github/actions/verify@main
```

> **Important**: The DSPy server process must start *before* the verify action.
> The `sleep 3` is a simple health delay; consider polling `curl -f
> http://localhost:8080/docs` for production robustness.

---

## Choosing the Right Provider

```
Are you running locally (development)?
  └─ Yes → Use Ollama (free, private, no API key)
  └─ No (CI/CD) →
      Do you have an OpenRouter key?
        └─ Yes → Use OpenRouter :free models (best model variety)
        └─ No →
            Need maximum speed?             → Groq (LPU hardware)
            Need enterprise model quality?  → NVIDIA NIM (TensorRT-optimized)
            Have Google account?            → Gemini Flash (highest quality free)
```

---

## Graceful Degradation (Always-On Guarantee)

If the DSPy server is unreachable, DiD's `hollowArtifact` guard **does not crash**.
It logs a `WARN` finding and continues with deterministic checks only:

```
⚠️  WARN  [hollow-artifact] DSPy evaluation skipped: connect ECONNREFUSED 127.0.0.1:8080
           Falling back to deterministic checks. Enable useDspy=false to suppress this warning.
```

This means `useDspy: true` is always safe to commit — the pipeline will never
be blocked by an unavailable AI service.

---

## See Also

- [`docs/dev-guide/writing-guards.md`](writing-guards.md) — Guard authoring guide
- [`docs/dev-guide/fail-fast-policy.md`](fail-fast-policy.md) — Engine behavior contract
- [DSPy official docs](https://dspy.ai) — Full DSPy framework documentation
- [OpenRouter docs](https://openrouter.ai/docs) — API reference and free model list
- [NVIDIA NIM catalog](https://build.nvidia.com/explore/reasoning) — Available NIM models
- [Ollama model library](https://ollama.com/library) — Available local models
- [Groq console](https://console.groq.com) — Free API key for Groq
- [Google AI Studio](https://aistudio.google.com/apikey) — Free Gemini API key
