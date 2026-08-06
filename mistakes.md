# Summary of Identified Mistakes & Technical Resolutions

This document provides a detailed post-mortem of all technical bugs, schema oversights, payment integration failures, and UX issues encountered, along with their underlying root causes and implemented fixes.

---

## 1. Webhook Transaction Lookup Mismatch (Auto-Crediting Failure)

### ❌ Symptom
When a student completed payment on Shake-Out (via Vodafone Cash or Fawry), Shake-Out sent a successful webhook notification (`transaction.updated`), but the student's platform balance was never updated and remained pending.

### 🔍 Root Cause
In `src/app/api/payments/shakeout/webhook/route.ts`, the database query searched for the pending transaction using an **exact string match** on the `note` field:
```typescript
const pendingTx = await prisma.balanceTransaction.findFirst({
  where: { userId, type: "pending_shakeout_wallet", note: searchRef }
});
```
However, during invoice creation, the note was saved with appended metadata (e.g. `shakeout_ref:NOajZqjvoX/eGl1wj7rXQp5OzZL|url:https://...`). As a result, exact string comparison failed, returning `null` and preventing balance crediting.

### 🛠️ Resolution
Updated the query to use partial pattern matching (`contains`):
```typescript
const pendingTx = await prisma.balanceTransaction.findFirst({
  where: {
    userId,
    type: "pending_shakeout_wallet",
    note: { contains: searchRef }
  }
});
```

---

## 2. Invalid Shake-Out Invoice Checkout URL Format (404 Error)

### ❌ Symptom
Clicking an invoice checkout link redirected students to `https://dash.shake-out.com/invoice/NOajZqjvoX`, which resulted in a `404 Not Found` page on Shake-Out.

### 🔍 Root Cause
According to Shake-Out's API documentation, vendor checkout URLs require **both** the `invoice_id` and the `invoice_ref`:
$$\text{Checkout URL Format: } \texttt{https://dash.shake-out.com/invoice/\{invoice\_id\}/\{invoice\_ref\}}}$$
The initial implementation only included `{invoice_id}` in the reference output.

### 🛠️ Resolution
Updated `src/lib/shakeout.ts` to construct `reference` as `${invoiceId}/${invoiceRef}` (e.g. `NOajZqjvoX/eGl1wj7rXQp5OzZL`), ensuring all checkout URLs resolve correctly:
```typescript
const combinedRef = `${invoiceId}/${invoiceRef}`;
const finalUrl = `https://dash.shake-out.com/invoice/${combinedRef}`;
```

---

## 3. Modal Popup Instead of Direct Invoice Redirect

### ❌ Symptom
Upon requesting a wallet top-up or booking via Shake-Out, the interface displayed a modal popup with reference instructions instead of automatically redirecting the student to the payment portal.

### 🔍 Root Cause
The frontend submit handlers in `src/app/(clerk)/account/page.tsx` and `src/components/teacher/BookingModal.tsx` checked only nested fields (`d.data?.payment_page_url`) instead of top-level `d.checkoutUrl`.

### 🛠️ Resolution
Updated frontend redirect logic to prioritize `checkoutUrl`:
```typescript
const targetUrl = d.checkoutUrl || d.data?.payment_page_url || d.data?.url || (d.reference ? `https://dash.shake-out.com/invoice/${d.reference}` : null);
if (targetUrl) {
  window.location.href = targetUrl;
  return;
}
```

---

## 4. Positive Amount Signed on Debit Purchases (`+10` in Green)

### ❌ Symptom
When a student purchased a teacher subscription plan, the transaction appeared in the student's ledger as `+10.00 جنيه` in GREEN (indicating credit) instead of `-10.00 جنيه` in RED.

### 🔍 Root Cause
In `src/app/api/teacher/subscribe-balance/route.ts`, the transaction was created with a positive number:
```typescript
// Incorrect:
amount: numAmount // (+10)
```

### 🛠️ Resolution
Explicitly negated `numAmount` for all debit transactions:
```typescript
// Correct:
amount: -numAmount // (-10)
```

---

## 5. Missing `teacherId` & `planType` in Booking Request Payload (`❌ معرف الأستاذ مطلوب`)

### ❌ Symptom
Clicking "شراء بـ 10 جنيه من رصيدك" inside `BookingModal` threw an error toast: `❌ معرف الأستاذ مطلوب`.

### 🔍 Root Cause
- `BookingModal.tsx` fetched `/api/teacher/subscribe-balance` passing `{ amount, planLabel, teacherName }`.
- `/api/teacher/subscribe-balance/route.ts` required `teacherId` and `planType` (`monthly` | `termly` | `yearly`).
- `BookingModalProps` did not include `teacherId`, so `[teacherSlug]/page.tsx` couldn't pass it.

### 🛠️ Resolution
1. Added `teacherId?: string` to `BookingModalProps`.
2. Passed `teacherId={p.teacherId}` from `src/app/[teacherSlug]/page.tsx`.
3. Updated `handlePayViaBalance` body payload to include `teacherId` and `planType: plan.type`.

---

## 6. Missing Subscription Data Model & Teacher Control Panel Visibility

### ❌ Symptom
Subscribing to a teacher did not store a persistent enrollment record. Teachers could not see who subscribed to them in their control panel, and students saw no indication of their active subscription on teacher profiles.

### 🔍 Root Cause
The database schema lacked a `TeacherSubscription` model, and no dashboard component existed for teachers to audit student bookings.

### 🛠️ Resolution
1. Created `TeacherSubscription` model in `prisma/schema.prisma`:
   ```prisma
   model TeacherSubscription {
     id               String    @id @default(cuid())
     studentId        String
     teacherId        String
     planType         String    // "monthly" | "termly" | "yearly"
     planLabel        String
     amount           Float
     educationalStage String?
     studentName      String?
     studentPhone     String?
     parentPhone      String?
     status           String    @default("active")
     createdAt        DateTime  @default(now())
     updatedAt        DateTime  @updatedAt

     student User @relation("StudentSubscriptions", fields: [studentId], references: [id], onDelete: Cascade)
     teacher User @relation("TeacherSubscriptions", fields: [teacherId], references: [id], onDelete: Cascade)

     @@unique([studentId, teacherId, planType])
     @@index([studentId])
     @@index([teacherId])
     @@index([status])
   }
   ```
2. Built `src/app/api/teacher/subscriptions/route.ts` (GET list, POST manual add) and `/api/teacher/my-subscription` (GET active student sub).
3. Created `TeacherSubscriptionsSection.tsx` inside `/adminpanel/teacher` under the sidebar section **"حجوزات وا اشتراكات الطلاب"**.
4. Added `<SubscriptionStatusBadge />` to teacher profile pages (`/[teacherSlug]`) to display active subscription status and details to logged-in students.
