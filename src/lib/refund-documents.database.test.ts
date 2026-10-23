import postgres from "postgres";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, expect, it } from "vitest";

// Fixtures must only run against a disposable database, never CRM data.
describe.skipIf(!process.env.REFUND_DOCUMENT_TEST_DB_URL)("Refund document permissions", () => {
  const sql = postgres(process.env.REFUND_DOCUMENT_TEST_DB_URL ?? "postgres://localhost", { max: 1 });
  const own = "00000000-0000-0000-0000-000000000003";
  const other = "00000000-0000-0000-0000-000000000004";
  const refund = "10000000-0000-0000-0000-000000000001";
  const path = `${refund}/policy/test.pdf`;
  beforeAll(async () => {
    await sql.unsafe(`
      CREATE SCHEMA auth; CREATE SCHEMA storage;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS 'SELECT nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
      GRANT USAGE ON SCHEMA auth, storage TO authenticated;
      CREATE TYPE public.app_role AS ENUM ('admin','management','team_lead','do');
      CREATE TABLE public.user_roles(user_id uuid, role public.app_role);
      INSERT INTO public.user_roles VALUES ('00000000-0000-0000-0000-000000000001','admin'),('00000000-0000-0000-0000-000000000002','management'),('${own}','do'),('${other}','do');
      CREATE FUNCTION public.has_role(uuid,public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS 'SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=$1 AND role=$2)';
      CREATE FUNCTION public.perm_key_level(uuid,text) RETURNS text LANGUAGE sql STABLE AS 'SELECT CASE WHEN $2=''refunds.view'' THEN ''view'' ELSE ''none'' END';
      CREATE FUNCTION public.is_team_lead_of(uuid) RETURNS boolean LANGUAGE sql STABLE AS 'SELECT false';
      CREATE TABLE public.profiles(id uuid,full_name text);
      CREATE TABLE storage.objects(name text,bucket_id text,owner uuid DEFAULT auth.uid());
      GRANT SELECT,INSERT,DELETE ON storage.objects TO authenticated;
      ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    `);
    await sql.unsafe(readFileSync("drizzle/migrations/0006_refunds_module.sql", "utf8"));
    await sql.unsafe(readFileSync("drizzle/migrations/0007_refund_document_uploads.sql", "utf8"));
    await sql.unsafe(readFileSync("drizzle/migrations/0008_qualify_refund_storage_paths.sql", "utf8"));
    await sql`INSERT INTO public.profiles(id,full_name) VALUES(${own},'Fixture DO')`;
    await sql`INSERT INTO public.refunds(id,name,policy_no,do_name) VALUES(${refund},'Fixture','FIXTURE','Fixture DO')`;
    await sql`INSERT INTO public.refund_documents(refund_id,document_type,file_name,storage_path,uploaded_by) VALUES(${refund},'policy','test.pdf',${path},${own})`;
    await sql`INSERT INTO storage.objects(name,bucket_id,owner) VALUES(${path},'refund-documents',${other})`;
  });
  afterAll(async () => { await sql.end(); });
  const rollback = new Error("fixture rollback");
  async function asUser(user: string, run: (tx: postgres.TransactionSql) => Promise<void>) {
    try {
      await sql.begin(async tx => {
        await tx.unsafe("SET LOCAL ROLE authenticated");
        await tx`SELECT set_config('request.jwt.claim.sub',${user},true)`;
        await tx`SELECT set_config('request.jwt.claims',${JSON.stringify({ sub: user })},true)`;
        await run(tx);
        throw rollback;
      });
    } catch (e) { if (e !== rollback) throw e; }
  }
  it("normal users can read documents only for their own refund", async () => {
    await asUser(own, async tx => { expect(await tx`SELECT * FROM public.refund_documents`).toHaveLength(1); expect(await tx`SELECT * FROM storage.objects`).toHaveLength(1); });
    await asUser(other, async tx => { expect(await tx`SELECT * FROM public.refund_documents`).toHaveLength(0); expect(await tx`SELECT * FROM storage.objects`).toHaveLength(0); });
  });
  it("view-only users cannot upload even against their own refund", async () => {
    await expect(asUser(own, async tx => { await tx`INSERT INTO storage.objects(name,bucket_id) VALUES(${refund + '/policy/new.pdf'},'refund-documents')`; })).rejects.toMatchObject({ code: "42501" });
    await expect(asUser(own, async tx => { await tx`INSERT INTO public.refund_documents(refund_id,document_type,file_name,storage_path) VALUES(${refund},'policy','new.pdf',${refund + '/policy/new.pdf'})`; })).rejects.toMatchObject({ code: "42501" });
  });
  for (const [role, user] of [["admin", "00000000-0000-0000-0000-000000000001"], ["management", "00000000-0000-0000-0000-000000000002"]]) {
    it(`${role} can upload refusal letters and policies and read saved files`, async () => {
      await asUser(user, async tx => {
        for (const type of ["refusal_letter", "policy"]) {
          const newPath = `${refund}/${type}/new.pdf`;
          await tx`INSERT INTO storage.objects(name,bucket_id) VALUES(${newPath},'refund-documents')`;
          await tx`INSERT INTO public.refund_documents(refund_id,document_type,file_name,storage_path) VALUES(${refund},${type},'new.pdf',${newPath})`;
        }
        expect(await tx`SELECT * FROM public.refund_documents`).toHaveLength(3);
        expect(await tx`SELECT * FROM storage.objects`).toHaveLength(3);
      });
    });
  }
  it("an upload cannot point to a different refund", async () => {
    await expect(asUser("00000000-0000-0000-0000-000000000001", async tx => {
      await tx`INSERT INTO public.refund_documents(refund_id,document_type,file_name,storage_path) VALUES(${refund},'policy','wrong.pdf',${'10000000-0000-0000-0000-000000000002/policy/wrong.pdf'})`;
    })).rejects.toMatchObject({ code: "23514" });
  });
});