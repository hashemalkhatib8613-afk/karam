"use client";

import { useActionState } from "react";
import { setPassword } from "@/app/actions/auth";
import { Button, Icon, TextField } from "@/components/ui";

export default function SetPasswordForm() {
  const [state, action, pending] = useActionState(setPassword, undefined);
  return (
    <form action={action} className="stack">
      {state?.error && (
        <p className="err" role="alert">
          <Icon name="alert" size={18} />
          {state.error}
        </p>
      )}
      <TextField label="New password" name="password" type="password" autoComplete="new-password" required minLength={10} />
      <TextField label="Type it again" name="confirm" type="password" autoComplete="new-password" required minLength={10} />
      <Button type="submit" size="lg" full loading={pending}>Save and continue</Button>
    </form>
  );
}
