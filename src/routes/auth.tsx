import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Shield, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<"signin" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!loading && user) nav({ to: "/dashboard", replace: true }); }, [user, loading, nav]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setBusy(false); }
  };

  const forgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Reset link sent. Check your email.");
      setMode("signin");
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-md bg-sidebar-primary text-sidebar-primary-foreground grid place-items-center font-bold">IB</div>
          <div className="font-semibold text-lg">InsureBroker</div>
        </div>
        <div>
          <h2 className="text-3xl font-semibold leading-tight">Insurance brokerage,<br/>built for Pakistan.</h2>
          <p className="mt-4 text-sidebar-foreground/70 max-w-md">
            Clients, deals, pipeline, renewals, documents, income — one platform for your entire team.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-3 text-sm">
            {["Pipeline","Commissions","Renewals","Documents","Income","Analytics"].map(t => (
              <div key={t} className="rounded-md bg-sidebar-accent/60 px-3 py-2 text-sidebar-accent-foreground">{t}</div>
            ))}
          </div>
        </div>
        <div className="text-xs text-sidebar-foreground/60 flex items-center gap-2">
          <Shield className="w-3.5 h-3.5"/> Role-based access · Encrypted at rest · Admin-provisioned accounts
        </div>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {mode === "signin" ? (
            <>
              <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
              <p className="text-sm text-muted-foreground mt-1">Use the credentials provided by your administrator.</p>
              <form onSubmit={signIn} className="mt-6 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Work email</Label>
                  <Input id="email" type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} autoComplete="email"/>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <button type="button" onClick={()=>setMode("forgot")} className="text-xs text-primary hover:underline">Forgot password?</button>
                  </div>
                  <Input id="password" type="password" required value={password} onChange={(e)=>setPassword(e.target.value)} autoComplete="current-password"/>
                </div>
                <Button type="submit" disabled={busy} className="w-full">Sign in</Button>
              </form>
              <p className="text-xs text-muted-foreground mt-6 text-center">
                No self-signup. Contact your administrator to request access.
              </p>
            </>
          ) : (
            <>
              <button onClick={()=>setMode("signin")} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4">
                <ArrowLeft className="w-3.5 h-3.5"/> Back to sign in
              </button>
              <h1 className="text-2xl font-semibold tracking-tight">Reset password</h1>
              <p className="text-sm text-muted-foreground mt-1">Enter your email and we'll send you a reset link.</p>
              <form onSubmit={forgot} className="mt-6 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email2">Work email</Label>
                  <Input id="email2" type="email" required value={email} onChange={(e)=>setEmail(e.target.value)}/>
                </div>
                <Button type="submit" disabled={busy} className="w-full">Send reset link</Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
