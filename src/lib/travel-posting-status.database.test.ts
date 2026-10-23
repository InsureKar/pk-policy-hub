import postgres from "postgres";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, expect, it } from "vitest";

// Use only an explicitly supplied isolated database; never run fixtures on the CRM.
describe.skipIf(!process.env.POSTING_STATUS_TEST_DB_URL)("Travel Posting status database protections", () => {
  const sql = postgres(process.env.POSTING_STATUS_TEST_DB_URL ?? "postgres://localhost", { max: 1 });
  beforeAll(async () => {
    await sql.unsafe(`
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS 'SELECT nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
      GRANT USAGE ON SCHEMA auth TO authenticated;
      CREATE TYPE public.app_role AS ENUM ('admin','management','team_lead','do');
      CREATE TABLE public.user_roles(user_id uuid,role public.app_role);
      INSERT INTO public.user_roles VALUES
        ('00000000-0000-0000-0000-000000000001','admin'),('00000000-0000-0000-0000-000000000002','management'),
        ('00000000-0000-0000-0000-000000000003','team_lead'),('00000000-0000-0000-0000-000000000004','do');
      CREATE FUNCTION public.has_role(uuid,public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS 'SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=$1 AND role=$2)';
      CREATE TABLE public.travel_postings(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), posting_from date);
      GRANT SELECT, INSERT, UPDATE ON public.travel_postings TO authenticated;
      ALTER TABLE public.travel_postings ENABLE ROW LEVEL SECURITY;
      CREATE POLICY test_posting_access ON public.travel_postings FOR ALL TO authenticated USING(true) WITH CHECK(true);
      INSERT INTO public.travel_postings DEFAULT VALUES;
    `);
    await sql.unsafe(readFileSync("drizzle/migrations/0005_private_travel_posting_sent_status.sql", "utf8"));
  });
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
    await asRole("do", async (tx) => {
      const p = await tx`INSERT INTO public.travel_postings DEFAULT VALUES RETURNING id`;
      expect(p).toHaveLength(1);
      await tx.unsafe("RESET ROLE");
      expect((await tx`SELECT sent_status FROM public.travel_posting_delivery_status WHERE posting_id=${p[0].id}`)[0]?.sent_status).toBe("unsent");
    });
    const columns = await sql`SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='travel_posting_delivery_status' AND column_name='sent_status'`;
    expect(columns[0]?.column_default).toBe("'unsent'::text");
    const triggers = await sql`SELECT tgname FROM pg_trigger WHERE tgrelid='public.travel_postings'::regclass AND tgname='travel_posting_delivery_default' AND tgenabled='O'`;
    expect(triggers).toHaveLength(1);
  });
});