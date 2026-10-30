import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getHomeAnalytics, getGroups } from "@/lib/management-db";
import { setCurrentTenantId } from "@/lib/tenant-context";
import HomeDashboardClient from "@/components/home/HomeDashboardClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "الرئيسية | منصة إدارة المركز والاختبارات",
  description: "لوحة التحكم الرئيسية: تسجيل الحضور السريع، تحصيل المصروفات، وإحصائيات الطلاب والمجموعات",
};

export default async function RootPage() {
  const session = await getSessionUser();

  if (!session || !session.id) {
    redirect("/login");
  }
  setCurrentTenantId(session.id);

  const analytics = getHomeAnalytics();
  const groups = getGroups();

  return <HomeDashboardClient initialData={analytics} groups={groups} />;
}
