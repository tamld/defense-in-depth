<div align="center">

<img src="assets/icon.svg" width="120" alt="Defend in Depth Icon" />

# defense-in-depth

**Tầng quản trị trung gian giữa AI Agent và mã nguồn dự án**

*AI lo phần thu thập tài liệu và thực thi. Con người lo phần nghiệp vụ và quyết định kiến trúc.*
<br/>

[![Status: Active](https://img.shields.io/badge/Status-Active-brightgreen.svg)](https://github.com/tamld/defense-in-depth)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/tamld/defense-in-depth/blob/main/LICENSE)
[![Platform: Cross-Platform](https://img.shields.io/badge/Platform-Win%20%7C%20macOS%20%7C%20Linux-orange.svg)](https://github.com/tamld/defense-in-depth)
[![Node: ≥18](https://img.shields.io/badge/Node-%E2%89%A518-green.svg)](https://github.com/tamld/defense-in-depth)
[![TypeScript: Strict](https://img.shields.io/badge/TypeScript-Strict-007ACC.svg?logo=typescript&logoColor=white)](https://github.com/tamld/defense-in-depth)
[![GitHub Stars](https://img.shields.io/github/stars/tamld/defense-in-depth?style=flat&logo=github&color=yellow)](https://github.com/tamld/defense-in-depth/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/tamld/defense-in-depth?style=flat&logo=github&color=blue)](https://github.com/tamld/defense-in-depth/network/members)
[![GitHub Issues](https://img.shields.io/github/issues/tamld/defense-in-depth?style=flat&logo=github&color=red)](https://github.com/tamld/defense-in-depth/issues)
[![Contributors](https://img.shields.io/github/contributors/tamld/defense-in-depth?style=flat&logo=github&color=brightgreen)](https://github.com/tamld/defense-in-depth/graphs/contributors)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat)](#12-đóng-góp)
[![Framework: AAOS](https://img.shields.io/badge/Framework-AAOS-9333EA.svg?style=flat)](#9-hệ-sinh-thái-agents)
[![Protocol: MCP](https://img.shields.io/badge/Protocol-MCP-2563EB.svg?style=flat)](#)

[English](README.md) · **Tiếng Việt**

---
### defense-in-depth chặn các lỗi đó ngay tại thời điểm commit.
---

</div>

> [!NOTE]
> **defense-in-depth là một bộ scaffold có quan điểm, không phải giải pháp turnkey.**
> Pipeline guard (9 guard tích hợp sẵn + interface `Guard`) là **lõi**.
> Hệ sinh thái `.agents/` (19 rules, COGNITIVE_TREE, skill templates) là **điểm khởi đầu**:
> bạn fork về, xoá thứ không hợp, thay bằng quy ước của đội mình.
> `npx defense-in-depth init` cài hooks; `init --scaffold` cài thêm bộ governance kit tuỳ chọn.

> [!IMPORTANT]
> **Hook phía client có thể bị bypass.** `git commit --no-verify` qua mặt mọi Git hook.
> Để claim HITL/governance có hiệu lực thật, cần ghép local hook với [GitHub Actions server-side](.github/actions/verify/action.yml) (chạy đúng pipeline guard trên PR diff) **và** branch-protection rule trên branch mặc định.
> Hook local là vòng phản hồi nhanh; phía server là vòng cưỡng chế.

> [!NOTE]
> **Trạng thái hiện tại (`v0.7.0-rc.1`, tháng 4 năm 2026)** — release candidate, chưa promote lên `npm latest`.
>
> **Đã ship**: 9 guard tích hợp sẵn (v0.1–v0.6), Memory layer (v0.4), DSPy semantic eval opt-in (v0.5), Federation guards (v0.6), Test/Op hardening (v0.6.2), Path A memory loop MVP + Progressive Discovery hints (v0.7-rc.1), API stabilisation pass (subpath exports, contract tests, typed errors, options-object engine, Guard lifecycle hooks — landing sau rc.1 dưới [umbrella #42](https://github.com/tamld/defense-in-depth/issues/42)).
>
> **Đang triển khai (Track A — Adoption)**: A1 đồng bộ docs ✅ ([#40](https://github.com/tamld/defense-in-depth/issues/40), [#52](https://github.com/tamld/defense-in-depth/pull/52), [#53](https://github.com/tamld/defense-in-depth/issues/53)) · A2 mở rộng độ phủ guard 🔄 ([#41](https://github.com/tamld/defense-in-depth/issues/41)) · A3 đóng băng API cho v1.0 🔄 (P0 done, P1 [#38](https://github.com/tamld/defense-in-depth/issues/38)/[#39](https://github.com/tamld/defense-in-depth/issues/39) còn mở) · A4 push adoption 30 ngày 📋. Tất cả track theo [umbrella issue #42](https://github.com/tamld/defense-in-depth/issues/42).
>
> **Đã thiết kế nhưng còn gating (Track B — Meta Growth, v1.1.x)**: F1 aggregator, Án Lệ injection contract, dedup, forgetting, quality gate. **Hard-gated** sau khi Track A4 đóng (≥10 user ngoài + ≥100 sự kiện thu thập) theo [`docs/vision/meta-growth-roadmap.md`](docs/vision/meta-growth-roadmap.md).
>
> **Đọc tiếp** — Bắt đầu nhanh: [`docs/quickstart.md`](docs/quickstart.md). Hợp đồng ổn định: [`docs/SEMVER.md`](docs/SEMVER.md) · [`docs/migration/v0-to-v1.md`](docs/migration/v0-to-v1.md). Lộ trình & gating: [`docs/vision/meta-growth-roadmap.md`](docs/vision/meta-growth-roadmap.md). Định hướng chiến lược: [`STRATEGY.md`](STRATEGY.md). Tầm nhìn (4 layer + types ledger): [`docs/vision/meta-architecture.md`](docs/vision/meta-architecture.md).

> [!WARNING]
> **🤖 NẾU BẠN LÀ MỘT AI AGENT ĐANG ĐỌC TRANG NÀY:**
> KHÔNG đọc hết file này. Đây là tài liệu cho con người (kiến trúc sư, developer).
> Để tiết kiệm context window, hãy theo bootstrap chain:
> 1. `AGENTS.md` — Project Identity & 3 Đạo luật
> 2. `.agents/AGENTS.md` — Bản đồ hệ sinh thái & flowchart onboarding
> 3. `.agents/rules/rule-consistency.md` — Chuẩn mực coding

---

## Triết lý: Con người luôn là trọng tài (HITL)

*Để xem nền tảng triết lý đầy đủ — ba nhánh nhận thức, các mệnh lệnh DO/DON'T, và growth flywheel — đọc [COGNITIVE_TREE.md](.agents/philosophy/COGNITIVE_TREE.md).*

> *"Tin tưởng nhưng phải kiểm chứng: Tự động hoá đòi hỏi bằng chứng thực nghiệm."*

### Niềm tin cốt lõi

AI Agent (Cursor, Copilot, Claude Code, Windsurf, Codex) là **công cụ mạnh để thu thập tài liệu và thực thi kế hoạch**. Nhưng chúng không thay được phần khó nhất trong công nghệ phần mềm:

| AI Agent giỏi | Con người giỏi |
|:---|:---|
| 📄 Thu thập và tổ chức tài liệu | 🧠 **Quyết định nghiệp vụ** |
| ⚡ Sinh code nhanh | 🎯 **Xác nhận tính đúng đắn (ground truth)** |
| 🔄 Kiểm tra cơ học lặp lại | 🏗️ **Định hướng kiến trúc** |
| 📋 Bám theo kế hoạch có sẵn | 💡 **Chuyên môn lĩnh vực + phán đoán** |
| 🔍 Quét pattern | 🤝 **Giao tiếp với stakeholder** |

**defense-in-depth** là tầng trung gian giúp:
1. **Giảm "ảo giác" của AI** — chặn artifact rỗng và hành vi bypass
2. **Tăng độ chính xác** — bắt buộc gắn bằng chứng cho mọi tuyên bố
3. **Tối ưu tự động hoá** — xử lý phần kiểm tra cơ học để con người tập trung vào phần ngữ nghĩa
4. **Bảo toàn quyền quyết định của con người** — HITL là quy tắc tối thượng

### Quy tắc tối thượng

> **Con người-trong-vòng-lặp (HITL) là không thể thương lượng.**
> 
> defense-in-depth tự động hoá phần *cơ học* của code review (format, cấu trúc, vệ sinh).
> Nó giải phóng con người để tập trung vào phần *ngữ nghĩa* (giải pháp này có đúng không? có phục vụ nghiệp vụ không?).
> 
> Hệ thống **không bao giờ** thay thế phán đoán của con người. Nó giảm noise để phán đoán của con người sắc bén hơn.

### Vì sao ở tầng Git? (Quản trị tất định vs. Guardrail động)

Hệ sinh thái AI safety có nhiều guardrail runtime mạnh — **Guardrails AI**, **NeMo Guardrails**, **LlamaFirewall**, **Microsoft Agent Governance Toolkit** — can thiệp vào hành vi Agent *ngay khi mô hình đang suy luận*. Chúng rất mạnh, nhưng là **điều chỉnh động**: mỗi lần nhà cung cấp cập nhật model hoặc nền tảng đổi version, guardrail phải chạy theo để thích ứng.
 
defense-in-depth chọn hướng tiếp cận khác:

> **Tôn trọng toàn bộ sức mạnh AI Agent.** Cho phép chúng tự do suy nghĩ, vận hành, sáng tạo — mỗi nền tảng theo cách riêng. Không can thiệp vào quá trình đó.
>
> **Chỉ kiểm tra kết quả đầu ra.** Khi code được commit — "bài thi được nộp" — nó phải đạt chuẩn.

Đây là **quản trị tất định**: dù dùng GitHub, GitLab, Bitbucket hay bất kỳ hệ thống Git nào, defense-in-depth luôn đứng vững như một lớp *trước khi* output Agent chạm tới tầng dữ liệu.

| Cách tiếp cận | Thời điểm | Phụ thuộc | Cần cập nhật khi mô hình thay đổi? |
|:---|:---|:---|:---:|
| Guardrail runtime | Trong lúc suy luận | Theo nhà cung cấp | Phải cập nhật |
| **defense-in-depth** | Tại thời điểm commit | **Mọi hệ thống Git** | **Không cần** |

*Guardrail runtime bảo vệ khi AI suy nghĩ. defense-in-depth bảo vệ khi AI nộp bài. Hai tầng khác nhau, bổ sung cho nhau.*

---

## 🏗️ Kiến trúc

```mermaid
flowchart TD
    classDef agent fill:#e0e7ff,stroke:#6366f1,stroke-width:2px,color:#312e81,font-weight:bold;
    classDef guard fill:#fee2e2,stroke:#ef4444,stroke-width:2px,color:#991b1b,font-weight:bold;
    classDef human fill:#dcfce7,stroke:#16a34a,stroke-width:2px,color:#14532d,font-weight:bold;

    A["🤖 AI Agent<br/>viết code"]:::agent --> B["📦 git commit"]
    B --> C{"🛡️ defense-in-depth<br/>pre-commit hook"}:::guard
    C -->|"❌ CHẶN"| D["Agent tự sửa<br/>trước khi commit"]:::agent
    C -->|"⚠️ CẢNH BÁO"| E["Đánh dấu cho<br/>người duyệt"]
    C -->|"✅ ĐẠT"| F["Commit sạch"]
    E --> G["👨‍💼 Con người duyệt<br/>logic nghiệp vụ"]:::human
    F --> G
    G -->|"Chấp thuận"| H["✅ Merge vào main"]:::human
```

<div align="center">
  <img src="assets/social-infographic-vi.svg" alt="defense-in-depth: Không cần AI thông minh hơn — Chỉ cần AI làm đúng hơn" width="800" />
</div>

---

## 📑 Mục lục

1. [Vấn đề](#1-vấn-đề)
2. [Cách hoạt động](#2-cách-hoạt-động)
3. [Bắt đầu nhanh](#3-bắt-đầu-nhanh)
4. [Guard tích hợp sẵn](#4-guard-tích-hợp-sẵn)
5. [Cấu hình](#5-cấu-hình)
6. [Viết Guard tuỳ chỉnh](#6-viết-guard-tuỳ-chỉnh)
7. [Lệnh CLI](#7-lệnh-cli)
8. [Cấu trúc dự án](#8-cấu-trúc-dự-án)
9. [Hệ sinh thái .agents/](#9-hệ-sinh-thái-agents)
10. [So với các giải pháp khác](#10-so-với-các-giải-pháp-khác)
11. [Lộ trình](#11-lộ-trình)
12. [Đóng góp](#12-đóng-góp)
13. [Dành cho AI Agent: Machine Gateway](#13-dành-cho-ai-agent-machine-gateway)

---

## 1. Vấn đề

AI Agent tối ưu cho **sự hợp lý**, không phải **sự đúng đắn**. Không có hàng rào, chúng tạo ra:

| Lỗi hành vi | Hiện tượng | Hậu quả |
|:---|:---|:---|
| 🎭 **Artifact rỗng** | File chỉ chứa các marker chưa hoàn thiện, template trống | Lọt qua gate nhưng không có nội dung thực |
| 🦠 **Xâm phạm SSoT** | Sửa file cấu hình/quản trị trong lúc viết tính năng | Hỏng trạng thái, lệch dữ liệu |
| 🤡 **Commit bừa** | Commit message tự do, branch đặt tên ngẫu nhiên | Lịch sử khó đọc, không kiểm soát được |
| 📝 **Bỏ qua thiết kế** | Code trước, lập kế hoạch sau | Lệch kiến trúc, gây regression |

Đây không phải lỗi ngẫu nhiên. Đây là **lỗi hệ thống** — hệ quả tất yếu khi áp dụng sinh văn bản xác suất vào kỹ thuật cần tính tất định.

---

## 2. Cách hoạt động

defense-in-depth là một **pipeline guard mở rộng** chạy ở Git hooks:

```text
┌──────────────────────────────────────────────────┐
│                 Git Pipeline                       │
│                                                    │
│  Agent Code → [pre-commit] ──→ [pre-push]          │
│                   │                │                │
│              defense-in-depth  defense-in-depth       │
│                   │                │                │
│              ┌────┴────┐     ┌────┴────┐           │
│              │ Guards: │     │ Guards: │           │
│              │ • hollow│     │ • branch│           │
│              │ • ssot  │     │ • commit│           │
│              │ • phase │     └─────────┘           │
│              └─────────┘                           │
└──────────────────────────────────────────────────┘
```

**Đặc điểm:**
- ✅ **Không cần hạ tầng** — Không server, không database, không cloud
- ✅ **Đa nền tảng** — Windows, macOS, Linux (CI: 3 OS × 4 phiên bản Node)
- ✅ **Không phụ thuộc Agent** — Hoạt động với MỌI AI coding tool
- ✅ **Phụ thuộc tối thiểu** — Chỉ `yaml` để parse cấu hình
- ✅ **Mở rộng được** — Tự viết guard qua interface `Guard` (TypeScript)
- ✅ **CLI-first** — Cắm vào MỌI loại dự án (Node, Python, Rust, Go...)

---

## 3. Bắt đầu nhanh

```bash
# 1. Khởi tạo trong dự án của bạn (khuyên dùng)
npx defense-in-depth init

# Lệnh trên sẽ:
# ✅ Tạo file defense.config.yml ở thư mục gốc
# ✅ Cài Git hooks (pre-commit và pre-push)
# ✅ Bật guard hollow-artifact và ssot-pollution

# 2. Kiểm tra cài đặt
npx defense-in-depth doctor

# 3. Quét thủ công (bất kỳ lúc nào)
npx defense-in-depth verify
```

> Theo dõi tiến độ release tại [Lộ trình](#11-lộ-trình). Bấm star để nhận thông báo.

### Tuỳ chọn: Scaffold bộ governance cho Agent

```bash
# Tạo thêm hệ sinh thái .agents/ (cho dự án có AI Agent đóng góp)
defense-in-depth init --scaffold

# Lệnh trên tạo:
# .agents/AGENTS.md        — Bootstrap protocol cho AI Agent
# .agents/rules/           — Quy tắc bất di bất dịch của dự án
# .agents/workflows/       — Quy trình thao tác
# .agents/skills/          — Bộ kỹ năng (skill template)
# .agents/config/          — Cấu hình đọc-được-bằng-máy
# .agents/contracts/       — Hợp đồng interface
```

### Cưỡng chế phía server (khuyến nghị nếu muốn HITL có hiệu lực thật)

Hook local có thể bị bypass bằng `git commit --no-verify`. Để pipeline guard chạy trên mọi PR — vượt khỏi tầm với của Agent — dùng Composite Action chính thức:

```yaml
# .github/workflows/defense-in-depth.yml
name: defense-in-depth

on:
  pull_request:
    branches: [main]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: tamld/defense-in-depth/.github/actions/verify@v0.7.0-rc.1
        # Tuỳ chọn:
        # with:
        #   defense-version: '0.7.0-rc.1'
        #   node-version: '22'
        #   base-ref: 'origin/main'
```

Ghép thêm branch-protection rule trên `main` yêu cầu check `verify` phải pass. Đó là lúc HITL thực sự có răng.

---

## 4. Guard tích hợp sẵn

| Guard | Mặc định | Mức độ | Hook | Bắt được gì |
|:---|:---:|:---:|:---:|:---|
| **Hollow Artifact** | ✅ Bật | BLOCK | pre-commit | File chỉ chứa các marker chưa hoàn thiện hoặc template rỗng |
| **SSoT Pollution** | ✅ Bật | BLOCK | pre-commit | File quản trị / state (`.agents/**`, `flow_state.yml`, `backlog.yml`) bị sửa trong feature branch |
| **Root Pollution** | ✅ Bật | BLOCK | pre-commit | File hoặc thư mục lạ tạo ngay ở thư mục gốc |
| **Commit Format** | ✅ Bật | WARN | commit-msg | Commit message không tuân theo Conventional Commits |
| **Ticket Identity** | ❌ Tắt | WARN | pre-commit | Commit tham chiếu ticket xung đột (TKID Lite, v0.3) |
| **Branch Naming** | ❌ Tắt | WARN | pre-push | Tên branch không khớp `feat\|fix\|chore\|docs/*` |
| **Phase Gate** | ❌ Tắt | BLOCK | pre-commit | Code commit trước khi có file `implementation_plan.md` |
| **HITL Review** | ❌ Tắt | BLOCK | pre-commit | Bắt buộc marker review của con người trên đường dẫn được bảo vệ (v0.6) |
| **Federation** | ❌ Tắt | BLOCK | pre-commit | Validate trạng thái ticket parent ↔ child giữa các repo federate (v0.6, có thể chỉnh `block`/`warn`) |

> **Về DSPy:** Guard `hollow-artifact` có thể dùng DSPy như tầng ngữ nghĩa tuỳ chọn (opt-in qua `guards.hollowArtifact.useDspy: true`). Khi bật, DSPy chỉ là tín hiệu bổ sung (WARN-only) và degrade an toàn — Tier 0 deterministic vẫn luôn giữ.

### Mức độ Severity

| Mức | Emoji | Hiệu lực |
|:---|:---:|:---|
| **PASS** | 🟢 | Không có vấn đề |
| **WARN** | ⚠️ | Có vấn đề nhưng vẫn cho commit |
| **BLOCK** | 🔴 | Commit bị từ chối, phải sửa trước |

---

## 5. Cấu hình

Sau `defense-in-depth init`, sửa file `defense.config.yml`:

```yaml
version: "1.0"

guards:
  hollowArtifact:
    enabled: true
    extensions: [".md", ".json", ".yml", ".yaml"]
    minContentLength: 50

  ssotPollution:
    enabled: true
    protectedPaths:
      - ".agents/"
      - "records/"

  commitFormat:
    enabled: true
    pattern: "^(feat|fix|chore|docs|refactor|test|style|perf|ci)(\\(.+\\))?:\\s.+"

  branchNaming:
    enabled: false
    pattern: "^(feat|fix|chore|docs)/[a-z0-9-]+$"

  phaseGate:
    enabled: false
    planFiles: ["implementation_plan.md", "design_spec.md"]
```

Tham khảo đầy đủ tại [`docs/user-guide/configuration.md`](docs/user-guide/configuration.md).

---

## 6. Viết Guard tuỳ chỉnh

Cài đặt interface `Guard`:

```typescript
import type { Guard, GuardContext, GuardResult } from "defense-in-depth";
import { Severity } from "defense-in-depth";

export const fileSizeGuard: Guard = {
  id: "file-size",
  name: "File Size Guard",
  description: "Chặn file dài hơn 500 dòng",

  async check(ctx: GuardContext): Promise<GuardResult> {
    const findings = [];
    for (const file of ctx.stagedFiles) {
      // ... kiểm tra size file
    }
    return { guardId: "file-size", passed: findings.length === 0, findings, durationMs: 0 };
  },
};
```

> Xem [`docs/agents/guard-interface.md`](docs/agents/guard-interface.md) cho hợp đồng đầy đủ và [`docs/dev-guide/architecture.md`](docs/dev-guide/architecture.md) cho engine bên trong.

### Ticket Federation Provider

Để tích hợp ngữ cảnh sạch từ các hệ thống ngoài (Jira, Linear, hoặc `TICKET.md` nội bộ), `defense-in-depth` dùng **TicketStateProvider**. Provider chèn metadata bất đồng bộ *trước khi* các guard chạy.

```typescript
export interface TicketStateProvider {
  name: string;
  resolve(ticketId: string): Promise<TicketRef | undefined>;
}
```

> Provider có sẵn: [`FileTicketProvider`](src/federation/file-provider.ts), [`HttpTicketProvider`](src/federation/http-provider.ts). Xem [`docs/dev-guide/writing-providers.md`](docs/dev-guide/writing-providers.md) và [`docs/agents/provider-interface.md`](docs/agents/provider-interface.md) cho hợp đồng đầy đủ.

---

## 7. Lệnh CLI

| Lệnh | Mô tả |
|:---|:---|
| `defense-in-depth init` | Cài hooks + tạo file cấu hình |
| `defense-in-depth init --scaffold` | Tạo thêm hệ sinh thái `.agents/` |
| `defense-in-depth verify` | Chạy toàn bộ guard thủ công trên file đang stage |
| `defense-in-depth verify --files a.md b.ts` | Kiểm tra các file chỉ định |
| `defense-in-depth verify --dry-run-dspy` | Force-disable DSPy cho lần chạy này (kiểm tra regression) |
| `defense-in-depth doctor` | Health check (config, hooks, guards, hint state) |
| `defense-in-depth doctor --hints` | Hiển thị mọi hint Progressive Discovery đủ điều kiện |
| `defense-in-depth doctor --hints dismiss <id>` / `--hints reset` | Tắt vĩnh viễn / xoá state hint |
| `defense-in-depth lesson record` / `search` / `outcome` / `scan-outcomes` | Quản lý Án Lệ (v0.4) + recall outcomes (v0.7) trong `lessons.jsonl` và `.agents/records/lesson-*.jsonl` |
| `defense-in-depth growth record` | Ghi growth metric vào `growth_metrics.jsonl` |
| `defense-in-depth feedback <tp\|fp\|fn\|tn>` / `list` / `f1` / `scan-history` | Gắn nhãn TP/FP/FN/TN cho finding + tính F1 cho từng guard (v0.7) |
| `defense-in-depth eval <path>` | Đánh giá ngữ nghĩa artifact bằng DSPy (v0.5, opt-in) |

> Mã thoát (ổn định, là một phần của public surface theo [`docs/SEMVER.md`](docs/SEMVER.md)): `0` = pass, `1` = BLOCK, `2` = config error. WARN **không** đổi mã thoát. Lỗi DSPy / provider degrade về WARN, không bao giờ crash.

---

## 8. Cấu trúc dự án

```text
defense-in-depth/
├── src/
│   ├── core/                  # 🔒 Trụ cột bắt buộc
│   │   ├── types.ts           # Interface Guard + meta-layer (4 tầng)
│   │   ├── engine.ts          # Pipeline runner (API options-object)
│   │   ├── config-loader.ts   # YAML config + deep merge defaults
│   │   ├── errors.ts          # Phân cấp DiDError có kiểu (đóng băng API v1.0)
│   │   ├── jsonl-store.ts     # Bộ ghi JSONL append-only dùng chung + runtime validation
│   │   ├── memory.ts          # Đọc/ghi lessons.jsonl + recall events
│   │   ├── lesson-outcome.ts  # Capture & scanner LessonOutcome (v0.7)
│   │   ├── feedback.ts        # Bộ ghi FeedbackEvent (v0.7)
│   │   ├── f1.ts              # Tính F1 cho từng guard (v0.7)
│   │   ├── hint-engine.ts     # Engine đánh giá hint Progressive Discovery (v0.7)
│   │   ├── hint-state.ts      # JSON state nguyên tử cho hints-shown
│   │   └── dspy-client.ts     # HTTP client DSPy tuỳ chọn (v0.5)
│   ├── guards/                # 🛡️ 9 guard tích hợp sẵn
│   │   ├── hollow-artifact.ts
│   │   ├── ssot-pollution.ts
│   │   ├── root-pollution.ts
│   │   ├── commit-format.ts
│   │   ├── branch-naming.ts
│   │   ├── phase-gate.ts
│   │   ├── ticket-identity.ts # v0.3 — TKID Lite
│   │   ├── hitl-review.ts     # v0.6 — Bắt buộc marker HITL
│   │   ├── federation.ts      # v0.6 — Validate parent ↔ child ticket
│   │   └── index.ts           # Barrel export + allBuiltinGuards
│   ├── federation/            # 🌐 Provider ticket cross-project (v0.6)
│   │   ├── file-provider.ts
│   │   ├── http-provider.ts
│   │   ├── types.ts
│   │   └── index.ts
│   ├── hooks/                 # 🪝 Sinh Git hook
│   │   ├── pre-commit.ts
│   │   └── pre-push.ts
│   ├── cli/                   # ⌨️ Các lệnh CLI
│   │   ├── index.ts           # Entry + router
│   │   ├── init.ts            # Cài hooks + scaffold config
│   │   ├── verify.ts          # Chạy guard thủ công
│   │   ├── doctor.ts          # Health check + hint surface
│   │   ├── lesson.ts          # Memory layer (record / search / outcome)
│   │   ├── growth.ts          # Growth metrics
│   │   ├── feedback.ts        # F1 input pipeline (v0.7)
│   │   ├── eval.ts            # DSPy semantic eval (v0.5, opt-in)
│   │   └── hints-emit.ts      # Helper phát hint nội bộ
│   └── index.ts               # Barrel API public (xem docs/SEMVER.md)
├── tests/
│   ├── contract/              # Contract tests Public API + CLI exit-code (#35)
│   │   ├── public-api-contract.test.js
│   │   ├── cli-exit-codes.test.js
│   │   └── no-execsync-regression.test.js
│   └── …                      # Suite per-guard / per-CLI (366+ test xanh)
├── .agents/                   # 🧠 Hệ sinh thái governance
│   ├── AGENTS.md              # Bootstrap + bản đồ hệ sinh thái
│   ├── rules/                 # Quy tắc bất di bất dịch
│   ├── workflows/             # Quy trình thao tác
│   ├── skills/                # Skill template cho Agent
│   ├── contracts/             # Hợp đồng interface (Guard, Provider, Jules…)
│   ├── config/                # Cấu hình đọc-được-bằng-máy
│   ├── philosophy/            # Gốc tư duy (COGNITIVE_TREE)
│   └── records/               # Telemetry append-only (.jsonl)
├── docs/                      # 📖 Tài liệu đầy đủ
│   ├── quickstart.md          # Onboarding 60 giây
│   ├── SEMVER.md              # Hợp đồng ổn định (v1.0 lane)
│   ├── migration/v0-to-v1.md  # Hướng dẫn upgrade cho user `npm latest = 0.1.0`
│   ├── user-guide/            # Cấu hình, CLI, hints
│   ├── dev-guide/             # Architecture, viết guard/provider
│   ├── agents/                # Spec interface đọc-được-bằng-máy
│   ├── federation.md          # Giao thức AAOS ↔ defense-in-depth
│   └── vision/                # meta-architecture, meta-growth-roadmap
├── .github/                   # 🔄 CI/CD + template
│   ├── workflows/             # ci.yml, release.yml, git-shield.yml
│   ├── actions/verify/        # Composite Action server-side
│   ├── ISSUE_TEMPLATE/
│   └── PULL_REQUEST_TEMPLATE.md
├── templates/                 # 📄 Template scaffold ship sẵn
├── AGENTS.md                  # 🤖 Gốc: project identity + đạo luật
├── GEMINI.md / CLAUDE.md / .cursorrules # 🧠 Config Agent dựng sẵn
├── STRATEGY.md                # 🗺️ Định hướng chiến lược + roadmap
├── CONTRIBUTING.md            # 👥 Hướng dẫn đóng góp
├── CODE_OF_CONDUCT.md         # 🤝 Chuẩn mực cộng đồng
├── SECURITY.md                # 🔒 Threat model + báo cáo lỗ hổng
├── CHANGELOG.md               # 📝 Lịch sử phiên bản
└── LICENSE                    # ⚖️ MIT
```

---

## 9. Hệ sinh thái .agents/

Với các **dự án agentic** (dự án có AI Agent đóng góp code), defense-in-depth cung cấp một bộ scaffold governance tuỳ chọn:

<div align="center">
  <img src="assets/agents-ecosystem.svg" alt=".agents/ Ecosystem Infographic" width="800" />
</div>

| Thành phần | Bắt buộc? | Mục đích |
|:---|:---:|:---|
| **Rules** | ✅ Lõi | Chuẩn dự án không thể thương lượng |
| **Contracts/Templates** | ✅ Lõi | Spec interface Guard (cho cả người và máy) |
| **Config** | ✅ Lõi | Registry guard đọc-được-bằng-máy |
| **Workflows** | Tuỳ chọn | Quy trình từng bước cho task |
| **Skills** | Tuỳ chọn | Năng lực Agent tuỳ chỉnh |

Mọi file đều theo `YAML frontmatter + Markdown body` để mọi Agent đều đọc được.

---

## 10. So với các giải pháp khác

### So với Guardrail AI runtime

Hệ sinh thái AI safety có nhiều công cụ mạnh hoạt động ở **tầng runtime/API**:

| Công cụ | Trọng tâm | Tầng |
|:---|:---|:---|
| Guardrails AI / NeMo Guardrails | Lọc input/output LLM | Runtime API |
| Microsoft Agent Governance Toolkit | Policy engine cấp enterprise | Runtime actions |
| LlamaFirewall (Meta) | Chống prompt injection, code injection | Runtime security |
| LLM Guard (Protect AI) | Lọc input/output | Runtime API |

Các công cụ trên quản trị AI **trong lúc suy luận**. defense-in-depth quản trị AI **tại thời điểm commit code**. Hai tầng bổ sung — không cạnh tranh.

### So với Git hooks truyền thống

| Tính năng | husky + lint-staged | commitlint | 🛡️ **defense-in-depth** |
|:---|:---:|:---:|:---:|
| Git hooks | ✅ | — | ✅ |
| Format commit | — | ✅ | ✅ Tích hợp sẵn |
| **Kiểm tra nội dung ngữ nghĩa** | ❌ | ❌ | ✅ |
| **Bảo vệ SSoT** | ❌ | ❌ | ✅ |
| **Phase gates** (plan trước, code sau) | ❌ | ❌ | ✅ |
| **Hệ thống guard mở rộng** | ❌ | ❌ | ✅ |
| **Hệ sinh thái governance Agent** | ❌ | ❌ | ✅ |
| **Evidence tagging** | ❌ | ❌ | ✅ |
| Đối tượng phục vụ | Developer | Developer | **AI Agent + Developer** |

> *Guardrail runtime bảo vệ khi AI suy nghĩ. defense-in-depth bảo vệ khi AI nộp bài. Hai tầng khác nhau, bổ sung cho nhau.*

---

## 11. Lộ trình

| Phiên bản | Trọng tâm | Type chính | Trạng thái |
|:---|:---|:---|:---:|
| **v0.1** | Guard lõi + CLI + OSS + CI/CD + config Agent dựng sẵn | `Guard`, `Severity`, `Finding` | ✅ Xong |
| **v0.2** | Scaffold `.agents/` + 19 rule + 5 skill + lazy loading | `GuardContext`, schema config | ✅ Xong |
| **v0.3** | TKID Lite (ticket file-based) + trust-but-verify | `TicketRef` | ✅ Xong |
| **v0.4** | Memory Layer (`lessons.jsonl`) + growth metrics | `Lesson`, `GrowthMetric` | ✅ Xong |
| **v0.5** | Tầng DSPy semantic tuỳ chọn (opt-in, degrade an toàn) + đánh giá chất lượng ngữ nghĩa | `EvaluationScore` | ✅ Xong |
| **v0.6** | Federation: guard parent ↔ child + `HitlReview` | `FederationGuardConfig`, `HttpTicketProvider`, `HitlReviewConfig` | ✅ Xong |
| **v0.6.2** | Test & Operational Hardening (coverage gate, E2E test, server-side composite Action) | — | ✅ Xong |
| **v0.7-rc.1** | Path A memory loop MVP + Progressive Discovery hints | `Hint`, `HintState`, `LessonOutcome`, `RecallMetric`, `RecallEvent`, `FeedbackEvent`, `GuardF1Metric` | ✅ Tag 2026-04-27 (PR [#27](https://github.com/tamld/defense-in-depth/pull/27), [#28](https://github.com/tamld/defense-in-depth/pull/28), [#31](https://github.com/tamld/defense-in-depth/pull/31)) |
| **Track A1** — đồng bộ docs (trạng thái v0.7 trên README + STRATEGY + meta-architecture + bản đồ hệ sinh thái) | Phát hành kỹ thuật | — | ✅ Xong ([#40](https://github.com/tamld/defense-in-depth/issues/40), [#52](https://github.com/tamld/defense-in-depth/pull/52), [#53](https://github.com/tamld/defense-in-depth/issues/53)) |
| **Track A2** — mở rộng độ phủ guard (`secret-detection`, `dependency-audit`, `file-size-limit`) | Guard mới | Config guard mới | ✅ Xong ([#41](https://github.com/tamld/defense-in-depth/issues/41), `git-shield.yml` CI fail-safe đã land tại [#46](https://github.com/tamld/defense-in-depth/pull/46)) |
| **Track A3** — đóng băng API cho v1.0 (subpath exports, contract tests, typed errors, options-object engine, Guard lifecycle hooks, JSON Schema config, custom-guard guide) | API surface | `EngineRunOptions`, phân cấp `DiDError` | ✅ Xong ([#33](https://github.com/tamld/defense-in-depth/issues/33), [#34](https://github.com/tamld/defense-in-depth/issues/34), [#35](https://github.com/tamld/defense-in-depth/issues/35), [#36](https://github.com/tamld/defense-in-depth/issues/36), [#37](https://github.com/tamld/defense-in-depth/issues/37), [#43](https://github.com/tamld/defense-in-depth/issues/43), [#44](https://github.com/tamld/defense-in-depth/issues/44), [#49](https://github.com/tamld/defense-in-depth/issues/49), [#50](https://github.com/tamld/defense-in-depth/issues/50), [#59](https://github.com/tamld/defense-in-depth/issues/59)) |
| **Track A4** — bake 30 ngày trên `next` → promo `npm latest` + push adoption | Chu kỳ phát hành | — | 📋 Chờ Track A3 đóng (umbrella [#42](https://github.com/tamld/defense-in-depth/issues/42)) |
| **v1.0** | API ổn định + GA `npm latest` | Mọi type được đóng băng theo [`docs/SEMVER.md`](docs/SEMVER.md) | 📋 Lên kế hoạch (sau khi Track A4 đóng) |
| **v1.1.x — Track B (Meta Growth)** | F1 aggregator + Án Lệ injection + dedup + forgetting + quality gate. **Hard-gated** sau khi Track A4 đóng (≥10 user ngoài + ≥100 sự kiện). | `MetaGrowthSnapshot` | 📋 Đã thiết kế |
| **v1.2+ — Telemetry Sync** *(trước đây từng đánh số "v0.9"; renumber sau v1.0 theo [`docs/vision/meta-growth-roadmap.md`](docs/vision/meta-growth-roadmap.md))* | Luồng dữ liệu hai chiều Internal ↔ OSS | `FederationPayload` | 📋 Đã thiết kế |

> Toàn bộ type trên lộ trình (Layer 0–3 + Federation + Telemetry Sync) đã được publish trong [`src/core/types.ts`](src/core/types.ts) — đã compile, có docs, import được. Triển khai theo từng đợt theo gating contract trong [`docs/vision/meta-growth-roadmap.md`](docs/vision/meta-growth-roadmap.md). Xem [`docs/vision/meta-architecture.md`](docs/vision/meta-architecture.md) cho tầm nhìn đầy đủ và types ledger.

### Hợp đồng ổn định — lane v1.0

- [`docs/SEMVER.md`](docs/SEMVER.md) — định nghĩa Major / Minor / Patch trên bốn public surface (library entry point, hợp đồng Guard/Provider, `defense.config.yml`, CLI), kèm timeline deprecation.
- [`docs/migration/v0-to-v1.md`](docs/migration/v0-to-v1.md) — hướng dẫn upgrade cho ai đang chạy `npm install defense-in-depth` không pin version (hiện `latest = v0.1.0`). Bao quát mọi tính năng từ v0.2 → v0.7-rc.1 và các bước upgrade khuyến nghị.

---

## 12. Đóng góp

Xem [CONTRIBUTING.md](CONTRIBUTING.md) cho hướng dẫn đầy đủ.

**5 quy tắc bất di bất dịch:**
1. TypeScript strict — không dùng `any`
2. Conventional commits — `feat(guards): add new guard`
3. Mỗi guard = một file = một test
4. Không thêm phụ thuộc ngoài (chỉ stdlib + `yaml`)
5. Guard phải là hàm thuần (không có side effect)

---

## 13. Dành cho AI Agent: Machine Gateway

Bạn đang bước vào một **codebase được quản trị** với các framework nhận thức dựng sẵn.

### 🧠 Config Agent dựng sẵn (Meta Prompting hiện thực hoá)

| Nền tảng | File config | Cung cấp gì |
|:---|:---|:---|
| **Gemini CLI** | [`GEMINI.md`](GEMINI.md) | Bootstrap chain, framework nhận thức, mẹo theo platform |
| **Claude Code / Antigravity** | [`CLAUDE.md`](CLAUDE.md) | Bootstrap chain, memory priming, ngữ cảnh AAOS lineage |
| **Cursor** | [`.cursorrules`](.cursorrules) | Quy tắc dạng comment theo convention của Cursor |

> Các file trên **dùng ngay được**. Drop vào dự án và Agent có ngữ cảnh governance ngay lập tức. Không cần đi tìm.

> [!CAUTION]
> **3 ĐẠO LUẬT TUYỆT ĐỐI**
> 1. **Zero-Theater:** KHÔNG tạo doc rỗng. Marker chưa hoàn thiện, template trống = BLOCK ngay.
> 2. **Bằng chứng vượt trên hợp lý:** Gắn nhãn các tuyên bố chưa kiểm chứng là `[HYPO]`. Chỉ bằng chứng `[CODE]` và `[RUNTIME]` mới qua được peer review.
> 3. **Bootstrap trước:** Theo chain — `AGENTS.md` → `.agents/AGENTS.md` → `.agents/rules/rule-consistency.md` → rồi mới code.

**Lazy-Load Matrix:**

| Nhiệm vụ | Đọc file này |
|:---|:---|
| Hiểu dự án | `AGENTS.md` (gốc) |
| Onboarding Agent | `.agents/AGENTS.md` (flowchart bootstrap) |
| Thêm guard | `.agents/contracts/guard-interface.md` |
| Chuẩn coding | `.agents/rules/rule-consistency.md` |
| Workflow task | `.agents/workflows/procedure-task-execution.md` |
| Tầm nhìn & roadmap | `docs/vision/meta-architecture.md` |
| Giao thức Federation | `docs/federation.md` |

---

## Giấy phép

[MIT](LICENSE) © 2026 tamld
