import { requireAdmin } from "@/lib/auth";
import BucketList from "@/components/BucketList";
export const metadata = { title: "Bucket list" };
export default async function AdminBucketList() {
  await requireAdmin();
  return <BucketList />;
}
