"use client";

import { useActionState } from "react";
import { updateProfile } from "@/app/actions/partner";
import { Button, TextField, Toggle } from "@/components/ui";

export default function SettingsForm({ name, reduceMotion }: { name: string; reduceMotion: boolean }) {
  const [state, action, pending] = useActionState(updateProfile, undefined);
  return (
    <form action={action} className="stack">
      {state?.ok && <p className="ok" role="status">{state.ok}</p>}
      {state?.error && <p className="err" role="alert">{state.error}</p>}
      <TextField label="Display name" name="display_name" defaultValue={name} maxLength={80} autoComplete="given-name" />
      <label className="check"><input type="checkbox" name="reduce_motion" defaultChecked={reduceMotion} />Reduce motion and animations</label>
      <Button type="submit" loading={pending}>Save</Button>
    </form>
  );
}
