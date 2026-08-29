# FAQ & Troubleshooting

> **Frequently asked questions, common error codes, and troubleshooting solutions.**

---

## ❓ Frequently Asked Questions

### Q1: Can I bypass the pre-commit hook in an emergency?
**Yes.** Use `git commit --no-verify` (or `-n`).  
*Note*: If your repository has configured the GitHub Action in CI, the pull request check will still execute the guard pipeline on the diff before merging to protected branches.

### Q2: Does `defense-in-depth` send any code to external servers?
**No.** The deterministic Tier 0 core is 100% local, runs purely via Node.js, and makes zero network requests. If you explicitly enable Tier 1 DSPy evaluation, it connects only to your configured local LLM (e.g. Ollama) or your specified API endpoint.

### Q3: How do I resolve a `Root Pollution Guard` block?
Move scratch scripts or data files into a subfolder or ignored scratch directory:
```bash
git reset HEAD "unauthorized_script.js"
mv "unauthorized_script.js" scratch/unauthorized_script.js
git add scratch/unauthorized_script.js
git commit -m "chore: organize scratch file"
```

### Q4: How do I resolve an `SSoT Pollution Guard` block?
Files under `.agents/` and core state stores cannot be committed alongside feature code in the same branch. Revert the changes to governance files on your feature branch or create a dedicated governance PR.

---

## 🩺 Diagnostic Checklist

If you encounter issues:
1. Run `npx defense-in-depth doctor` to inspect hook installation status.
2. Ensure Node.js version is ≥ 18.0.0 (`node -v`).
3. Re-install hooks if corrupted: `npx defense-in-depth init --force`.
