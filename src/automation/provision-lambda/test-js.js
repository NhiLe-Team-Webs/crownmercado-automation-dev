require('dotenv').config();
const { handler } = require('./index');

async function test() {
  const event = {
    admin_email: "tan.pham@crownmercado.com", 
    subdomain: "test-tenant-js",
    company_name: "Test JS Company"
  };

  console.log("Starting test...");
  try {
    const result = await handler(event);
    console.log("Result:", JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("Error:", err);
  }
}

test();
