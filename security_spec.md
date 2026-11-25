# PRINT KAMPUS Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Identity & Email Verification**: All mutations require `request.auth != null && request.auth.token.email_verified == true`.
2. **Role Separation**:
   - `users/{userId}`: Only the owning UID or an Admin may read/write PII (`email`, `phone`, `nim`).
   - `admins/{adminId}` & `admin_invites/{inviteId}`: Only Super Admin (`alimaturrosyidah2907@gmail.com`) or an existing Admin can manage Admin records (invited users can claim their own `admins/{uid}` doc only if a matching `admin_invites` doc exists and matches their verified email).
   - `mitras/{mitraId}` (private financials & `loginEmail`) is strictly separated from `mitra_public/{mitraId}` (non-PII storefront directory).
3. **Order Integrity**: An order cannot be created without an existing `mitra_public/{incoming().mitraId}`, must belong to `request.auth.uid` (unless created by Admin), starts with `status == 'menunggu_konfirmasi'`, and locks once `status` reaches `'selesai'` or `'dibatalkan'` (except Admin override).
4. **Temporal & Immutable Fields**: `createdAt` must equal `request.time` on creation and never mutate on update; `updatedAt` must equal `request.time` on write.
5. **No Ghost Fields / Value Poisoning**: Every collection enforces strict `keys().hasAll(...)`, `keys().hasOnly(...)`, `.size()` bounds on every string and list, and `affectedKeys().hasOnly(...)` on every update action.

## 2. The "Dirty Dozen" Attack Payloads (All Must Return PERMISSION_DENIED)
1. **Unauthenticated Order Create**: `orders/{id}` create with `request.auth == null`.
2. **Unverified Email Write**: `users/{uid}` create with `email_verified: false`.
3. **Shadow / Ghost Field Injection**: `users/{uid}` create including `isAdmin: true` or `role: 'admin'`.
4. **Identity Spoofing on Order**: `orders/{id}` create where `incoming().userId != request.auth.uid` by non-admin.
5. **Orphaned Order**: `orders/{id}` create referencing a nonexistent `mitraId`.
6. **State Shortcutting on Order Create**: `orders/{id}` create with `status: 'selesai'`.
7. **Post-Terminal Mutation**: `orders/{id}` update when `existing().status == 'selesai'` by non-admin.
8. **Cross-User PII Read**: `users/{otherUid}` get/list by non-owner non-admin.
9. **Unauthorized Commission Tampering**: `settings/platform` update by non-admin user or mitra.
10. **Mitra Balance Tampering**: `mitras/{id}` update changing `totalEarnings` or `pendingBalance` by non-admin/non-authorized rule.
11. **Path ID Poisoning**: Single-doc `create` with a 200-char or invalid-character document ID (`../bad!id`).
12. **Timestamp Backdating**: Creating/updating a document with a client-forged `createdAt` or `updatedAt != request.time`.
