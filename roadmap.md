# Deal correction access
## Travel Posting status
- [ ] Add private Admin/Management Sent/Unsent storage with Unsent defaults and no changes to financial records.
- [ ] Show status controls and All/Sent/Unsent filters in posting list and details.
- [ ] Verify role restrictions, status persistence and unaffected posting edits.

- [x] Enable admin/management corrections across deal fields and instalments without changing ordinary-user locks.
- [x] Provide correction/add/delete controls for linked bulk, travel, documents and accounting records with guarded payment reversals.
- [x] Verify permission and calculation tests and clean app compilation; confirm new database policies and trigger exist.
- [ ] Verify admin/management saves and deletes end-to-end — blocked by declined administrator sign-in; current team-lead account has no visible deal rows.

# Deal save protection
- [x] Add immediate loading and synchronous submission locks to creation and existing deal updates.
- [x] Add atomic database idempotency for new deals without changing existing records or access rules.
- [x] Test retries, slow responses and simultaneous submissions; verify the existing success destination. Database concurrency verified on isolated PostgreSQL; authenticated UI failures, retries and replay navigation verified with intercepted writes to preserve CRM data. Live new-deal creation was intentionally not performed.