# Security Specification for KonnectS

## 1. Data Invariants
- A user profile can only be created by the authenticated user owning that UID.
- Marketplace items must have a valid seller ID matching the creator.
- Items marked as free cannot have a price greater than 0.
- Chat messages can only be sent by the authenticated sender.
- Workers cannot verify themselves; verification must be an administrative action (or simulated for this demo).
- Sensitive documents like passports/driving licenses must only be readable by the owner and authorized admins.

## 2. The "Dirty Dozen" Payloads (Denial Tests)
1. **Identity Spoofing**: Attempt to create a user profile with `uid: "victim_id"` while logged in as `attacker_id`.
2. **Price Injection**: Attempt to set `price: 100` on an item where `isFree: true`.
3. **Ghost Seller**: Create an item with `sellerId: "someone_else"`.
4. **Unauthorized Read**: Attempt to read another user's `mobileNumber` or `documents` if not the owner.
5. **Admin Escalation**: Attempt to set `verificationStatus: "verified"` on own profile.
6. **Chat Hijack**: Send a message where `senderId` does not match `request.auth.uid`.
7. **Jumbo ID**: Attempt to create a document with a 2KB string as ID.
8. **Shadow Field**: Adding `isSystemAdmin: true` to a user profile update.
9. **Backdated Entry**: Attempting to set `createdAt` to a date in the past instead of `request.time`.
10. **Orphaned Message**: Creating a message in a chat where the user is not a participant.
11. **Negative Reward**: Setting `rewardsPoints` to a huge negative number.
12. **Double Referral**: Trying to set `invitedBy` after it's already been set.

## 3. Test Runner (Draft)
The tests will be executed via custom logic or assumed for the rules construction.
