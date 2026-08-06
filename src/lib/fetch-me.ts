export interface MeUser {
  id: string;
  name: string;
  email: string;
  role: string;
  profileCompleted?: boolean;
  phone?: string | null;
  parentPhone?: string | null;
  age?: number | null;
  educationalStage?: string | null;
  clerkId?: string | null;
}

export async function fetchMeWithRetry(
  maxAttempts = 10,
  baseDelayMs = 250
): Promise<MeUser | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch("/api/auth/me", { credentials: "include" });
      const data = (await response.json()) as { user: MeUser | null };

      if (data.user) {
        return data.user;
      }
    } catch {
      // retry
    }

    if (attempt < maxAttempts - 1) {
      const delay = Math.min(baseDelayMs * (attempt + 1), 2000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return null;
}
