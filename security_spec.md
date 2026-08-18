# Security Specification & Threat Model for Firestore Rules

## 1. Data Invariants
1. **User Identity Invariant**: A user document at `/users/{userId}` can only be created or modified by the authenticated user whose `request.auth.uid == userId`.
2. **Read Security**: Authenticated users can read entities (persons, parties, alliances, assemblies, designations, constituencies) to explore legislative data.
3. **Data Integrity & Schema Conformance**: All entity modifications (persons, parties, alliances, assemblies, designations, constituencies) require an authenticated user, strict validation functions (`isValid*`), length constraints, and allowed fields to prevent arbitrary field poisoning.
4. **Denial-of-Wallet Resistance**: All document ID path variables are guarded by `isValidId()` ensuring length <= 128 and matching `^[a-zA-Z0-9_\\-]+$`.

## 2. The "Dirty Dozen" Payloads (Attack Vectors)
1. **Unauthenticated Read of User PII**: Requesting `/users/{userId}` with `auth == null` -> `PERMISSION_DENIED`.
2. **User Profile Spoofing**: User `attacker` attempting to write `/users/targetVictim` -> `PERMISSION_DENIED`.
3. **Ghost Role Escalation**: User attempting to set `role: 'superadmin'` in `/users/{userId}` during creation/update -> `PERMISSION_DENIED`.
4. **Path Variable ID Injection**: Attempting to write `/persons/../../etc/passwd` or oversized junk ID -> `PERMISSION_DENIED`.
5. **Oversized String Payload (Denial-of-Wallet)**: Sending 10MB string in `name` field -> `PERMISSION_DENIED`.
6. **Unauthenticated Entity Injection**: Anonymous write to `/assemblies/asm-15` -> `PERMISSION_DENIED`.
7. **Type Poisoning**: Sending boolean `true` for `updatedAt` instead of integer/number timestamp -> `PERMISSION_DENIED`.
8. **Shadow Field Injection**: Writing ghost fields (e.g. `isHacked: true`) to `/parties/cpim` -> `PERMISSION_DENIED`.
9. **Arbitrary Collection Write**: Attempting to create documents in arbitrary collections like `/admin_secrets/{id}` -> `PERMISSION_DENIED` (Global Default Deny).
10. **Malicious SlNo Format**: Sending non-string or 500-char string in `Constituency.slNo` -> `PERMISSION_DENIED`.
11. **Incumbent Spoofing on Designation**: Submitting a designation with empty/missing required name or incumbent -> `PERMISSION_DENIED`.
12. **Blanket Query Scraping**: Attempting unauthenticated bulk query scraping on users collection -> `PERMISSION_DENIED`.
