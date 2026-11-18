"use client";

import { useActionState } from "react";
import { setUsername } from "@/app/actions/admin";

/** Small inline form: set or clear one person's username. */
export default function UsernameForm({ userId, username }: { userId: string; username: string | null }) {
  const [state, action, pending] = useActionState(setUsername, undefined);
  return (
    <form action={action} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <input type="hidden" name="user_id" value={userId} />
      <label className="os-sr" htmlFor={`un-${userId}`}>Username</label>
      <input
        id={`un-${userId}`}
        type="text"
        name="username"
        defaultValue={username ?? ""}
        placeholder="no username"
        maxLength={30}
        autoComplete="off"
        style={{ font: "400 15px var(--font-sans)", border: "1.5px solid var(--line-strong)", borderRadius: "var(--radius-md)", padding: "8px 12px", minHeight: 40, width: 150, background: "var(--surface)", color: "var(--ink)" }}
      />
      <button type="submit" className="os-btn os-btn--quiet os-btn--sm" disabled={pending}><span>{pending ? "Saving…" : "Save"}</span></button>
      {state?.error && <span role="alert" className="caption" style={{ color: "var(--danger)", flexBasis: "100%" }}>{state.error}</span>}
      {state?.ok && <span role="status" className="caption" style={{ flexBasis: "100%" }}>{state.ok}</span>}
    </form>
  );
}
