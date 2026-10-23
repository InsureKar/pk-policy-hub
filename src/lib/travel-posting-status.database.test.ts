import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

// Explicit opt-in. Every write is rolled back; no CRM records are retained or changed.
describe.skipIf(process.env.POSTING_STATUS_DB_TEST !== "1")("Travel Posting status database protections", () => {
  const sql = postgres({ host: process.env.PGHOST, port: Number(process.env.PGPORT ?? 5432), username: process.env.PGUSER, password: process.env.PGPASSWORD, database: process.env.PGDATABASE, ssl: process.env.PGSSLMODE === "disable" ? false : "require", max: 1 });
  afterAll(async () => { await sql.end(); });
  const rolledBack = new Error("rollback test changes");
  async function asRole(role: string, run: (tx: postgres.TransactionSql, postingId: string) => Promise<void>) {
    try {
      await sql.begin(async tx => {
        const users = await tx`SELECT user_id FROM public.user_roles WHERE role=${role}::public.app_role LIMIT 1`;
        const postings = await tx`SELECT id FROM public.travel_postings LIMIT 1`;
        if (!users[0] || !postings[0]) throw new Error("Required role/posting fixture is absent");
        await tx.unsafe("SET LOCAL ROLE authenticated");
        await tx`SELECT set_config('request.jwt.claim.sub', ${users[0].user_id}, true)`;
        await run(tx, postings[0].id);
        throw rolledBack;
      });
    } catch (error) { if (error !== rolledBack) throw error; }
  }
  for (const role of ["admin", "management"]) {
    it(`${role} can change Sent/Unsent at any time and unrelated header edits preserve it`, async () => {
      await asRole(role, async (tx, id) => {
        await tx`INSERT INTO public.travel_posting_delivery_status(posting_id,sent_status) VALUES(${id},'sent') ON CONFLICT(posting_id) DO UPDATE SET sent_status='sent'`;
        await tx`UPDATE public.travel_postings SET posting_from=posting_from WHERE id=${id}`;
        expect((await tx`SELECT sent_status FROM public.travel_posting_delivery_status WHERE posting_id=${id}`)[0]?.sent_status).toBe("sent");
        await tx`UPDATE public.travel_posting_delivery_status SET sent_status='unsent' WHERE posting_id=${id}`;
        expect((await tx`SELECT sent_status FROM public.travel_posting_delivery_status WHERE posting_id=${id}`)[0]?.sent_status).toBe("unsent");
      });
    });
  }
  for (const role of ["do", "team_lead"]) {
    it(`${role} cannot read or update status`, async () => {
      await asRole(role, async (tx, id) => {
        expect(await tx`SELECT * FROM public.travel_posting_delivery_status`).toHaveLength(0);
        expect(await tx`UPDATE public.travel_posting_delivery_status SET sent_status='sent' WHERE posting_id=${id} RETURNING posting_id`).toHaveLength(0);
      });
    });
    it(`${role} cannot create a tracking status`, async () => {
      await expect(asRole(role, async (tx, id) => {
        await tx`INSERT INTO public.travel_posting_delivery_status(posting_id,sent_status) VALUES(${id},'sent') ON CONFLICT(posting_id) DO UPDATE SET sent_status='sent'`;
      })).rejects.toMatchObject({ code: "42501" });
    });
  }
  it("new tracking rows default to Unsent and the posting insert trigger exists", async () => {
    const columns = await sql`SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='travel_posting_delivery_status' AND column_name='sent_status'`;
    expect(columns[0]?.column_default).toBe("'unsent'::text");
    const triggers = await sql`SELECT tgname FROM pg_trigger WHERE tgrelid='public.travel_postings'::regclass AND tgname='travel_posting_delivery_default' AND tgenabled='O'`;
    expect(triggers).toHaveLength(1);
  });
});