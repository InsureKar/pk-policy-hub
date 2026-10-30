# Deal correction access
## Dashboard filters
- [x] Share Business Overview's applied period and DO selection with the highlighted dashboard cards and their deal lists.
- [x] Verify filter/reset behavior and existing calculations: 16 tests passed; authenticated October selection showed 12 deals, a populated DO list showed the same 12 matching deals, empty DO selection showed zero, and Reset restored 43 deals with no browser errors.

# Refund documents
- [x] Add refusal letter and policy uploads to saved refunds using existing edit and view rights.
- [x] Verify attachment storage, permission policies and upload/view flow — eight tests passed; both files uploaded, persisted after reload and opened on a temporary refund; test records and files removed.

## Travel Posting status
- [x] Add private Admin/Management Sent/Unsent storage with Unsent defaults and no changes to financial records.
- [x] Show status controls and All/Sent/Unsent filters in posting list and details.
- [x] Verify role restrictions, status persistence and unaffected posting edits — isolated database tests passed; authenticated manager changed status, reloaded it, restored Unsent and filtered the list.

- [x] Enable admin/management corrections across deal fields and instalments without changing ordinary-user locks.
- [x] Provide correction/add/delete controls for linked bulk, travel, documents and accounting records with guarded payment reversals.
- [x] Verify permission and calculation tests and clean app compilation; confirm new database policies and trigger exist.
- [ ] Verify admin/management saves and deletes end-to-end — blocked by declined administrator sign-in; current team-lead account has no visible deal rows.

# Deal save protection
- [x] Add immediate loading and synchronous submission locks to creation and existing deal updates.
- [x] Add atomic database idempotency for new deals without changing existing records or access rules.
- [x] Test retries, slow responses and simultaneous submissions; verify the existing success destination. Database concurrency verified on isolated PostgreSQL; authenticated UI failures, retries and replay navigation verified with intercepted writes to preserve CRM data. Live new-deal creation was intentionally not performed.- [x] Refunds module under Operations (import, update, permissions, own-only access)
