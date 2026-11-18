"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { completeOnboarding } from "@/app/actions/partner";
import { Button, Envelope, Letter } from "@/components/ui";
import WelcomePopHint from "./WelcomePopHint";

export type WelcomePopHintSettings = {
  show: boolean;
  showOn: "arrival" | "envelope_open" | "letter_open";
  delaySeconds: number;
  nicknames: string[];
  prompt: string;
  success: string;
  version: number;
};

export default function WelcomeFlow({ name, greeting, letter, signature, popHint }: { name: string; greeting: string; letter: string[]; signature: string; siteName: string; popHint: WelcomePopHintSettings }) {
  const [state, setState] = useState<"sealed" | "opening" | "ready" | "open">("sealed");
  const [pending, start] = useTransition();
  const letterRef = useRef<HTMLDivElement>(null);
  const readRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (state === "ready") readRef.current?.focus();
    if (state === "open") letterRef.current?.focus();
  }, [state]);

  const open = () => setState((current) => current === "sealed" ? "opening" : current);
  const finish = (next: "/story" | "/") => start(() => completeOnboarding(next));
  const hintMoment = popHint.showOn === "arrival" ? state !== "opening" : popHint.showOn === "envelope_open" ? state === "ready" || state === "open" : state === "open";
  const hint = popHint.show && hintMoment ? <WelcomePopHint delaySeconds={popHint.delaySeconds} nicknames={popHint.nicknames} prompt={popHint.prompt} success={popHint.success} version={popHint.version} /> : null;

  if (state !== "open") {
    return (
      <div className="stack-lg welcome-flow" style={{ width: "min(100%, 380px)", textAlign: "center" }}>
        {hint}
        <div>
          <p className="overline">A letter has arrived</p>
          <h1 className="display" style={{ fontSize: 40, marginTop: 8 }}>Hi, {name}</h1>
        </div>
        <Envelope state={state === "ready" ? "open" : state} greeting={greeting} onOpen={open} onOpened={() => setState("ready")} />
        {state === "ready" && (
          <button ref={readRef} type="button" className="os-btn os-btn--primary os-btn--lg os-btn--full" onClick={() => setState("open")}>
            Read your letter
          </button>
        )}
        <Button variant="ghost" onClick={() => finish("/")} loading={pending}>Skip for now</Button>
      </div>
    );
  }
  return (
    <div className="stack-lg welcome-flow" style={{ width: "min(100%, 460px)" }}>
      {hint}
      <div className="welcome-letter" ref={letterRef} tabIndex={-1} style={{ outline: "none" }}>
        <Letter to={greeting} signature={signature} date={undefined} locked={false}>
          {letter.map((p, i) => <p key={i}>{p}</p>)}
        </Letter>
      </div>
      <div className="stack" style={{ gap: 8 }}>
        <Button size="lg" full onClick={() => finish("/story")} loading={pending}>Start Our Story</Button>
        <Button variant="ghost" full onClick={() => finish("/")} disabled={pending}>Skip for now</Button>
      </div>
    </div>
  );
}
