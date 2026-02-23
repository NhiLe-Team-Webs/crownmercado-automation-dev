# Phase 1: Foundation & AWS Infrastructure (Completed)

## Overview
Xây dựng hạ tầng cốt lõi trên AWS để hỗ trợ việc điều phối (orchestration) và lưu trữ các container của người dùng.

## Final Resources Created
- **ECR Repository:** `crownmercado-poc` (Region: `ap-southeast-2`)
- **DynamoDB Table:** `UserPortRegistry` (Partition Key: `userId`)
- **ECS Cluster:** `my-poc-cluster`
- **Security Group:** `ecs-poc-sg` (ID: `sg-02cb029d11148518a`)
  - Inbound: Port 22 (SSH), Port 8000-8100 (App Instances)
- **IAM Role:** `ecsInstanceRolePoC` (Policy: `AmazonEC2ContainerServiceforEC2Role`)

## Implementation History & Scripts

### 1. Initial Resource Provisioning (CLI)
Các lệnh đã dùng để khởi tạo kho chứa, bảng dữ liệu và cụm điều khiển:
```bash
# Tạo ECR
aws ecr create-repository --repository-name crownmercado-poc --region ap-southeast-2

# Tạo DynamoDB
aws dynamodb create-table \
    --table-name UserPortRegistry \
    --attribute-definitions AttributeName=userId,AttributeType=S \
    --key-schema AttributeName=userId,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region ap-southeast-2

# Tạo ECS Cluster
aws ecs create-cluster --cluster-name my-poc-cluster --region ap-southeast-2
```

### 2. IAM Role & Security Group Setup
```bash
# Tạo Security Group và mở dải port 8000-8100
aws ec2 create-security-group --group-name ecs-poc-sg --description "SG for ECS PoC" --vpc-id vpc-xxxx
aws ec2 authorize-security-group-ingress --group-id sg-02cb029d11148518a --protocol tcp --port 8000-8100 --cidr 0.0.0.0/0
```

### 3. EC2 Configuration (Troubleshooting & Manual Setup)
Do sử dụng Amazon Linux 2023 tiêu chuẩn (không phải bản ECS-Optimized), chúng ta đã thực hiện cài đặt thủ công các thành phần ECS Agent ngay bên trong máy ảo:

**Script cài đặt thủ công (Chạy bên trong EC2):**
```bash
# 1. Cài đặt Docker
sudo yum install -y docker
sudo systemctl enable --now docker

# 2. Cài đặt ECS Init (Bộ điều khiển kết nối AWS ECS)
sudo yum install -y ecs-init

# 3. Cấu hình định danh Cluster
sudo mkdir -p /etc/ecs
sudo sh -c "echo 'ECS_CLUSTER=my-poc-cluster' > /etc/ecs/ecs.config"

# 4. Kích hoạt và chạy ECS Agent
sudo systemctl enable --now ecs
```

## Verification
Kiểm tra số lượng Instance đã đăng ký thành công vào Cluster:
```bash
aws ecs describe-clusters --clusters my-poc-cluster --region ap-southeast-2 --query "clusters[0].registeredContainerInstancesCount"
# Kết quả: 1 (SUCCESS)
```

## Key Insights for Training
- **AMI Selection:** Luôn ưu tiên dùng `Amazon ECS-optimized AMI` để bỏ qua bước cài đặt thủ công.
- **IAM Role:** EC2 phải có Instance Profile với quyền `AmazonEC2ContainerServiceforEC2Role` thì mới có thể "chào hỏi" Cluster.
- **User Data:** Nếu dùng AMI chuẩn ECS, đoạn script `echo ECS_CLUSTER=...` phải được dán vào phần User Data lúc khởi tạo máy.
- **Port Management:** Dải port 8000-8100 đã được mở trên Security Group để sẵn sàng cho các container người dùng truy cập trực tiếp.
