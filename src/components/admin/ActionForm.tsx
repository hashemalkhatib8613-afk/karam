"use client";

import { useActionState } from "react";
import { Button, Icon } from "@/components/ui";
import type { FormState } from "@/app/actions/auth";

/** A form bound to a server action with inline success/error messages and a sticky save bar. */
export default function ActionForm({
  action,
  children,
  submitLabel = "Save",
  className = "form",
  footer,
  icon,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  children: React.ReactNode;
  submitLabel?: string;
  className?: string;
  footer?: React.ReactNode;
  icon?: string;
}) {
  const [state, run, pending] = useActionState(action, undefined);
  return (
    <form action={run} className={className}>
      {state?.error && <p className="err" role="alert"><Icon name="alert" size={18} />{state.error}</p>}
      {state?.ok && <p className="ok" role="status">{state.ok}</p>}
      {children}
      <div className="form-bar">
        <Button type="submit" loading={pending} icon={icon}>{submitLabel}</Button>
        {footer}
      </div>
    </form>
  );
}
