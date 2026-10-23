import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Explicitly opt in with an isolated database; never run fixtures on the CRM.
const url = process.env.DEAL_SAVE_TEST_DB_URL;
describe.skipIf(!url)("atomic deal submission (isolated PostgreSQL)", () => {
  const sql = postgres(url ?? "postgres://localhost", { max: 20 });
  const owner = randomUUID();
  const otherUser = randomUUID();
  const client = randomUUID();
  beforeAll(async () => {
    await sql.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role; END IF;
      END $$;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
        'SELECT nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
      GRANT USAGE ON SCHEMA auth TO authenticated;
      GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
      CREATE TABLE public.deals (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id uuid, created_by uuid NOT NULL, notes text,
        gross_premium numeric NOT NULL DEFAULT 0
      );
      GRANT SELECT, INSERT ON public.deals TO authenticated;
      ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
      CREATE POLICY test_insert ON public.deals FOR INSERT TO authenticated WITH CHECK(created_by = auth.uid());
      CREATE POLICY test_read ON public.deals FOR SELECT TO authenticated USING(notes <> 'private' OR created_by = auth.uid());
      CREATE TABLE public.test_insert_events(deal_id uuid);
      CREATE FUNCTION public.test_insert_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS
        'BEGIN INSERT INTO public.test_insert_events VALUES (NEW.id); RETURN NEW; END';
      CREATE TRIGGER test_insert_event AFTER INSERT ON public.deals FOR EACH ROW EXECUTE FUNCTION public.test_insert_event();
    `);
    await sql.unsafe(readFileSync("drizzle/migrations/0004_idempotent_deal_creation.sql", "utf8"));
  });
  afterAll(async () => { await sql.end(); });
  const submit = (key: string, user = owner, notes = "shared") => sql.begin(async (tx) => {
    await tx.unsafe("SET LOCAL ROLE authenticated");
    await tx`SELECT set_config('request.jwt.claim.sub', ${user}, true)`;
    const rows = await tx`SELECT public.create_deal_once(${key}::uuid, ${tx.json({ client_id: client, created_by: user, notes })}) AS result`;
    return rows[0].result as { id: string; replayed: boolean };
  });
  it("returns one original result for 20 simultaneous requests across two authorized users", async () => {
    const key = randomUUID();
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => submit(key, i % 2 ? owner : otherUser)));
    expect(new Set(results.map((r) => r.id)).size).toBe(1);
    expect(results.filter((r) => !r.replayed)).toHaveLength(1);
    expect(Number((await sql`SELECT count(*) FROM public.deals WHERE submission_key=${key}`)[0].count)).toBe(1);
    expect(Number((await sql`SELECT count(*) FROM public.test_insert_events WHERE deal_id=${results[0].id}`)[0].count)).toBe(1);
    const retry = await submit(key);
    expect(retry).toEqual({ id: results[0].id, replayed: true });
  });
  it("allows separate keys for legitimate deals with the same client", async () => {
    const a = await submit(randomUUID());
    const b = await submit(randomUUID());
    expect(a.id).not.toBe(b.id);
    expect((await sql`SELECT gross_premium FROM public.deals WHERE id=${a.id}`)[0].gross_premium).toBe("0");
  });
  it("does not reveal or duplicate an inaccessible original deal", async () => {
    const key = randomUUID();
    await submit(key, owner, "private");
    await expect(submit(key, otherUser, "private")).rejects.toMatchObject({ code: "23505" });
    expect(Number((await sql`SELECT count(*) FROM public.deals WHERE submission_key=${key}`)[0].count)).toBe(1);
  });
  it("allows retrying the same key after a failed insert", async () => {
    const key = randomUUID();
    await expect(sql`SELECT public.create_deal_once(${key}::uuid, '{}'::jsonb)`).rejects.toMatchObject({ code: "42501" });
    expect((await submit(key)).replayed).toBe(false);
  });
});