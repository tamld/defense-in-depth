<div align="center">

<img src="assets/icon.svg" width="120" alt="Defend in Depth Icon" />

# defense-in-depth

**Tầng quản trị trung gian giữa AI Agent và mã nguồn dự án**

*AI lo phần thu thập dữ liệu và thực thi. Con người lo phần nghiệp vụ và quyết định kiến trúc.*
<br/>

[![Status: Active](https://img.shields.io/badge/Status-Active-brightgreen.svg)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform: Cross-Platform](https://img.shields.io/badge/Platform-Win%20%7C%20macOS%20%7C%20Linux-orange.svg)](#)
[![Node: ≥18](https://img.shields.io/badge/Node-%E2%89%A518-green.svg)](#)
[![TypeScript: Strict](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](#)

[English](README.md) · **Tiếng Việt**

---
*AI Agent viết code nhanh gấp 10 lần. Nhưng cũng "ảo" gấp 10 lần.*<br/>
**defense-in-depth chặn lỗi trước khi chúng kịp vào lịch sử Git.**
---

</div>

<div align="center">
  <img src="assets/social-infographic-vi.svg" alt="defense-in-depth: Không cần AI thông minh hơn — Chỉ cần AI làm đúng hơn" width="800" />
</div>

---

## Vấn đề

AI Agent tối ưu cho **sự hợp lý**, không phải **sự đúng đắn**. Không có hàng rào, chúng tạo ra:

| Lỗi hành vi | Hiện tượng | Hậu quả |
|:---|:---|:---|
| 🎭 **File rỗng** | File chỉ toàn nội dung giữ chỗ, template trống | Gate quy trình cho qua nhưng không có nội dung |
| 🦠 **Xâm phạm SSoT** | Sửa file cấu hình/quản trị trong lúc viết tính năng | Hỏng trạng thái, lệch dữ liệu |
| 🤡 **Commit bừa** | Message tùy ý, branch đặt tên ngẫu nhiên | Lịch sử khó đọc, không kiểm định được |
| 📝 **Bỏ qua thiết kế** | Code trước, lập kế hoạch sau | Lệch kiến trúc, lỗi hồi quy |

Đây không phải lỗi ngẫu nhiên. Đây là **lỗi hệ thống** — hệ quả tất yếu khi áp dụng sinh văn bản xác suất vào hệ thống cần tính tất định.

---

## Cách hoạt động

defense-in-depth là **pipeline guard mở rộng** chạy tại Git hooks:

- ✅ **Không cần hạ tầng** — Không server, database, hay dịch vụ cloud
- ✅ **Đa nền tảng** — Windows, macOS, Linux (CI: 3 OS × 4 phiên bản Node)
- ✅ **Không phụ thuộc Agent** — Hoạt động với MỌI AI coding tool
- ✅ **Tối thiểu phụ thuộc** — Chỉ cần `yaml` để đọc cấu hình
- ✅ **Mở rộng được** — Tự viết guard qua interface `Guard` (TypeScript)
- ✅ **CLI-first** — Dùng được với MỌI loại dự án (Node, Python, Rust, Go...)

---

## 🚀 Bắt đầu nhanh

```bash
# 1. Khởi tạo trong dự án của bạn (khuyên dùng)
npx defense-in-depth init

# 2. Kiểm tra cài đặt
npx defense-in-depth doctor

# 3. Quét thủ công (bất kỳ lúc nào)
npx defense-in-depth verify
```

> Theo dõi [Lộ trình phát triển](#lộ-trình-phát-triển). Thả sao repo để nhận thông báo mới.

---

## 📖 Hub Tài Liệu

Tuân theo [Quy tắc Truy xuất Chậm (`RULE-CONTEXT-DISCIPLINE`)](AGENTS.md), tài liệu hệ thống được phân tách nghiêm ngặt để tránh quá tải Context Window.

### 👤 Dành cho người sử dụng (User Guide)
- ⚙️ **[Cấu hình & Các Guard tích hợp](docs/user-guide/configuration.md)** — Cấu trúc file `defense.config.yml`. (Bằng Tiếng Anh)
- ⌨️ **[Dòng lệnh CLI](docs/user-guide/cli-reference.md)** — Các lệnh xác định lỗi và kiểm tra. (Bằng Tiếng Anh)
- 🚀 **[Hướng dẫn nhanh](docs/quickstart.md)** — Khởi động trong 60 giây. (Bằng Tiếng Anh)

### 🛠️ Dành cho nhà phát triển (Dev Guide)
- 🛡️ **[Tạo Guard Khách hàng](docs/dev-guide/writing-guards.md)** — Lập trình Guard cho riêng bạn. (Bằng Tiếng Anh)
- 🏗️ **[Kiến trúc & So sánh](docs/dev-guide/architecture.md)** — Deep dive vào hệ thống Pipeline Hooks, phân tích và so sánh. (Bằng Tiếng Anh)

### ⚙️ Dành cho AI Agents (Machine Gateway)
Nếu bạn là một AI Code Agent truy cập repo này, hãy nạp các cấu trúc tư duy Native sau:
- **[GEMINI.md](GEMINI.md)**
- **[CLAUDE.md](CLAUDE.md)**
- **[.cursorrules](.cursorrules)**

---

## 🗺️ Lộ trình phát triển

| Phiên bản | Trọng tâm | Loại Key | Trạng thái |
|:---|:---|:---|:---:|
| **v0.1** | Guard pipeline + CLI + CI/CD + cấu hình sẵn | `Guard`, `Severity` | ✅ Done |
| **v0.2** | `.agents/` scaffold + 18 rules + 5 skills | `GuardContext` | ✅ Done |
| **v0.3** | TKID (Ticket-aware Guards) | `TicketRef` | 🔄 In Progress |
| **v0.4** | Memory Layer — ghi nhận bài học | `Lesson` | 📋 Lên kế hoạch |
| **v0.5** | DSPy — đánh giá chất lượng ngữ nghĩa | `EvaluationScore` | 📋 Lên kế hoạch |
| **v0.6-v0.8**| Meta Growth + Telemetry Sync | `MetaGrowthSnapshot` | 📋 Đã thiết kế |
| **v1.0** | API ổn định + publish lên npm | Toàn bộ Types | 📋 Lên kế hoạch |

> Chi tiết mục tiêu mở rộng: [`docs/vision/meta-architecture.md`](docs/vision/meta-architecture.md)

---

## 🤝 Đóng góp

Xem [CONTRIBUTING.md](CONTRIBUTING.md) để biết hướng dẫn đầy đủ.

**5 quy tắc tuyệt đối:**
1. TypeScript strict — không dùng `any`
2. Conventional commits — `feat(guards): add new guard`
3. Mỗi guard = một file = một test
4. Không thêm phụ thuộc ngoài (chỉ stdlib + `yaml`)
5. Guard phải là hàm thuần (không có tác dụng phụ)

---

## Giấy phép

[MIT](LICENSE) © 2026 tamld
