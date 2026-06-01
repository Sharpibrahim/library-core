# Firestore Security Specification - LibraryCore

## Data Invariants
1. **User Identity**: A user can only modify their own profile. Roles ('admin', 'teacher') cannot be self-assigned unless the user is already an admin or the email matches the hardcoded admin.
2. **Conversations**: Only participants can read conversation metadata and messages.
3. **Course Management**: Only admins and teachers can create or modify courses/resources.
4. **Message Integrity**: Senders must be authenticated and match the `senderId` in the message payload.
5. **PII Protection**: User email and private info are protected behind ownership checks.

## The "Dirty Dozen" Payloads (Red Team Tests)

### T1: Identity Hijacking (Self-Elevation)
**Payload**: `update /users/current-std { role: 'admin' }` as a student.
**Expected**: PERMISSION_DENIED. Role change requires admin privileges.

### T2: Conversation Eavesdropping
**Payload**: `get /conversations/other-conv-id` as a user not in `participants`.
**Expected**: PERMISSION_DENIED.

### T3: Message Spoofing
**Payload**: `create /conversations/my-id/messages/msg1 { senderId: 'target-uid', content: 'fake' }`.
**Expected**: PERMISSION_DENIED. `senderId` must match `request.auth.uid`.

### T4: Shadow User Injection
**Payload**: `create /users/someone-else { uid: 'someone-else', role: 'admin' }`.
**Expected**: PERMISSION_DENIED. Can only create own document and default to 'student'.

### T5: Orphaned Resource Creation
**Payload**: `create /conversations/new-id { participants: ['me'] }`.
**Expected**: PERMISSION_DENIED. Requires exactly 2 participants.

### T6: Resource Theft (Teacher Simulation)
**Payload**: `create /courses/c1 { title: 'Hack', teacherId: 'me' }` as a student.
**Expected**: PERMISSION_DENIED. Requires 'teacher' or 'admin' role.

### T7: ID Poisoning (DOS Attack)
**Payload**: `create /users/very-long-id-intended-to-cause-storage-bloat...`.
**Expected**: PERMISSION_DENIED. `isValidId()` restricts size and format.

### T8: Blanket User Scraping
**Payload**: `list /users`.
**Expected**: PERMISSION_DENIED (unless query includes specific filters or admin).

### T9: Message Deletion (Sabotage)
**Payload**: `delete /conversations/my-id/messages/someone-elses-msg`.
**Expected**: PERMISSION_DENIED. Only sender (or admin) can delete.

### T10: Malicious Asset Override
**Payload**: `update /resources/res1 { fileUrl: 'malware-url' }` as a student.
**Expected**: PERMISSION_DENIED.

### T11: Invalid State Promotion
**Payload**: `update /courses/c1 { lessons: [null] }`.
**Expected**: PERMISSION_DENIED. `isValidCourse` validates schema integrity.

### T12: Unverified Email Access
**Payload**: `get /users/admin-uid` as an unverified user.
**Expected**: PERMISSION_DENIED. Sensitive reads require `email_verified == true`.

## Test Runner (firestore.rules.test.ts)
*Note: This is a conceptual test runner for local verification.*
```typescript
import { assertSucceeds, assertFails, initializeTestApp, clearFirestoreData } from '@firebase/rules-unit-testing';

// ... implementation of tests for the dirty dozen ...
```
