---
id: RULE-TRANSLATION-GLOSSARY
status: active
version: 1.0.0
enforcement: probabilistic
cognitive_branch: evidence
---

# RULE: Vietnamese Translation Glossary

> **Standarize technical translations for natural, fluent documentation.**

---

## The Problem

When AI Agents translate English documentation or technical terms, they often use literal translation (e.g., "đổi model" instead of "thay đổi mô hình", or "nộp bài" instead of "commit code"). This leads to awkward phrasing that reduces the professional quality of the project's documentation.

## The Glossary

Always refer to this glossary when composing or translating any Vietnamese text for the project.

| English Term / Concept | Incorrect / Awkward Translation | Correct / Natural Vietnamese Translation |
|:-----------------------|:--------------------------------|:-----------------------------------------|
| defend-in-depth (old)  | *Mispelling*                    | defense-in-depth (Keep original)         |
| change model           | đổi model, model đổi            | thay đổi mô hình, mô hình thay đổi       |
| reasoning / thinking   | suy nghĩ, AI đang suy nghĩ      | lập luận / suy luận (AI đang suy luận)   |
| commit code / pushes   | nộp bài                         | commit code (có thể để ngoặc kép "nộp bài" nếu cần giải nghĩa, nhưng từ chính thức phải dùng commit/push/merge) |
| gates / review process | gate quy trình cho qua          | quy trình kiểm duyệt (gate)              |
| absolute rules         | quy tắc tuyệt đối               | quy tắc bất di bất dịch, quy tắc cốt lõi |
| control                | kiểm soán (Typo)                | kiểm soát                                |
| placeholder            | giữ chỗ                         | placeholder (hoặc nội dung giữ chỗ / rác)|

## Why This Matters

Consistency and linguistic naturalness are essential for professional adoption. Translations should sound like they were written by a native software engineer, not by a basic translation engine. 

## Actionable Guidelines

When writing or modifying Vietnamese `.md` files:
1. Prefer well-established technical English terms over forced Vietnamese translations (e.g., "commit", "push", "gate", "runtime", "hook").
2. Do not personify AI excessively ("suy nghĩ" -> "suy luận").
3. Use culturally and professionally attuned adjectives ("bất di bất dịch" is better than "tuyệt đối" for rules).
4. **Never translate project or product names** (always `defense-in-depth`).
