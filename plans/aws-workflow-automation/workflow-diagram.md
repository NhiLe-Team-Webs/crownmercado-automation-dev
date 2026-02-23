# AWS Workflow Automation Diagram

Copy and paste this code into [Mermaid Live Editor](https://mermaid.live/) or an Excalidraw Mermaid pane.

```mermaid
graph TD
    User((User/Customer))
    LP[Landing Page - Next.js]
    
    subgraph AWS_Free_Tier [AWS Environment]
        AGW[API Gateway]
        Lambda[Lambda Orchestrator]
        DB_Registry[(DynamoDB Port Tracking)]
        
        subgraph EC2_Host [EC2 t3.micro]
            ECS[ECS Agent]
            SharedDB[(Shared Postgres Container)]
            UserApp1[User 1 Container - Port 8001]
            UserApp2[User 2 Container - Port 8002]
        end
    end

    Resend[Resend API - Email]
    
    User -->|1. Thanh toán/Trigger| LP
    LP -->|2. POST Request| AGW
    AGW -->|3. Invoke| Lambda
    Lambda -->|4. Cấp Port & Pass| DB_Registry
    Lambda -->|5. ecs:RunTask| ECS
    ECS -->|6. Start| UserApp1
    Lambda -->|7. Send Access Info| Resend
    Resend -->|8. Email Domain + Creds| User
    User -->|9. Truy cập: user.ip.sslip.io:port| UserApp1
```

## Architectural Notes for Tech Lead
- **Cost Efficiency:** Utilizes AWS Free Tier (EC2 t3.micro) by avoiding Fargate and ALB costs.
- **Scalability:** Vertical scaling is limited by RAM (1GB). Horizontal scaling can be achieved by adding more EC2 instances to the ECS Cluster.
- **DNS Strategy:** Uses `sslip.io` to provide immediate, zero-config subdomains for testing without paying for Route 53 or external domains.
- **Tenant Isolation:** Containers provide process and network isolation. Shared Postgres reduces overhead while maintaining logical data separation via unique database names.
