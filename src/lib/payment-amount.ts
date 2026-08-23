export interface PaymentAmountCheck {
  valid: boolean;
  verifiedAmount: number;
  expectedAmount: number;
}

/** Binds a provider-confirmed payment to its server-created ledger amount. */
export function checkVerifiedPaymentAmount({
  providerAmount,
  pendingBaseAmount,
  note,
  tolerance = 0.01,
  acceptBaseAmount = false,
}: {
  providerAmount: unknown;
  pendingBaseAmount: number;
  note: string | null | undefined;
  tolerance?: number;
  acceptBaseAmount?: boolean;
}): PaymentAmountCheck {
  const verifiedAmount = Number(providerAmount);
  const totalMatch = note?.match(/\|total:(\d+(?:\.\d+)?)/);
  const parsedTotal = totalMatch ? Number(totalMatch[1]) : Number.NaN;
  const expectedAmount = Number.isFinite(parsedTotal) ? parsedTotal : pendingBaseAmount;

  const matchesExpected =
    Number.isFinite(verifiedAmount) &&
    verifiedAmount > 0 &&
    Number.isFinite(expectedAmount) &&
    expectedAmount > 0 &&
    Math.abs(verifiedAmount - expectedAmount) <= tolerance;
  const matchesBase =
    acceptBaseAmount &&
    Number.isFinite(verifiedAmount) &&
    Number.isFinite(pendingBaseAmount) &&
    Math.abs(verifiedAmount - pendingBaseAmount) <= tolerance;

  return {
    valid: matchesExpected || matchesBase,
    verifiedAmount,
    expectedAmount,
  };
}
