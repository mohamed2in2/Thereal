process.env.JWT_SECRET = "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAw4B7eCddWooVLwvRw0P5t97yNERvopUGZK6VbFB2Uhvq5eJBspJHvvJU>";
process.env.SUPERADMIN_MASTER_PASSWORD = "BasicLockNum67";
(process.env as any).NODE_ENV = "development";

import { NextRequest } from "next/server";
import { POST } from "../src/app/api/admin/login/route";

async function runTest() {
  console.log("Running login API test...");
  
  try {
    const mockRequest = new NextRequest("http://localhost:3000/api/admin/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        role: "superadmin",
        password: "BasicLockNum67"
      })
    });

    const response = await POST(mockRequest);
    console.log("Response status:", response.status);
    console.log("Response text:", await response.text());
  } catch (err: any) {
    console.error("Test caught direct crash error:");
    console.error(err?.stack || err);
  }
}

runTest();
