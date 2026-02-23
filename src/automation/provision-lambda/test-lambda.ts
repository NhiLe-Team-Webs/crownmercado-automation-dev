import * as dotenv from "dotenv";
import { fileURLToPath } from 'url';
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, ".env") });

import { handler } from "./index.js"; 

async function test() {
  const event = {
    admin_email: "vanductan.nlt@gmail.com", 
    subdomain: "tenant-test-final",
    company_name: "Tan Tech Solutions"
  };

  console.log("Environment check:");
  console.log("- CLUSTER_NAME:", process.env.CLUSTER_NAME);
  console.log("- RESEND_API_KEY:", process.env.RESEND_API_KEY ? "EXISTS" : "MISSING");

  console.log("\nRunning Lambda locally...");
  try {
    const result = await handler(event as any);
    console.log("\nFinal Result:", JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("\nExecution Error:", err);
  }
}

test().catch(console.error);
