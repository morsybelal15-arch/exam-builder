import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { ArrowRight, AlertCircle } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { getFullStudentProfile, getGroups } from "@/lib/management-db";
import { generateQrDataUrl, getStudentQrUrl } from "@/lib/qr-service";
import StudentProfileClient from "./StudentProfileClient";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = getFullStudentProfile(id);
  if (!profile || !profile.student) {
    return { title: "ملف الطالب غير موجود" };
  }
  return {
    title: `ملف الطالب: ${profile.student.name} | السنتر`,
    description: `الملف الشخصي للطالب ${profile.student.name} - الحضور، الدرجات، والمصروفات.`,
  };
}

export default async function StudentProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSessionUser();
  if (!session || !session.id) {
    redirect("/login");
  }

  const { id } = await params;
  const profile = getFullStudentProfile(id);

  if (!profile || !profile.student) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center border border-slate-100 shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">الطالب غير موجود</h2>
          <p className="text-xs text-slate-500">
            لم يتم العثور على طالب بهذا المعرف، قد يكون تم حذفه أو نقله.
          </p>
          <Link
            href="/students"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            <ArrowRight className="w-4 h-4" />
            <span>العودة لقائمة الطلاب</span>
          </Link>
        </div>
      </div>
    );
  }

  const allGroups = getGroups();

  let baseUrl: string | undefined = undefined;
  try {
    const headerList = await headers();
    const host = headerList.get("host");
    const proto = headerList.get("x-forwarded-proto") || (host?.includes("localhost") ? "http" : "https");
    if (host) {
      baseUrl = `${proto}://${host}`;
    }
  } catch {
    // fallback to default
  }

  // Generate Smart QR Code Data URL
  const portalUrl = getStudentQrUrl(profile.student.code || profile.student.id, baseUrl);
  const qrDataUrl = await generateQrDataUrl(portalUrl, 260);

  return (
    <StudentProfileClient
      initialProfile={{
        ...profile,
        group: profile.group || null,
      }}
      allGroups={allGroups}
      qrDataUrl={qrDataUrl}
      portalUrl={portalUrl}
    />
  );
}
