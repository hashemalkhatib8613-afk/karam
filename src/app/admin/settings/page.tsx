import { requireAdmin } from "@/lib/auth";
import { loadPickerAssets } from "@/lib/picker";
import { saveSettings } from "@/app/actions/admin";
import ActionForm from "@/components/admin/ActionForm";
import MediaPicker from "@/components/admin/MediaPicker";
import { loginMethod } from "@/lib/login-method";
import { sharedDisplayName, popNicknames } from "@/lib/text";

export const metadata = { title: "Site settings" };

const THEMES: [string, string, string][] = [
  ["soft-romantic", "Soft Romantic", "Warm blush and cream. The default."],
  ["midnight-love", "Midnight Love", "Deep navy with golden light, easy on the eyes at night."],
  ["vintage-memories", "Vintage Memories", "Sepia paper and old-letter tones."],
  ["modern-minimal", "Modern Minimal", "Clean white with one quiet accent."],
];
const SECTIONS: Record<string, string> = {
  hero: "Welcome card with your photo",
  counter: "Days together counter",
  song: "Our song",
  note: "Latest note",
  album: "Featured album",
  chapter: "Featured story chapter",
};

export default async function SettingsAdmin() {
  const { supabase } = await requireAdmin();
  const { data: s } = await supabase.from("site_settings").select("*").eq("id", 1).single();
  const images = (await loadPickerAssets(supabase)).filter((a) => a.kind === "image" || a.kind === "video");
  const order: { key: string; on: boolean }[] = Array.isArray(s?.home_sections) ? s.home_sections : [];
  const keys = Object.keys(SECTIONS);
  const sections = [...order.filter((o) => keys.includes(o.key)), ...keys.filter((k) => !order.some((o) => o.key === k)).map((k) => ({ key: k, on: true }))];
  const ff = s?.feature_flags ?? {};

  return (
    <>
      <header className="page-head" style={{ padding: 0 }}>
        <p className="overline">Settings</p>
        <h1 className="h1">Site settings</h1>
      </header>

      <ActionForm action={saveSettings} submitLabel="Save settings">
        <fieldset className="card stack" style={{ margin: 0 }}>
          <legend className="lbl" style={{ padding: "0 6px" }}>Sign-in</legend>
          <div className="field">
            <label htmlFor="login_method">Active login method</label>
            <select id="login_method" name="login_method" defaultValue={loginMethod(s?.login_method)}>
              <option value="email">Email and password</option>
              <option value="username">Username and password</option>
              <option value="date">Our date</option>
            </select>
            <span className="help">Only this method appears on the login page. Set usernames or enable a secret date in Accounts first. Admins can always use /login/admin with their email and password.</span>
          </div>
        </fieldset>

        <fieldset className="card stack" style={{ margin: 0 }}>
          <legend className="lbl" style={{ padding: "0 6px" }}>Words on the site</legend>
          <div className="field">
            <label htmlFor="shared_display_name">Display name for everyone</label>
            <input id="shared_display_name" type="text" name="shared_display_name" defaultValue={sharedDisplayName(s)} maxLength={80} required aria-describedby="shared-display-name-help" />
            <span id="shared-display-name-help" className="help">Everyone sees “Hi, [name]” with this name. Also used for [HER_NAME] in site text and letters. Leave it as session to show “Hi, session”.</span>
          </div>
          <div className="field"><label htmlFor="site_name">Site name</label><input id="site_name" type="text" name="site_name" defaultValue={s?.site_name} maxLength={60} /></div>
          <div className="field"><label htmlFor="tagline">Tagline</label><input id="tagline" type="text" name="tagline" defaultValue={s?.tagline} maxLength={400} /></div>
          <div className="field"><label htmlFor="login_headline">Sign-in headline</label><input id="login_headline" type="text" name="login_headline" defaultValue={s?.login_headline} maxLength={400} /></div>
          <div className="field"><label htmlFor="login_subtitle">Sign-in line under it</label><input id="login_subtitle" type="text" name="login_subtitle" defaultValue={s?.login_subtitle} maxLength={400} /></div>
          <div className="field">
            <label htmlFor="greeting">Greeting on the envelope</label>
            <input id="greeting" type="text" name="greeting" defaultValue={s?.greeting} maxLength={400} />
            <span className="help">Write [HER_NAME] where the shared display name above should appear.</span>
          </div>
          <div className="field"><label htmlFor="home_headline">Home headline</label><input id="home_headline" type="text" name="home_headline" defaultValue={s?.home_headline} maxLength={400} /></div>
          <div className="field"><label htmlFor="home_subtitle">Home line under it</label><input id="home_subtitle" type="text" name="home_subtitle" defaultValue={s?.home_subtitle} maxLength={400} /></div>
          <div className="field">
            <label htmlFor="welcome_letter">Welcome letter</label>
            <textarea id="welcome_letter" name="welcome_letter" rows={8} defaultValue={s?.welcome_letter} maxLength={8000} />
            <span className="help">She sees this the first time she signs in, after the envelope opens. A blank line starts a new paragraph.</span>
          </div>
          <div className="field"><label htmlFor="welcome_signature">Sign-off</label><input id="welcome_signature" type="text" name="welcome_signature" defaultValue={s?.welcome_signature} maxLength={80} /></div>
          <label className="check"><input type="checkbox" name="replay_welcome" />Show the envelope and welcome letter to her again next time she signs in</label>
        </fieldset>

        <fieldset className="card stack" style={{ margin: 0 }}>
          <legend className="lbl" style={{ padding: "0 6px" }}>Our dates</legend>
          <div className="field">
            <label htmlFor="relationship_start_date">The day it began</label>
            <input id="relationship_start_date" type="date" name="relationship_start_date" defaultValue={s?.relationship_start_date ?? ""} />
            <span className="help">Used for the days-together counter and anniversaries. Leave empty to hide them.</span>
          </div>
          <div className="field">
            <label htmlFor="timezone">Time zone</label>
            <input id="timezone" type="text" name="timezone" defaultValue={s?.timezone} maxLength={60} />
            <span className="help">A name like Asia/Amman or Europe/London. Scheduled notes and chapters use it.</span>
          </div>
        </fieldset>

        <fieldset className="card stack" style={{ margin: 0 }}>
          <legend className="lbl" style={{ padding: "0 6px" }}>Look and feel</legend>
          <div className="seg" role="radiogroup" aria-label="Theme">
            {THEMES.map(([id, name, desc]) => (
              <label key={id} className="card" style={{ flex: "1 1 200px", cursor: "pointer", padding: 14, background: "var(--canvas)", color: "var(--ink)" }} data-theme={id}>
                <span className="check" style={{ minHeight: 0 }}>
                  <input type="radio" name="theme" value={id} defaultChecked={s?.theme === id} />
                  <b>{name}</b>
                </span>
                <span className="os-theme__chips" aria-hidden="true" style={{ display: "flex", gap: 4, margin: "8px 0" }}>
                  {["--canvas", "--surface-tint", "--petal", "--accent", "--ink"].map((v) => <i key={v} style={{ background: `var(${v})`, width: 22, height: 22, borderRadius: 99, border: "1px solid var(--line)" }} />)}
                </span>
                <span className="caption">{desc}</span>
              </label>
            ))}
          </div>
          <div className="field">
            <label htmlFor="motion">Animations</label>
            <select id="motion" name="motion" defaultValue={s?.motion ?? "full"}>
              <option value="full">Full: slowly falling baby-pink flowers and hearts</option>
              <option value="reduced">Reduced: no moving decoration</option>
            </select>
            <span className="help">Controls the background on the home, story, gallery, notes, music, and welcome pages. Her device or personal reduced-motion setting can also turn it off.</span>
          </div>
          <div className="field">
            <label htmlFor="floating_icons_layer">Floating icon position</label>
            <select id="floating_icons_layer" name="floating_icons_layer" defaultValue={s?.floating_icons_layer ?? "background"}>
              <option value="background">Behind cards and content</option>
              <option value="foreground">In front of cards and content</option>
            </select>
            <span className="help">Choose whether the falling icons pass behind the site or float visibly over cards and content. Icons remain clickable in either position.</span>
          </div>
          <div className="field">
            <label htmlFor="floating_icons_quantity">Floating icon quantity</label>
            <select id="floating_icons_quantity" name="floating_icons_quantity" defaultValue={s?.floating_icons_quantity ?? "medium"}>
              <option value="min">Minimum</option>
              <option value="medium">Medium</option>
              <option value="max">Maximum</option>
            </select>
            <span className="help">Controls how many icons fall at once. Medium matches the current amount.</span>
          </div>
          <div className="field">
            <label htmlFor="pop_nicknames">Nicknames when icons pop</label>
            <textarea id="pop_nicknames" name="pop_nicknames" rows={5} defaultValue={popNicknames(s?.pop_nicknames).join("\n")} maxLength={1600} aria-describedby="pop-nicknames-help" />
            <span id="pop-nicknames-help" className="help">Enter one nickname per line, up to 30 names of 50 characters each. Each click or tap reveals a random nickname. These also appear on the sign-in pages. Leave blank to pop icons without text.</span>
          </div>
          <fieldset className="card stack" style={{ margin: 0, background: "var(--canvas)" }}>
            <legend className="lbl" style={{ padding: "0 6px" }}>Pop-the-heart welcome hint</legend>
            <label className="check"><input type="checkbox" name="welcome_pop_hint_enabled" defaultChecked={!!s?.welcome_pop_hint_enabled} />Show a paused heart that teaches her to pop the falling icons</label>
            <div className="field">
              <label htmlFor="welcome_pop_hint_show_on">When it appears</label>
              <select id="welcome_pop_hint_show_on" name="welcome_pop_hint_show_on" defaultValue={s?.welcome_pop_hint_show_on ?? "envelope_open"}>
                <option value="arrival">As soon as the welcome page appears</option>
                <option value="envelope_open">After the envelope opens (recommended)</option>
                <option value="letter_open">While she is reading the letter</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="welcome_pop_hint_frequency">How often it appears</label>
              <select id="welcome_pop_hint_frequency" name="welcome_pop_hint_frequency" defaultValue={s?.welcome_pop_hint_frequency ?? "once"}>
                <option value="once">Until she pops it once</option>
                <option value="every_visit">Every time the welcome page is opened</option>
              </select>
              <span className="help">“Once” is remembered on her account, not only on the current device.</span>
            </div>
            <div className="field">
              <label htmlFor="welcome_pop_hint_delay_seconds">Delay before showing</label>
              <input id="welcome_pop_hint_delay_seconds" type="number" name="welcome_pop_hint_delay_seconds" min={0} max={30} defaultValue={s?.welcome_pop_hint_delay_seconds ?? 1} />
              <span className="help">Seconds after the selected welcome moment, from 0 to 30.</span>
            </div>
            <div className="field">
              <label htmlFor="welcome_pop_hint_prompt">Message beside the heart</label>
              <input id="welcome_pop_hint_prompt" type="text" name="welcome_pop_hint_prompt" defaultValue={s?.welcome_pop_hint_prompt ?? "Psst… catch me before I disappear."} maxLength={160} />
            </div>
            <div className="field">
              <label htmlFor="welcome_pop_hint_success">Message after the nickname</label>
              <input id="welcome_pop_hint_success" type="text" name="welcome_pop_hint_success" defaultValue={s?.welcome_pop_hint_success ?? "The little things here carry little surprises ♡"} maxLength={200} />
            </div>
            <label className="check"><input type="checkbox" name="replay_welcome_pop_hint" />Show the hint to her again, even if she already popped it</label>
          </fieldset>
          <div className="field">
            <label className="check"><input type="checkbox" name="ff_polaroid" defaultChecked={ff.polaroid !== false} aria-describedby="polaroid-help" />Polaroid photo borders</label>
            <span id="polaroid-help" className="help">Add a white border with a wider bottom edge to photos throughout the site, including the photo viewer. Photos always show in full, whether borders are on or off.</span>
          </div>
          <MediaPicker name="hero_asset_id" label="Home photo or video" items={images} initial={s?.hero_asset_id ? [s.hero_asset_id] : []} help="Shown on the welcome card at the top of Home." />
        </fieldset>

        <fieldset className="card stack" style={{ margin: 0 }}>
          <legend className="lbl" style={{ padding: "0 6px" }}>Home page sections</legend>
          <p className="caption" style={{ fontSize: 15 }}>Untick to hide a section. The number sets the order, smallest first.</p>
          <ul className="stack">
            {sections.map((sec, i) => (
              <li key={sec.key} className="seg" style={{ alignItems: "center", justifyContent: "space-between" }}>
                <label className="check"><input type="checkbox" name={`sec_${sec.key}`} defaultChecked={sec.on} />{SECTIONS[sec.key]}</label>
                <span className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <label htmlFor={`ord_${sec.key}`} className="caption">Order</label>
                  <input id={`ord_${sec.key}`} type="number" name={`ord_${sec.key}`} defaultValue={i + 1} style={{ width: 84 }} />
                </span>
              </li>
            ))}
          </ul>
        </fieldset>

        <fieldset className="card stack" style={{ margin: 0 }}>
          <legend className="lbl" style={{ padding: "0 6px" }}>Extras</legend>
          <label className="check"><input type="checkbox" name="ff_replies" defaultChecked={!!ff.replies} />Let her reply to notes</label>
          <p className="help">She can reply after opening a letter. Read her replies in the note editor or on the letter page.</p>
          <label className="check"><input type="checkbox" name="ff_bucket_list" defaultChecked={!!ff.bucket_list} />Show a shared bucket list</label>
          <p className="help">Add dreams and mark them completed in <a href="/admin/bucket-list">Bucket list</a>. You can both see the list under More.</p>
          <label className="check"><input type="checkbox" name="ff_downloads" defaultChecked={!!ff.downloads} />Let her download photos</label>
          <p className="help">Adds a download link to photos and the full-screen photo viewer.</p>
        </fieldset>
      </ActionForm>
    </>
  );
}
