"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, signInWithDate } from "@/app/actions/auth";
import { Button, Icon, TextField } from "@/components/ui";
import type { LoginMethod } from "@/lib/login-method";

export default function LoginForm({ method, adminOnly = false }: { method: LoginMethod; adminOnly?: boolean }) {
  const [pwState, pwAction, pwPending] = useActionState(signIn, undefined);
  const [dateState, dateAction, datePending] = useActionState(signInWithDate, undefined);
  const state = method === "date" ? dateState : pwState;

  return (
    <div className="stack">
      {state?.error && (
        <p className="err" role="alert">
          <Icon name="alert" size={18} />
          {state.error}
        </p>
      )}

      {method === "date" ? (
        <form key="date" action={dateAction} className="stack">
          <TextField label="Our special date" name="date" type="date" icon="calendar" required helper="The date only the two of us know." />
          <Button type="submit" size="lg" full loading={datePending} iconRight="chevron-right">Enter Our World</Button>
        </form>
      ) : (
        <form key={method} action={pwAction} className="stack" autoComplete={adminOnly ? "on" : "off"}>
          {adminOnly && <input type="hidden" name="admin_only" value="1" />}
          {method === "email" ? (
            <TextField label="Email" name="identifier" type="email" icon="envelope" autoComplete={adminOnly ? "section-admin username" : "off"} required placeholder="you@example.com" />
          ) : (
            <TextField label="Username" name="identifier" type="text" icon="heart" autoComplete="off" required placeholder="your username" maxLength={30} />
          )}
          <TextField label="Password" name="password" type="password" autoComplete={adminOnly ? "section-admin current-password" : "off"} required />
          <Button type="submit" size="lg" full loading={pwPending} iconRight="chevron-right">Enter Our World</Button>
          <Link href="/forgot-password" className="label" style={{ textAlign: "center", padding: 10 }}>Forgot your password?</Link>
        </form>
      )}
    </div>
  );
}
