const cooldowns = new Map<string, number>();

/**
 * Checks if the request is allowed for a given phone number.
 * If allowed, sets the cooldown timestamp and returns true.
 * If not allowed, returns false with the remaining seconds.
 */
export function checkCooldown(
  phone: string,
  cooldownMs = 60000
): { allowed: boolean; remainingSeconds: number } {
  const now = Date.now();

  // Clean up expired entries to prevent memory leaks
  for (const [key, val] of cooldowns.entries()) {
    if (now - val >= cooldownMs) {
      cooldowns.delete(key);
    }
  }

  const lastSent = cooldowns.get(phone);
  if (lastSent && now - lastSent < cooldownMs) {
    const remainingSeconds = Math.ceil((cooldownMs - (now - lastSent)) / 1000);
    return { allowed: false, remainingSeconds };
  }

  // Update/Set timestamp
  cooldowns.set(phone, now);
  return { allowed: true, remainingSeconds: 0 };
}
