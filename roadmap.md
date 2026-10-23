# Deal correction access
- [x] Enable admin/management corrections across deal fields and instalments without changing ordinary-user locks.
- [x] Provide correction/add/delete controls for linked bulk, travel, documents and accounting records with guarded payment reversals.
- [x] Verify permission and calculation tests and clean app compilation; confirm new database policies and trigger exist.
- [ ] Verify admin/management saves and deletes end-to-end — blocked by declined administrator sign-in; current team-lead account has no visible deal rows.

# Deal save protection
- [ ] Add immediate loading and synchronous submission locks to creation and existing deal updates.
- [ ] Add atomic database idempotency for new deals without changing existing records or access rules.
- [ ] Test retries, slow responses and simultaneous submissions; verify the existing success destination.