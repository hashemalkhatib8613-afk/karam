"use client";

import { useActionState } from "react";
import { unlockNote } from "@/app/actions/partner";
import { Button, Icon, TextField } from "@/components/ui";

export default function ClueForm({ id, clue }: { id: string; clue?: string | null }) {
  const [state, action, pending] = useActionState(unlockNote, undefined);
  return (
    <form action={action} className="stack" style={{ width: "100%", textAlign: "start" }}>
      <input type="hidden" name="id" value={id} />
      {clue && <p className="hand" style={{ textAlign: "center" }}>{clue}</p>}
      {state?.error && <p className="err" role="alert"><Icon name="alert" size={18} />{state.error}</p>}
      <TextField label="Your answer" name="answer" autoComplete="off" required maxLength={200} />
      <Button type="submit" loading={pending} icon="unlock">Open this letter</Button>
    </form>
  );
}
