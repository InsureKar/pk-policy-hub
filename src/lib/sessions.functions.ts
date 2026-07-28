import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: any) {
  const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId, _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!isAdmin) throw new Error("Only Super Admins can manage sessions");
}

export const listAllSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // List all users (first page up to 200) and their sessions
    const { data: users, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) throw new Error(error.message);

    const results: any[] = [];
    for (const u of users.users) {
      // @ts-ignore - listUserSessions available on GoTrue admin
      const res = await (supabaseAdmin.auth.admin as any).listUserSessions?.(u.id);
      const sessions = res?.data?.sessions ?? res?.sessions ?? [];
      for (const s of sessions) {
        results.push({
          session_id: s.id,
          user_id: u.id,
          email: u.email,
          user_agent: s.user_agent ?? null,
          ip: s.ip ?? null,
          created_at: s.created_at ?? null,
          updated_at: s.updated_at ?? null,
          not_after: s.not_after ?? null,
        });
      }
    }
    return { sessions: results };
  });

export const revokeUserSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ user_id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.signOut(data.user_id as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
