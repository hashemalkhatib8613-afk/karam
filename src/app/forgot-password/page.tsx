"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestReset } from "@/app/actions/auth";
import { Button, TextField, Wordmark } from "@/components/ui";

export default function ForgotPassword() {
  const [state, action, pending] = useActionState(requestReset, undefined);
  return (
    <main id="main" className="center-page">
      <div className="card auth-card">
        <div style={{ textAlign: "center" }}><Wordmark size="lg" /></div>
        <div style={{ textAlign: "center" }}>
          <h1 className="h2">Reset your password</h1>
          <p className="caption" style={{ marginTop: 6 }}>Enter your email and we'll send a link.</p>
        </div>
        {state?.ok && <p className="ok" role="status">{state.ok}</p>}
        <form action={action} className="stack">
          <TextField label="Email" name="email" type="email" icon="envelope" autoComplete="email" required />
          <Button type="submit" size="lg" full loading={pending}>Send reset link</Button>
        </form>
        <Link href="/login" className="label" style={{ textAlign: "center", padding: 10 }}>Back to sign in</Link>
      </div>
    </main>
  );
}
