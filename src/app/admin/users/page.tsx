import { requireAdmin, getSettings } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/admin";
import { fmtDateTime } from "@/lib/dates";
import { inviteUser, resetWelcome, saveDateLogin } from "@/app/actions/admin";
import ActionForm from "@/components/admin/ActionForm";
import ConfirmButton from "@/components/admin/ConfirmButton";
import UsernameForm from "@/components/admin/UsernameForm";

export const metadata = { title: "Accounts" };

export default async function UsersAdmin() {
  const { supabase } = await requireAdmin();
  const tz = (await getSettings())?.timezone || "UTC";
  const { data: profiles } = await supabase.from("profiles").select("id,display_name,username,role,onboarding_completed_at,created_at").order("created_at");

  // Emails live in auth.users, which only the service key can list. Only reached after requireAdmin().
  const emails = new Map<string, { email: string; last: string | null }>();
  let svcNote = "";
  try {
    const svc = createServiceClient();
    const { data } = await svc.auth.admin.listUsers({ page: 1, perPage: 50 });
    (data?.users ?? []).forEach((u) => emails.set(u.id, { email: u.email ?? "", last: u.last_sign_in_at ?? null }));
  } catch {
    svcNote = "Add SUPABASE_SERVICE_ROLE_KEY to your hosting settings to see email addresses, send invitations and use username or date sign-in.";
  }
  const partner = (profiles ?? []).find((p: any) => p.role === "partner") as any;
  const { data: dl } = await supabase.rpc("date_login_status");
  const status = Array.isArray(dl) ? dl[0] : dl;

  return (
    <>
      <header className="page-head" style={{ padding: 0 }}>
        <p className="overline">Accounts</p>
        <h1 className="h1">Who can sign in</h1>
      </header>
      <p className="caption" style={{ fontSize: 15, maxWidth: 620 }}>
        Only people you invite can sign in. Public sign-up is off, so nobody else can create an account. Choose the active login method in Site settings; manage usernames and the secret date here.
      </p>
      {svcNote && <p className="err" role="alert">{svcNote}</p>}

      <table className="adm-table">
        <thead><tr><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Username</th><th scope="col">Role</th><th scope="col">Last sign-in</th><th scope="col">Welcome</th></tr></thead>
        <tbody>
          {(profiles ?? []).map((p: any) => {
            const u = emails.get(p.id);
            return (
              <tr key={p.id}>
                <td data-label="Name">{p.display_name || "—"}</td>
                <td data-label="Email">{u?.email || "—"}</td>
                <td data-label="Username"><UsernameForm userId={p.id} username={p.username} /></td>
                <td data-label="Role">{p.role === "admin" ? "Admin" : "Partner"}</td>
                <td data-label="Last sign-in">{u?.last ? fmtDateTime(u.last, tz) : "Never"}</td>
                <td data-label="Welcome">
                  {p.role === "partner" ? (
                    <form action={resetWelcome}>
                      <input type="hidden" name="user_id" value={p.id} />
                      <span className="caption">{p.onboarding_completed_at ? "Seen" : "Not seen yet"} </span>
                      <ConfirmButton message="Show the envelope and welcome letter to her again?" icon="refresh" danger={false}>Show again</ConfirmButton>
                    </form>
                  ) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {!partner && (
        <section className="card stack" style={{ maxWidth: 720 }} aria-label="Invite">
          <h2 className="card-title">Invite her</h2>
          <p className="caption" style={{ fontSize: 15 }}>She gets an email with a link to choose her own password. The link works once.</p>
          <ActionForm action={inviteUser} submitLabel="Send invitation" icon="envelope">
            <div className="field"><label htmlFor="display_name">Her name</label><input id="display_name" type="text" name="display_name" maxLength={80} autoComplete="off" /></div>
            <div className="field"><label htmlFor="email">Her email</label><input id="email" type="text" inputMode="email" name="email" autoComplete="off" required /></div>
          </ActionForm>
        </section>
      )}

      <section className="card stack" style={{ maxWidth: 720 }} aria-label="Sign in with a date">
        <h2 className="card-title">Sign in with a date</h2>
        {!partner ? (
          <p className="caption" style={{ fontSize: 15 }}>Invite her first. Then you can choose the date that opens her account.</p>
        ) : (
          <>
            <p className="caption" style={{ fontSize: 15 }}>
              {status?.has_date ? "A date is saved." : "No date is saved yet."} Signing in with the date is <b>{status?.is_enabled ? "ON" : "OFF"}</b>.
              The date is stored scrambled and can't be shown again. If you forget it, just choose a new one.
            </p>
            <p className="caption" style={{ fontSize: 15 }}>
              <b>Think before turning this on.</b> A date is easier to guess than a password, so don't use one that is public or obvious. It can only open her account (never yours), it allows 5 wrong tries per visitor every 15 minutes and 20 per hour overall. After that, wait before trying again. To show this on the login page, choose Our date in Site settings.
            </p>
            <ActionForm action={saveDateLogin} submitLabel="Save date sign-in">
              <input type="hidden" name="user_id" value={partner.id} />
              <div className="field">
                <label htmlFor="date">Secret date</label>
                <input id="date" type="date" name="date" />
                <span className="help">Leave empty to keep the saved date.</span>
              </div>
              <label className="check"><input type="checkbox" name="enabled" defaultChecked={!!status?.is_enabled} />Let her sign in with just this date</label>
            </ActionForm>
          </>
        )}
      </section>
    </>
  );
}
