import { ECSClient, RunTaskCommand, DescribeTasksCommand } from "@aws-sdk/client-ecs";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { Resend } from "resend";

// AWS Clients
const ecs = new ECSClient({ region: "ap-southeast-2" });
const ddbClient = new DynamoDBClient({ region: "ap-southeast-2" });
const ddb = DynamoDBDocumentClient.from(ddbClient);

// Constants
const CLUSTER_NAME = process.env.CLUSTER_NAME || "my-poc-cluster";
const TASK_DEFINITION = process.env.TASK_DEFINITION || "crownmercado-poc-task";
const TABLE_NAME = process.env.TABLE_NAME || "UserPortRegistry";
const EC2_PUBLIC_IP = process.env.EC2_PUBLIC_IP || "3.106.137.40";
const RESEND_API_KEY = process.env.RESEND_API_KEY;

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

export const handler = async (event: any) => {
  console.log("Full Event received:", JSON.stringify(event, null, 2));

  // Parse body if it comes from API Gateway
  let data = event;
  if (event.body && typeof event.body === 'string') {
    try {
      data = JSON.parse(event.body);
    } catch (e) {
      console.error("Failed to parse event body:", event.body);
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Invalid JSON in request body" })
      };
    }
  }

  const { admin_email, subdomain, company_name } = data;
  console.log("Parsed request data:", { admin_email, subdomain, company_name });

  // 1. Validation
  if (!admin_email || !subdomain || !company_name) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Missing required fields: admin_email, subdomain, company_name" })
    };
  }

  const tenantId = subdomain.toLowerCase().replace(/[^a-z0-9]/g, "");
  const dbName = `db_${tenantId}`;

  try {
    // 2. Run ECS Task
    console.log("Starting ECS Task...");
    const ecsResponse = await ecs.send(new RunTaskCommand({
      cluster: CLUSTER_NAME,
      taskDefinition: TASK_DEFINITION,
      launchType: "EC2",
      count: 1,
      overrides: {
        containerOverrides: [{
          name: "crownmercado-poc-container",
          environment: [
            { name: "USER_ID", value: tenantId },
            { name: "COMPANY_NAME", value: company_name },
            { name: "DB_NAME", value: dbName },
            { name: "DATABASE_URL", value: `postgresql+asyncpg://admin:admin_pass_123@172.17.0.1:5432/${dbName}` }
          ]
        }]
      }
    }));

    const taskArn = ecsResponse.tasks?.[0]?.taskArn;
    if (!taskArn) {
      console.error("ECS RunTask Failures:", JSON.stringify(ecsResponse.failures, null, 2));
      const reason = ecsResponse.failures?.[0]?.reason || "No ARN returned";
      throw new Error(`Failed to start ECS Task - ${reason}`);
    }

    console.log(`Task started: ${taskArn}. Waiting for port allocation...`);

    // 3. Wait and fetch the assigned port
    // Poll up to 20 times × 5s = 100s total (Lambda timeout: 180s)
    let assignedPort: number | undefined;
    let attempts = 0;
    const MAX_ATTEMPTS = 20;
    const POLL_INTERVAL_MS = 5000;

    while (!assignedPort && attempts < MAX_ATTEMPTS) {
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
      const taskDetail = await ecs.send(new DescribeTasksCommand({
        cluster: CLUSTER_NAME,
        tasks: [taskArn]
      }));

      const task = taskDetail.tasks?.[0];
      const container = task?.containers?.[0];
      const taskStatus = task?.lastStatus;
      const containerStatus = container?.lastStatus;

      console.log(`[Poll ${attempts + 1}/${MAX_ATTEMPTS}] Task: ${taskStatus}, Container: ${containerStatus}, Bindings: ${JSON.stringify(container?.networkBindings)}`);

      assignedPort = container?.networkBindings?.[0]?.hostPort;
      attempts++;

      // Exit early if task failed
      if (taskStatus === 'STOPPED') {
        const reason = task?.stoppedReason || 'Unknown reason';
        throw new Error(`ECS Task stopped unexpectedly: ${reason}`);
      }
    }

    if (!assignedPort) {
      throw new Error(`Port allocation timeout after ${MAX_ATTEMPTS * POLL_INTERVAL_MS / 1000}s - ECS did not provide a hostPort binding.`);
    }

    console.log(`Successfully provisioned. Assigned Host Port: ${assignedPort}`);

    const accessUrl = `http://${tenantId}.${EC2_PUBLIC_IP}.sslip.io:${assignedPort}`;

    // 4. Update DynamoDB Registry
    await ddb.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        userId: tenantId,
        email: admin_email,
        companyName: company_name,
        port: assignedPort,
        taskArn: taskArn,
        status: "RUNNING",
        createdAt: new Date().toISOString(),
        accessUrl: accessUrl
      }
    }));

    // 5. Send Email via Resend
    if (resend) {
      console.log(`Sending email to ${admin_email}...`);
      await resend.emails.send({
        from: "Crown Mercado <onboarding@resend.dev>",
        to: admin_email,
        subject: `Your ${company_name} instance is ready!`,
        html: `
          <h1>Hệ thống của bạn đã sẵn sàng!</h1>
          <p>Chào mừng <strong>${company_name}</strong>,</p>
          <p>Hệ thống Crown Mercado của bạn đã được khởi tạo thành công.</p>
          <p><strong>Thông tin truy cập:</strong></p>
          <ul>
            <li><strong>Đường dẫn:</strong> <a href="${accessUrl}">${accessUrl}</a></li>
            <li><strong>Tên đăng nhập:</strong> admin</li>
            <li><strong>Mật khẩu:</strong> (Mật khẩu mặc định của hệ thống)</li>
          </ul>
          <p>Trân trọng,<br/>Đội ngũ Crown Mercado</p>
        `
      });
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST,OPTIONS"
      },
      body: JSON.stringify({
        message: "Instance provisioned successfully",
        tenantId,
        accessUrl,
        port: assignedPort,
        emailSent: !!resend
      })
    };

  } catch (error: any) {
    console.error("Provisioning Error:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST,OPTIONS"
      },
      body: JSON.stringify({ error: "Provisioning failed", details: error.message })
    };
  }
};
