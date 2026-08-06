import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { normalizeEgyptPhone } from "@/lib/phone";

const awsRegion = process.env.AWS_REGION || "eu-north-1";

// SNS client initialization (uses explicit credentials if set, or default AWS SDK chain)
const snsClient = new SNSClient({
  region: awsRegion,
  credentials:
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      : undefined,
});

export type AwsSmsResult = {
  method: "dev" | "sns";
  dev?: boolean;
  code?: string;
  messageId?: string;
};

export async function sendVerificationSms(phone: string, code: string): Promise<AwsSmsResult> {
  let toNumber: string;
  if (typeof phone === "string" && /^\+20\d{10}$/.test(phone)) {
    toNumber = phone;
  } else {
    toNumber = normalizeEgyptPhone(phone);
  }

  if (process.env.DEV_SKIP_SMS === "true" || process.env.BYPASS_PHONE_VERIFICATION === "true") {
    console.log(`[AWS SNS DEV_SKIP] Skipping SMS to ${toNumber} — code=${code}`);
    return { dev: true, code, method: "dev" };
  }

  const message = `رمز التحقق من Code-UP: ${code}. ينتهي خلال 10 دقائق.`;

  const command = new PublishCommand({
    Message: message,
    PhoneNumber: toNumber,
    MessageAttributes: {
      "AWS.SNS.SMS.SMSType": {
        DataType: "String",
        StringValue: "Transactional",
      },
      "AWS.SNS.SMS.SenderID": {
        DataType: "String",
        StringValue: "CodeUP",
      },
    },
  });

  try {
    const response = await snsClient.send(command);
    console.log(`[AWS SNS SMS] Message sent to ${toNumber}; MessageId=${response.MessageId}`);
    return { method: "sns", messageId: response.MessageId };
  } catch (err: any) {
    console.error(`[AWS SNS SMS] Error sending SMS to ${toNumber}:`, err);
    throw new Error(`AWS SNS SMS delivery failed: ${err?.message || err}`);
  }
}

export function isPhoneVerificationBypassed() {
  return process.env.BYPASS_PHONE_VERIFICATION === "true";
}
