import type { WASocket } from "@whiskeysockets/baileys";
import { logger } from "./logger";

export async function sendRawWhatsAppMessage(
  socket: WASocket | null,
  jid: string,
  messageText: string
): Promise<void> {
  if (!socket) {
    throw new Error("WhatsApp socket is not connected or initialized.");
  }

  logger.debug("Dispatching message via Baileys socket", { jid, length: messageText.length });

  const result = await socket.sendMessage(jid, { text: messageText });

  if (!result || !result.key) {
    throw new Error("Baileys sendMessage did not return a valid message key.");
  }

  logger.info("Message successfully dispatched via Baileys", {
    jid,
    messageId: result.key.id,
  });
}
