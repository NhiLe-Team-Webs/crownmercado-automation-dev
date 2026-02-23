# Final Report: AWS Workflow Automation (SaaS PoC)

## Executive Summary
The automated container provisioning workflow for the Crownmercado SaaS PoC is now fully implemented and tested. The system allows for dynamic creation of dedicated application instances upon user signup/payment, leveraging AWS Free Tier resources effectively.

## Final Architecture: End-to-End Flow

```mermaid
graph TD
    LP[Landing Page / Client] -- "POST /provision" --> APIGW[API Gateway (HTTP API)]
    APIGW -- "Trigger" --> Lambda[AWS Lambda (Node.js)]
    Lambda -- "Check/Update Port" --> DDB[(DynamoDB Table)]
    Lambda -- "RunTask (Fargate/EC2)" --> ECS[AWS ECS Cluster]
    ECS -- "Deploy Container" --> EC2[EC2 Instance (t3.micro)]
    Lambda -- "Send Access Email" --> Resend[Resend API]
    Resend -- "Email" --> User[End User]
    User -- "Access http://user-id.ip.sslip.io:port" --> EC2
```

### 1. Trigger (Landing Page -> API Gateway)
- The flow starts with a client request (e.g., from a Landing Page or Stripe Webhook) to the **API Gateway**.
- **Endpoint:** `POST /provision` (HTTP API).
- **Stage:** `$default`.

### 2. Orchestration (Lambda)
- The **AWS Lambda** function acts as the central brain.
- It performs the following sequence:
    - **Port Allocation:** Reads/Updates a **DynamoDB** table (`PortTracking`) to find the next available port (starting from 3000).
    - **Container Provisioning:** Calls the ECS `RunTask` API to start a new task in the cluster.
    - **Network Mapping:** Passes the assigned port as an environment variable to the container.
    - **Persistence:** Updates DynamoDB with the mapping of `{userId, port, taskId}`.

### 3. Execution (ECS on EC2)
- **AWS ECS** manages the lifecycle of the container.
- The task is deployed to a **t3.micro EC2 instance** configured as a container instance.
- Docker port mapping maps the host's assigned port to the container's internal port (e.g., `8080`).

### 4. Notification (Resend)
- Once the provisioning is initiated, the Lambda uses the **Resend SDK** to send a welcome email.
- The email contains a unique access URL generated using `sslip.io` (e.g., `http://user-123.54.123.45.sslip.io:3001`).

### 5. Access (User)
- The user clicks the link and accesses their dedicated instance directly via the assigned port.

## Technical Stack
- **Compute:** AWS Lambda (Orchestration), AWS ECS on EC2 (Execution).
- **Database:** DynamoDB (Metadata/Port Tracking), Shared Postgres (Application Data).
- **Connectivity:** API Gateway (HTTP API), `sslip.io` (Wildcard DNS).
- **Communication:** Resend (Email Delivery).

## Conclusion
The architecture satisfies the "KISS" principle while providing a scalable foundation for a SaaS platform. It stays within the AWS Free Tier limits while demonstrating professional-grade automation.
