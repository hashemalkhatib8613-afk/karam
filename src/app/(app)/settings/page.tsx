import Link from "next/link";
import { requireUser } from "@/lib/auth";
import SettingsForm from "./SettingsForm";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { profile, user } = await requireUser();
  return (
    <>
      <header className="page-head"><p className="overline">Settings</p><h1 className="h1">Your corner</h1></header>
      <p className="caption">Signed in as {user.email}</p>
      <SettingsForm name={profile?.display_name ?? ""} reduceMotion={!!profile?.preferences?.reduce_motion} />
      <Link href="/auth/set-password" className="label">Change your password</Link>
      <section className="card stack" aria-label="Privacy">
        <h2 className="card-title">Privacy</h2>
        <p className="caption" style={{ fontSize: 15 }}>This is a private space. Only the two of you can sign in, nothing is public, and photos are shared through short-lived links.</p>
      </section>
    </>
  );
}
