# Hướng dẫn đóng góp cho defense-in-depth

Cảm ơn bạn đã quan tâm và muốn đóng góp cho **defense-in-depth** (DiD)!

defense-in-depth là một lớp middleware quản trị mã nguồn mở, giúp kiểm tra và xác thực code cũng như các tài liệu/tạo tác trước khi được ghi vào lịch sử Git thông qua Git hooks và quy trình trí tuệ nhân tạo lũy tiến. Chúng tôi hoan nghênh sự đóng góp từ cả các kỹ sư con người và AI coding agents hoạt động dưới sự giám sát của con người.

> 🌐 **Ngôn ngữ**: **Tiếng Việt** | [English](CONTRIBUTING.md)
> 🤖 **AI Agents**: Nếu bạn là AI agent tự hành, vui lòng tải [AGENTS.md](AGENTS.md) và [.agents/AGENTS.md](.agents/AGENTS.md) trước tiên.

---

## 📋 Mục lục

1. [Thiết lập môi trường phát triển](#-thiết-lập-môi-trường-phát-triển)
2. [Chạy kiểm thử & Ngưỡng bao phủ (Coverage Gate)](#-chạy-kiểm-thử--ngưỡng-bao-phủ-coverage-gate)
3. [Quy chuẩn Commit](#-quy-chuẩn-commit)
4. [Quy chuẩn đặt tên nhánh](#-quy-chuẩn-đặt-tên-nhánh)
5. [Quy trình Pull Request](#-quy-trình-pull-request)
6. [Viết Guard tùy biến](#-viết-guard-tùy-biến)
7. [Chính sách cộng tác AI & HITL](#-chính-sách-cộng-tác-ai--hitl)
8. [Báo cáo lỗ hổng bảo mật](#-báo-cáo-lỗ-hổng-bảo-mật)

---

## 🛠️ Thiết lập môi trường phát triển

### Yêu cầu tiên quyết
- **Node.js**: `>= 18.0.0`
- **pnpm** (khuyến nghị) hoặc **npm**: `>= 9.0.0`
- **Git**: `>= 2.30.0`

### Khởi tạo không gian làm việc

```bash
# 1. Clone kho lưu trữ
git clone https://github.com/tamld/defense-in-depth.git
cd defense-in-depth

# 2. Cài đặt các gói phụ thuộc
pnpm install # hoặc npm install

# 3. Biên dịch mã nguồn TypeScript
npm run build

# 4. Khởi tạo Git hooks của defense-in-depth
npx defense-in-depth init
```

---

## 🧪 Chạy kiểm thử & Ngưỡng bao phủ (Coverage Gate)

Mọi đóng góp đều phải vượt qua toàn bộ bộ kiểm thử và đáp ứng ngưỡng bao phủ nghiêm ngặt trước khi được hợp nhất (merge).

```bash
# Chạy bộ unit & integration tests
npm test

# Chạy kiểm thử ở chế độ theo dõi (watch mode) khi đang lập trình
npm run test:watch

# Kiểm tra ngưỡng bao phủ mã nguồn (Dòng >= 98%, Nhánh >= 91%, Hàm >= 97%)
npm run coverage

# Kiểm tra tĩnh nghiêm ngặt với TypeScript
npm run lint
```

---

## 💬 Quy chuẩn Commit

Chúng tôi bắt buộc sử dụng định dạng [Conventional Commits](https://www.conventionalcommits.org/):

```
<loại>(<phạm vi>): <mô tả ngắn gọn>

[nội dung chi tiết - tùy chọn]

[footer - tùy chọn]
```

### Các loại commit cho phép
- `feat`: Tính năng mới hoặc Guard mới cho người dùng
- `fix`: Sửa lỗi trong runtime hoặc CLI
- `refactor`: Tái cấu trúc mã nguồn không làm thay đổi tính năng hay sửa lỗi
- `test`: Thêm hoặc chuẩn hóa các bài kiểm thử
- `docs`: Chỉ thay đổi tài liệu
- `chore`: Cập nhật cấu hình, kịch bản hoặc công cụ nội bộ

### Ví dụ
- `feat(guards): add AST-based secret scanning guard (#42)`
- `fix(cli/lesson): resolve type narrowing error in record subcommand (#102)`
- `docs(root): add CONTRIBUTING.md for human contributors (#107)`

---

## 🌿 Quy chuẩn đặt tên nhánh

Sử dụng định dạng tiêu chuẩn khi tạo nhánh:

| Tiền tố | Mục đích | Ví dụ |
|:---|:---|:---|
| `feat/<tên-tính-năng>` | Tính năng mới hoặc guard mới | `feat/ticket-identity-guard` |
| `fix/<tên-lỗi>` | Vá lỗi | `fix/cli-enum-cast` |
| `refactor/<mục-tiêu>` | Tái cấu trúc kiến trúc | `refactor/split-lesson-cli` |
| `test/<phạm-vi-test>` | Bổ sung/gia cố test suites | `test/hints-emit-compound` |
| `docs/<chủ-đề>` | Cập nhật tài liệu | `docs/contributing-guide` |

---

## 🔄 Quy trình Pull Request

1. **Tạo nhánh chuyên biệt** từ `main`.
2. **Thực hiện thay đổi** tuân thủ TypeScript strict (tuyệt đối không ép kiểu `as any`).
3. **Kiểm thử cục bộ**:
   ```bash
   npm run build
   npm run lint
   npm test
   npm run coverage
   ```
4. **Đẩy nhánh lên GitHub** và mở Pull Request trỏ vào nhánh `main`.
5. **Danh sách kiểm tra (PR Checklist)**:
   - [ ] Mô tả PR rõ ràng, đính kèm liên kết issue liên quan (`Closes #123`).
   - [ ] Toàn bộ kiểm thử đều pass mà không làm giảm mức độ nghiêm ngặt của assertion.
   - [ ] Không commit các file SSoT bị bảo vệ (được kiểm soát bởi `ssotPollution` guard).
   - [ ] Không chứa các tạo tác rỗng (`TODO`/`TBD`/`PLACEHOLDER`).

---

## 🛡️ Viết Guard tùy biến

Guard là trụ cột mở rộng cốt lõi của defense-in-depth. Mọi guard đều hiện thực interface thuần khiết `Guard`.

- Đọc tài liệu phát triển guard: [Hướng dẫn viết Guard tùy biến](docs/dev-guide/writing-guards.md)
- Đảm bảo guard thuần khiết (pure): không gọi mạng, không thay đổi file hệ thống, kết quả xác định.
- Thiết kế kiểm thử đầy đủ các ca thành công, ca đối chứng tiêu cực, và ca cố ý vượt rào (adversarial bypass).

---

## 🤖 Chính sách cộng tác AI & HITL

defense-in-depth được thiết kế chuyên biệt cho kỷ nguyên phát triển có con người tham gia điều hướng (Human-in-the-Loop - HITL):

- **AI Agents**: Các agent tự hành (Gemini, Claude, Jules) phải tuân thủ nghiêm ngặt các quy định tại [AGENTS.md](AGENTS.md) và [.agents/rules/](.agents/rules/).
- **Quyền hạn của con người**: Không một AI agent nào có quyền tự ý hợp nhất (merge) code. Quyết định của con người là tối cao.

---

## 🔒 Báo cáo lỗ hổng bảo mật

Nếu bạn phát hiện lỗ hổng bảo mật trong defense-in-depth, vui lòng **không mở issue công khai**. Hãy gửi báo cáo bảo mật riêng tư qua GitHub Security Advisories hoặc liên hệ trực tiếp với các maintainers.

---

Cảm ơn sự đóng góp của bạn để giúp quy trình kỹ thuật phần mềm hỗ trợ bởi AI trở nên an toàn và tin cậy hơn!
