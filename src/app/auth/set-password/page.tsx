import { requireUser } from "@/lib/auth";
import SetPasswordForm from "./SetPasswordForm";

export const metadata = { title: "Choose a password" };

export default async function SetPasswordPage() {
  await requireUser();
  return (
    <main id="main" className="center-page">
      <div className="card auth-card">
        <div style={{ textAlign: "center" }}>
          <h1 className="h2">Choose your password</h1>
          <p className="caption" style={{ marginTop: 6 }}>At least 10 characters. Use something only you would think of.</p>
        </div>
        <SetPasswordForm />
      </div>
    </main>
  );
}
