# Phase 3: The Orchestration Engine (Lambda) (Completed)

## Overview
Xây dựng "bộ não" điều khiển bằng AWS Lambda (Node.js/TypeScript). Lambda này chịu trách nhiệm tiếp nhận yêu cầu từ Landing Page, ra lệnh cho ECS bật container mới, tự động lấy Port được gán và lưu thông tin vào DynamoDB.

## Implementation History & Scripts

### 1. Cấu hình ECS Task Definition (Step 3.1)
Đăng ký bản vẽ kỹ thuật (`crownmercado-poc-task`) để định nghĩa cách chạy container Backend.
- **Dynamic Port Mapping:** Cấu hình `hostPort: 0` để AWS tự động chọn một cổng trống trong dải Ephemeral (32768-65535).
- **Lệnh thực thi:**
```bash
aws ecs register-task-definition \
    --family crownmercado-poc-task \
    --network-mode bridge \
    --requires-compatibilities EC2 \
    --container-definitions '[{
        "name": "crownmercado-poc-container",
        "image": "223776318322.dkr.ecr.ap-southeast-2.amazonaws.com/crownmercado-poc:latest",
        "memory": 256,
        "cpu": 256,
        "essential": true,
        "portMappings": [{ "containerPort": 8000, "hostPort": 0, "protocol": "tcp" }]
    }]'
```

### 2. Cấu hình Bảo mật (Step 3.2)
- **IAM Policy:** Tạo chính sách cho Lambda để có quyền điều khiển ECS và DynamoDB.
- **File:** `src/automation/provision-lambda/lambda-iam-policy.json`
- **Security Group Update:** Mở dải port Ephemeral trên EC2 để người dùng có thể truy cập vào container qua port động.
```bash
aws ec2 authorize-security-group-ingress \
    --group-id sg-02cb029d11148518a \
    --protocol tcp --port 32768-65535 --cidr 0.0.0.0/0
```

### 3. Lập trình Logic Lambda (Step 3.3)
Viết code xử lý chính bằng TypeScript sử dụng AWS SDK v3.
- **Vị trí:** `src/automation/provision-lambda/index.ts`
- **Cơ chế chính:**
    1. Nhận `subdomain`, `admin_email`, `company_name`.
    2. Gọi `ecs.runTask()` kèm theo Overrides (`DB_NAME`, `DATABASE_URL`).
    3. **Retry Loop:** Đợi 5-10 giây, sau đó gọi `ecs.describeTasks()` để lấy mã `hostPort` thực tế mà AWS đã gán cho container.
    4. Tạo URL truy cập qua `sslip.io`: `http://[subdomain].[IP_EC2].sslip.io:[PORT]`.
    5. Lưu mapping vào DynamoDB `UserPortRegistry`.

### 4. Khởi tạo dữ liệu hệ thống (Step 3.4)
Tạo record cấu hình ban đầu trong DynamoDB:
```bash
aws dynamodb put-item \
    --table-name UserPortRegistry \
    --item '{"userId": {"S": "SYSTEM_CONFIG"}, "lastAssignedPort": {"N": "7999"}}'
```

## Verification
- **ECS Integration:** Đã test chạy thử task `fc0a51d95fd74957a3d234f4a7deeed5` qua CLI.
- **Port Detection:** Xác nhận hệ thống có thể lấy được port từ `networkBindings`.
- **Code Integrity:** Đã khởi tạo project Node.js và cài đặt các thư viện `@aws-sdk/client-ecs`, `@aws-sdk/client-dynamodb`.

## Key Insights for Training
- **Dynamic Port vs Static Port:** Dùng `hostPort: 0` giúp tránh xung đột port hoàn toàn khi có nhiều user đăng ký cùng lúc.
- **Task Overrides:** Đây là cách duy nhất để truyền thông tin riêng biệt (như tên DB) vào cùng một Image Docker chung cho tất cả khách hàng.
- **DescribeTasks Polling:** Thông tin Port chỉ xuất hiện sau khi Task chuyển sang trạng thái `RUNNING`. Cần có logic đợi (wait/retry) trong Lambda.
