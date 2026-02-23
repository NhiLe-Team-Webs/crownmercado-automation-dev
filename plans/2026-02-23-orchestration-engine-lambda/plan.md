---
title: "Phase 3: The Orchestration Engine (Lambda)"
description: "Technical implementation plan for the AWS Lambda function to provision ECS tasks and manage ports via DynamoDB."
status: pending
priority: P1
effort: 6h
branch: main
tags: [aws, lambda, ecs, dynamodb, automation, typescript]
created: 2026-02-23
---

# Phase 3: The Orchestration Engine (Lambda)

## 🎯 Goal
Implement a Node.js (TypeScript) Lambda function that manages port allocation via DynamoDB and triggers ECS task provisioning for new users.

## 🏗 ECS Task Definition (crownmercado-poc-task.json)

```json
{
  "family": "crownmercado-poc-task",
  "containerDefinitions": [
    {
      "name": "crownmercado-poc-container",
      "image": "223776318322.dkr.ecr.ap-southeast-2.amazonaws.com/crownmercado-poc:latest",
      "memory": 256,
      "cpu": 256,
      "essential": true,
      "portMappings": [
        {
          "containerPort": 8000,
          "protocol": "tcp"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/crownmercado-poc-task",
          "awslogs-region": "ap-southeast-2",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ],
  "requiresCompatibilities": ["EC2"],
  "networkMode": "bridge"
}
```

## 📊 DynamoDB Port Management Logic
**Table Name:** `crownmercado-ports` (Defined in env)
**Primary Key:** `port` (Number)

**Logic Flow:**
1. **Fetch All Ports:** Scan or Query the table to get the list of currently assigned ports.
2. **Determine Next Port:**
   - If empty: Start at `8000`.
   - Else: Find the maximum port value and increment by 1.
3. **Reservation (Atomic):** Perform a `PutItem` with `ConditionExpression: "attribute_not_exists(port)"` to ensure no two Lambdas assign the same port simultaneously.

## 💻 Lambda Code Plan (TypeScript)

### Dependencies
- `@aws-sdk/client-ecs`
- `@aws-sdk/client-dynamodb`
- `@aws-sdk/lib-dynamodb`

### Environment Variables Needed
- `CLUSTER_NAME`: Name of the ECS Cluster.
- `TASK_DEFINITION`: `crownmercado-poc-task`.
- `TABLE_NAME`: DynamoDB table for port tracking.
- `EC2_IP`: The public IP of the EC2 instance hosting the containers.

### Code Structure

```typescript
// lambda/provision/index.ts
import { ECSClient, RunTaskCommand } from "@aws-sdk/client-ecs";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

const ecs = new ECSClient({});
const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);

const { CLUSTER_NAME, TASK_DEFINITION, TABLE_NAME, EC2_IP } = process.env;

export const handler = async (event: any) => {
    const userId = event.userId; // Assuming input contains userId

    try {
        // 1. Find next available port starting from 8000
        const assignedPort = await getNextAvailablePort();

        // 2. Reserve port in DynamoDB
        await ddb.send(new PutCommand({
            TableName: TABLE_NAME,
            Item: { port: assignedPort, userId, status: 'PROVISIONING', createdAt: Date.now() },
            ConditionExpression: "attribute_not_exists(port)"
        }));

        // 3. Run ECS Task with overrides
        const response = await ecs.send(new RunTaskCommand({
            cluster: CLUSTER_NAME,
            taskDefinition: TASK_DEFINITION,
            count: 1,
            launchType: "EC2",
            overrides: {
                containerOverrides: [{
                    name: "crownmercado-poc-container",
                    portMappings: [{
                        containerPort: 8000,
                        hostPort: assignedPort,
                        protocol: "tcp"
                    }],
                    environment: [
                        { name: "DB_NAME", value: `user_${userId}` },
                        { name: "APP_PASSWORD", value: generatePassword() }
                    ]
                }]
            }
        }));

        return {
            statusCode: 200,
            body: {
                message: "Provisioning started",
                url: `http://${EC2_IP}:${assignedPort}`,
                port: assignedPort
            }
        };

    } catch (error) {
        console.error(error);
        return { statusCode: 500, body: { error: error.message } };
    }
};

async function getNextAvailablePort(): Promise<number> {
    const result = await ddb.send(new ScanCommand({ TableName: TABLE_NAME, ProjectionExpression: "port" }));
    const ports = (result.Items || []).map(i => i.port as number);
    if (ports.length === 0) return 8000;
    return Math.max(...ports) + 1;
}

function generatePassword() { /* ... logic ... */ return "secure-pass"; }
```

## 🛠 Action Items
- [ ] Create `lambda/provision` directory.
- [ ] Setup `package.json` and `tsconfig.json`.
- [ ] Implement the full logic with error handling.
- [ ] Create the ECS Task Definition JSON file.

## ❓ Unresolved Questions
1. Should the port range have an upper limit (e.g., 8000-9000)?
2. Do we need to handle task termination/cleanup in this Lambda or a separate one?

