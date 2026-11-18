"use client";

import { useEffect, useState, useTransition } from "react";
import { completeWelcomePopHint } from "@/app/actions/partner";

export default function WelcomePopHint({
  delaySeconds,
  nicknames,
  prompt,
  success,
  version,
}: {
  delaySeconds: number;
  nicknames: string[];
  prompt: string;
  success: string;
  version: number;
}) {
  const [visible, setVisible] = useState(delaySeconds <= 0);
  const [stage, setStage] = useState<"waiting" | "nickname" | "success" | "done">("waiting");
  const [nickname, setNickname] = useState("");
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (visible) return;
    const timer = window.setTimeout(() => setVisible(true), delaySeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [delaySeconds, visible]);

  useEffect(() => {
    if (stage !== "nickname" && stage !== "success") return;
    const timer = window.setTimeout(
      () => setStage(stage === "nickname" ? "success" : "done"),
      stage === "nickname" ? 1500 : 3200,
    );
    return () => window.clearTimeout(timer);
  }, [stage]);

  if (!visible || stage === "done") return null;

  function pop() {
    if (stage !== "waiting") return;
    const nextNickname = nicknames[Math.floor(Math.random() * nicknames.length)] ?? "";
    setNickname(nextNickname);
    setStage(nextNickname ? "nickname" : "success");
    startTransition(() => completeWelcomePopHint(version));
  }

  const message = stage === "waiting" ? prompt : stage === "nickname" ? nickname : success;
  return (
    <div className="welcome-pop-hint" data-stage={stage}>
      <button type="button" className="welcome-pop-hint__heart" onClick={pop} disabled={stage !== "waiting"} aria-label="Pop the paused heart">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
          <path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z" />
        </svg>
      </button>
      <p className="welcome-pop-hint__bubble" role="status" aria-live="polite">{message}</p>
    </div>
  );
}
