"use client";

import { useEffect, useState, type CSSProperties, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import { popNicknames } from "@/lib/text";

const ICONS = ["heart", "flower", "chocolate", "bonbon", "strawberry"] as const;
const PARTICLE_COUNTS = { min: 12, medium: 24, max: 40 } as const;
type Icon = (typeof ICONS)[number];
export type FloatingIconLayer = "background" | "foreground";
export type FloatingIconQuantity = keyof typeof PARTICLE_COUNTS;
type Particle = ReturnType<typeof createParticle>;

function createParticle(initial = false, cycle = 0) {
  const duration = 30 + Math.random() * 24;
  return {
    icon: ICONS[Math.floor(Math.random() * ICONS.length)],
    left: 2 + Math.random() * 96,
    duration,
    delay: initial ? -Math.random() * duration : Math.random() * 5,
    drift: (Math.random() - 0.5) * 100,
    turn: (Math.random() - 0.5) * 240,
    cycle,
    popping: false,
    nickname: "",
    popX: 0,
    popY: 0,
  };
}

function ParticleIcon({ icon }: { icon: Icon }) {
  switch (icon) {
    case "heart":
      return <path d="M16 28 4.5 16.5C-3 9 7 0 13 6l3 3 3-3c6-6 16 3 8.5 10.5Z" />;
    case "flower":
      return <>
        {[0, 72, 144, 216, 288].map((angle) => (
          <ellipse key={angle} cx="16" cy="9" rx="5.5" ry="8" transform={`rotate(${angle} 16 16)`} />
        ))}
        <circle cx="16" cy="16" r="3.5" fill="#fff0f5" />
      </>;
    case "chocolate":
      return <>
        <rect x="6" y="2" width="20" height="28" rx="3" />
        <path d="M9 5h6v7H9zm8 0h6v7h-6zM9 14h6v7H9zm8 0h6v7h-6z" fill="#fff0f5" />
        <path d="m6 23 10-3 10 3v5a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2Z" />
      </>;
    case "bonbon":
      return <>
        <path d="m10 12-8-5v18l8-5zm12 0 8-5v18l-8-5Z" />
        <rect x="8" y="7" width="16" height="18" rx="7" />
        <path d="m13 10 6 12m-2-12 4 8" fill="none" stroke="#fff0f5" strokeWidth="2" strokeLinecap="round" />
      </>;
    case "strawberry":
      return <>
        <path d="M16 9C8 3 2 10 4 17c2 7 9 13 12 13s10-6 12-13C30 10 24 3 16 9Z" />
        <path d="m16 10-8-5 6 1 2-5 2 5 6-1Z" />
        <path d="m10 13 1 2m10-2-1 2m-5 2 1 2m-8-1 1 2m14-2-1 2m-9 3 1 2m5-2-1 2" fill="none" stroke="#fff0f5" strokeWidth="1.8" strokeLinecap="round" />
      </>;
  }
}

/** Decorative only. CMS motion and the visitor's preference both take precedence. */
export default function FallingBackground({
  reduced = false,
  nicknames = [],
  layer = "background",
  quantity = "medium",
}: {
  reduced?: boolean;
  nicknames?: string[];
  layer?: FloatingIconLayer;
  quantity?: FloatingIconQuantity;
}) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const names = popNicknames(nicknames);
  const particleCount = PARTICLE_COUNTS[quantity] ?? PARTICLE_COUNTS.medium;

  // Generate after hydration so server and client markup match. Each new fall gets
  // a fresh position, icon, speed, pause, and drift instead of repeating a loop.
  useEffect(() => {
    setParticles(reduced ? [] : Array.from({ length: particleCount }, () => createParticle(true)));
  }, [reduced, particleCount]);

  function popParticle(index: number, event: SyntheticEvent<HTMLButtonElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const nickname = names[Math.floor(Math.random() * names.length)] ?? "";
    setParticles((current) => current.map((particle, i) => (
      i === index && !particle.popping ? {
        ...particle, popping: true, nickname,
        popX: bounds.left + bounds.width / 2,
        popY: bounds.top + bounds.height / 2,
      } : particle
    )));
  }

  function recycle(index: number, cycle: number) {
    setParticles((current) => current.map((item, i) => (
      i === index && item.cycle === cycle ? createParticle(false, cycle + 1) : item
    )));
  }

  if (reduced) return null;

  return (
    <div className="falling-background" data-layer={layer === "foreground" ? "foreground" : "background"} data-quantity={quantity}>
      {particles.map((particle, i) => (
        <button
          key={`${i}-${particle.cycle}`}
          type="button"
          tabIndex={-1}
          aria-label={`Pop ${particle.icon}`}
          onPointerDown={(event) => {
            if (!event.isPrimary || event.button !== 0) return;
            // Keep touch scrolling and pinch gestures available on mobile.
            if (event.pointerType === "mouse") event.preventDefault();
            popParticle(i, event);
          }}
          onClick={(event) => popParticle(i, event)}
          className="falling-background__particle"
          data-popping={particle.popping}
          onAnimationEnd={(event) => {
            if (event.animationName !== "background-fall" && event.animationName !== "background-pop") return;
            if (event.animationName === "background-pop" && particle.nickname) return;
            recycle(i, particle.cycle);
          }}
          style={{
            left: `${particle.left}%`,
            "--fall-duration": `${particle.duration}s`,
            "--fall-delay": `${particle.delay}s`,
            "--fall-drift": `${particle.drift}px`,
            "--fall-turn": `${particle.turn}deg`,
          } as CSSProperties}
        >
          <span className="falling-background__icon">
            <svg viewBox="0 0 32 32" fill="currentColor" focusable="false" aria-hidden="true">
              <ParticleIcon icon={particle.icon} />
            </svg>
          </span>
        </button>
      ))}
      {particles.length > 0 && createPortal(<div className="falling-background__nicknames" aria-live="polite" aria-atomic="false">
        {particles.map((particle, i) => particle.popping && particle.nickname ? (
          <span
            key={`${i}-${particle.cycle}`}
            className="falling-background__nickname"
            style={{ "--pop-x": `${particle.popX}px`, "--pop-y": `${particle.popY}px` } as CSSProperties}
            onAnimationEnd={(event) => {
              if (event.animationName === "background-nickname") recycle(i, particle.cycle);
            }}
          >{particle.nickname}</span>
        ) : null)}
      </div>, document.body)}
    </div>
  );
}
