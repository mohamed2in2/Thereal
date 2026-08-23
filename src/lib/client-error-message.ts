/** Stable Arabic copy for common API failures; callers may still prefer the
 * server-provided message when it is already user-facing Arabic. */
export function clientErrorMessage(
  status: number,
  payload?: { error?: unknown; code?: unknown; requiredItem?: { title?: unknown } }
): string {
  if (status === 401) return "انتهت جلستك. سجّل الدخول مرة أخرى.";
  if (status === 409) return "تم إرسال هذا الطلب من قبل بالفعل.";
  if (status === 400) return "البيانات المدخلة غير صحيحة. راجعها وحاول مرة أخرى.";
  if (status === 403 && payload?.code === "PREREQUISITE_LOCKED") {
    const title = typeof payload.requiredItem?.title === "string" ? payload.requiredItem.title : "المحتوى السابق";
    return `أكمل «${title}» أولًا لفتح هذا المحتوى.`;
  }
  return typeof payload?.error === "string" && payload.error.trim()
    ? payload.error
    : "حدث خطأ. حاول مرة أخرى.";
}
