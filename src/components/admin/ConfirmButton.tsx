"use client";

import { Icon } from "@/components/ui";

/** Submit button that asks first. The server action still re-checks everything. */
export default function ConfirmButton({ message, children, icon = "trash", danger = true, small = true }: { message: string; children: React.ReactNode; icon?: string; danger?: boolean; small?: boolean }) {
  return (
    <button
      type="submit"
      className={`os-btn ${danger ? "os-btn--danger" : "os-btn--quiet"} ${small ? "os-btn--sm" : "os-btn--md"}`}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      <Icon name={icon} size={18} />
      <span>{children}</span>
    </button>
  );
}
