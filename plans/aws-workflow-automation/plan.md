---
title: AWS Workflow Automation (SaaS PoC)
description: Automated container provisioning for user signups using AWS ECS and Lambda.
status: completed
priority: high
effort: medium
branch: main
tags: [aws, automation, ecs, lambda, saas]
created: 2026-02-22
---

# Plan: AWS Workflow Automation (SaaS PoC)

This plan outlines the implementation of an automated workflow that provisions a dedicated Docker container instance for each user upon payment/trigger, using AWS Free Tier resources.

## Overview
- **Goal:** Automate the "User Signup -> Container Provisioning -> Email Notification" flow.
- **Infrastructure:** AWS ECS on a single EC2 (t3.micro).
- **Automation:** AWS Lambda triggered by API Gateway.
- **Access:** Subdomain-based routing via `sslip.io` and port mapping.
- **Database:** Shared Postgres instance with separate databases per user.

## Phases
1. **Phase 1: Foundation & AWS Infrastructure**
   - Setup ECR, ECS Cluster (EC2-backed), and DynamoDB for port tracking.
2. **Phase 2: Project Dockerization & Base Services**
   - Create Dockerfile for `crownmercado-automation-dev`.
   - Setup shared Postgres container on EC2.
3. **Phase 3: The Orchestration Engine (Lambda)** [Completed]
   - Implement Lambda logic: Dynamic port retrieval via DescribeTasks, ECS RunTask, and DynamoDB update.
4. **Phase 4: Integration & Delivery** [Completed]
   - Connected HTTP API Gateway (POST /provision) and integrated Resend for email delivery.

## Validation Log

### Session 1 — 2026-02-22
**Trigger:** Initial plan creation and architecture validation.
**Questions asked:** 3

#### Questions & Answers

1. **[Architecture]** How should the system track and assign ports for new user containers on the EC2 instance?
   - Options: DynamoDB Tracking (Recommended) | Live Scanning | AWS Load Balancer
   - **Answer:** DynamoDB Tracking (Recommended)
   - **Rationale:** Provides a fast, reliable way to manage port allocation without scanning the host every time.

2. **[Architecture]** Which method should be used to trigger the container creation?
   - Options: AWS ECS API (Recommended) | Direct Docker via SSM
   - **Answer:** AWS ECS API (Recommended)
   - **Rationale:** Focuses on learning AWS native services, which is the user's primary goal for future commercial projects.

3. **[Architecture]** How should the database be handled for each user instance?
   - Options: Shared DB Instance (Recommended) | Embedded Database
   - **Answer:** Shared DB Instance (Recommended)
   - **Rationale:** Essential for staying within the 1GB RAM limit of the AWS Free Tier (t3.micro).

#### Confirmed Decisions
- **Port Tracking:** Using DynamoDB to store {userId, port, status}.
- **Orchestration:** Using `@aws-sdk/client-ecs` in Lambda.
- **DB Strategy:** One Postgres container on the host EC2, users get their own database names.

#### Action Items
- [ ] Create ECR repository for the project.
- [ ] Set up EC2 with Docker and ECS agent.
- [x] Implement Lambda with ECS and DynamoDB permissions. (Phase 3)

#### Impact on Phases
- Phase 1: Needs to include DynamoDB table creation.
- Phase 2: Needs to include shared Postgres setup script.
- Phase 3: Focus solely on ECS API integration.
