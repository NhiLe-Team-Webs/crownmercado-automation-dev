# Phase 4: Integration & Delivery (Completed)

## Overview
Công đoạn cuối cùng: Kết nối Landing Page với hạ tầng AWS thông qua API Gateway và tự động hóa quy trình bàn giao tài khoản qua Email (Resend).

## Final Configuration & Technical Details

### 1. API Gateway Integration
- **Invoke URL:** `https://o089jvtm32.execute-api.ap-southeast-2.amazonaws.com/provision`
- **Protocol:** HTTP API (v2)
- **Method:** `POST`
- **Route:** `/provision`
- **Stage:** `$default` (Auto-deploy enabled)
- **Security:** Open for PoC (Public). CORS configured to allow any origin for testing.

### 2. Email Notification System (Resend)
- **Sender:** `Crown Mercado <onboarding@resend.dev>`
- **API Status:** Integrated with Resend SDK v6+.
- **Free Tier Limitation:** Chỉ gửi được tới email đã đăng ký với Resend (vanductan.nlt@gmail.com).
- **Template:** HTML email chứa Link truy cập (`sslip.io`) và thông tin đăng nhập mặc định.

### 3. Workflow Validation (Logic Check)
Khi có một request gửi tới API:
1. **API GW** chuyển tiếp JSON Payload tới **Lambda**.
2. **Lambda** thực hiện:
   - Validate `admin_email`, `subdomain`, `company_name`.
   - Gọi `ecs:RunTask` với các `overrides` để tùy biến container (DB_URL, USER_ID).
   - Polling `ecs:DescribeTasks` mỗi 3 giây (tối đa 10 lần) để lấy `hostPort` thực tế.
   - Lưu trữ Record vào **DynamoDB** (`UserPortRegistry`).
   - Gửi mail qua **Resend**.
3. **Kết quả:** Trả về mã 200 kèm link truy cập cho Frontend hiển thị.

## Implementation Scripts & History

### Email Implementation Code Snippet (Phase 4):
```typescript
await resend.emails.send({
  from: "Crown Mercado <onboarding@resend.dev>",
  to: admin_email,
  subject: `Your ${company_name} instance is ready!`,
  html: `<h1>Hệ thống của bạn đã sẵn sàng!</h1>...`
});
```

### Final Health Check (CLI Verification):
Tui đã kiểm tra và xác nhận:
- [x] API Gateway Endpoint đang hoạt động.
- [x] Lambda đã được upload file ZIP đầy đủ (`node_modules`).
- [x] IAM Role của Lambda có quyền `ecs:RunTask`, `ecs:DescribeTasks`, `dynamodb:PutItem`.

## Key Insights for Training
- **Dynamic Retrieval:** Điểm mấu chốt là Lambda phải "đợi" (polling) để lấy được Port từ AWS, vì lúc vừa RunTask thì Port chưa được gán ngay.
- **SSIP.IO:** Giải pháp cực hay để có Subdomain "miễn phí" mà không cần cấu hình DNS phức tạp.
- **API Gateway Stages:** Việc dùng `$default` giúp đơn giản hóa việc quản lý URL, thay đổi code là API nhận luôn không cần redeploy thủ công.
