import { requireAdmin } from "@/lib/auth";
import AdminNav from "@/components/admin/AdminNav";
import { Icon } from "@/components/ui";

export const metadata = { title: { default: "Admin", template: "%s · Admin" } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="adm">
      <details className="adm__mobilebar">
        <summary>
          <Icon name="menu" size={22} />
          <span>Admin menu</span>
          <Icon name="chevron-down" size={18} className="adm__mobilechevron" />
        </summary>
        <AdminNav label="Admin (mobile)" mobile />
      </details>
      <AdminNav />
      <main id="main" className="adm__main">{children}</main>
    </div>
  );
}
