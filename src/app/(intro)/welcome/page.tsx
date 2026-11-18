import { requireUser, getSettings } from "@/lib/auth";
import { fill, paragraphs, popNicknames, sharedDisplayName } from "@/lib/text";
import WelcomeFlow from "./WelcomeFlow";
import FallingBackground from "@/components/FallingBackground";

export const metadata = { title: "A letter for you" };

export default async function WelcomePage() {
  const { profile } = await requireUser();
  const s = await getSettings();
  const name = sharedDisplayName(s);
  const reduced = !!profile?.preferences?.reduce_motion || s?.motion === "reduced";
  const hintVersion = Number(s?.welcome_pop_hint_version ?? 1);
  const hintSeenVersion = Number(profile?.preferences?.welcome_pop_hint_version ?? 0);
  const hintFrequency = s?.welcome_pop_hint_frequency === "every_visit" ? "every_visit" : "once";
  const hintShowOn = ["arrival", "envelope_open", "letter_open"].includes(s?.welcome_pop_hint_show_on) ? s.welcome_pop_hint_show_on : "envelope_open";
  return (
    <main id="main" className="center-page" data-motion={reduced ? "reduced" : undefined}>
      <FallingBackground
        reduced={reduced}
        nicknames={s?.pop_nicknames}
        layer={s?.floating_icons_layer}
        quantity={s?.floating_icons_quantity}
      />
      <WelcomeFlow
        name={name}
        greeting={fill(s.greeting, name)}
        letter={paragraphs(fill(s.welcome_letter, name))}
        signature={s.welcome_signature}
        siteName={s.site_name}
        popHint={{
          show: !!s?.welcome_pop_hint_enabled && !reduced && (hintFrequency === "every_visit" || hintSeenVersion < hintVersion),
          showOn: hintShowOn,
          delaySeconds: Math.min(30, Math.max(0, Number(s?.welcome_pop_hint_delay_seconds ?? 1))),
          nicknames: popNicknames(s?.pop_nicknames),
          prompt: s?.welcome_pop_hint_prompt || "Psst… catch me before I disappear.",
          success: s?.welcome_pop_hint_success || "The little things here carry little surprises ♡",
          version: hintVersion,
        }}
      />
    </main>
  );
}
