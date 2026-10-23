<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Client creation and editing share the Clients form; edits submit only changed information through the existing browser client and RLS, preserving ownership, permissions and linked deal data.
- Deal correction controls use an explicit schema-field catalog, exclude generated financial and audit-identity fields, and write through the authenticated browser client and RLS; ordinary-user instalment locks remain separate from manager correction access.
- Applied accounting-payment corrections use a database trigger that replays the existing specific-instalment-first/FIFO allocation and rejects mixed manual balances or settled commission conflicts rather than silently corrupting balances; payment insertion and financial rates stay unchanged.
