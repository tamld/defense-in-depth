"""
Defense-in-Depth — Reference DSPy Evaluator Service

Built on DSPy (https://dspy.ai) by Stanford NLP — MIT License.
See: https://github.com/stanfordnlp/dspy

This is a sample FastAPI server that receives artifact content from DiD's
hollow-artifact guard and returns a semantic quality score using DSPy's
LLM-as-Judge pattern.

Usage:
  pip install -r requirements.txt
  python evaluator.py                          # Ollama (free, local)
  DSPY_PROVIDER=openai python evaluator.py     # OpenAI (paid)
  DSPY_PROVIDER=gemini python evaluator.py     # Gemini (free tier available)

The service listens on http://localhost:8080/evaluate by default,
matching defense.config.yml's `dspyEndpoint` default.
"""

import os
import logging
from contextlib import asynccontextmanager

import dspy
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Configuration from environment
# ---------------------------------------------------------------------------

PROVIDER = os.getenv("DSPY_PROVIDER", "ollama")         # ollama | openai | gemini | anthropic
MODEL    = os.getenv("DSPY_MODEL", "")                   # auto-selected per provider if empty
API_KEY  = os.getenv("DSPY_API_KEY", "")
API_BASE = os.getenv("DSPY_API_BASE", "")                # empty uses provider default
PORT     = int(os.getenv("DSPY_PORT", "8080"))

# Provider defaults — sensible model per lane
PROVIDER_DEFAULTS: dict[str, dict[str, str]] = {
    "ollama":    {"model": "ollama_chat/llama3.2:3b",              "api_base": "http://localhost:11434"},
    "openai":    {"model": "openai/gpt-4o-mini",                   "api_base": ""},
    "gemini":    {"model": "gemini/gemini-2.5-flash",              "api_base": ""},
    "anthropic": {"model": "anthropic/claude-haiku-3-5-20241022",  "api_base": ""},
}

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("dspy-evaluator")

# ---------------------------------------------------------------------------
# DSPy Signature — LLM-as-Judge for artifact quality
# ---------------------------------------------------------------------------

class ArtifactQuality(dspy.Signature):
    """Evaluate whether a document artifact has substantive, non-hollow content.
    
    Score from 0.0 (completely hollow/template) to 1.0 (fully substantive).
    Consider: depth of explanation, absence of placeholders, structural completeness,
    and whether the content would be useful to a reader unfamiliar with the project.
    """
    content: str   = dspy.InputField(desc="Full text content of the artifact")
    file_path: str = dspy.InputField(desc="File path for context about the artifact type")
    
    score: float   = dspy.OutputField(desc="Quality score from 0.0 to 1.0")
    feedback: str  = dspy.OutputField(desc="Brief, specific feedback on content quality")


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

class EvalRequest(BaseModel):
    artifactPath: str
    content: str

class EvalResponse(BaseModel):
    score: float
    feedback: str | None = None
    dimensions: dict[str, float] | None = None


def _init_dspy() -> None:
    """Initialize DSPy with the configured provider."""
    defaults = PROVIDER_DEFAULTS.get(PROVIDER, PROVIDER_DEFAULTS["ollama"])
    model = MODEL or defaults["model"]
    api_base = API_BASE or defaults.get("api_base", "")

    kwargs: dict = {"model": model}
    if api_base:
        kwargs["api_base"] = api_base
    if API_KEY:
        kwargs["api_key"] = API_KEY
    elif PROVIDER == "ollama":
        kwargs["api_key"] = ""  # Ollama doesn't require a key

    log.info("Initializing DSPy: provider=%s model=%s", PROVIDER, model)
    lm = dspy.LM(**kwargs)
    dspy.configure(lm=lm)


@asynccontextmanager
async def lifespan(app: FastAPI):
    _init_dspy()
    log.info("DSPy evaluator ready on port %d (provider=%s)", PORT, PROVIDER)
    yield


app = FastAPI(
    title="Defense-in-Depth DSPy Evaluator",
    version="0.5.0",
    lifespan=lifespan,
)

# The judge instance — reused across requests
judge = dspy.ChainOfThought(ArtifactQuality)


@app.post("/evaluate", response_model=EvalResponse)
async def evaluate(req: EvalRequest) -> EvalResponse:
    """Evaluate artifact quality using DSPy LLM-as-Judge."""
    try:
        # Truncate very large files to avoid token limits
        content = req.content[:8000] if len(req.content) > 8000 else req.content

        result = judge(content=content, file_path=req.artifactPath)

        score = float(result.score) if isinstance(result.score, (int, float)) else 0.0
        score = max(0.0, min(1.0, score))  # Clamp to [0, 1]

        return EvalResponse(
            score=score,
            feedback=str(result.feedback) if result.feedback else None,
        )
    except Exception as e:
        log.exception("Evaluation failed for %s", req.artifactPath)
        raise HTTPException(status_code=500, detail=f"Evaluation failed: {str(e)}")


@app.get("/health")
async def health():
    return {"status": "ok", "provider": PROVIDER, "model": MODEL or PROVIDER_DEFAULTS.get(PROVIDER, {}).get("model", "unknown")}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
