import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

export default async function RootPage() {
  const session = await getSessionUser();

  if (!session || !session.id) {
    redirect("/login");
  }

  if (session.role === "SUPER_ADMIN") {
    redirect("/admin");
  }

  redirect("/exam-builder");
}
