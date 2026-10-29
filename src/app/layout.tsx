import type { Metadata } from "next";
import Sidebar from "@/components/Sidebar";
import TopHeaderBar from "@/components/TopHeaderBar";
import SubscriptionGuard from "@/components/SubscriptionGuard";
import GsapAnimationProvider from "@/components/GsapAnimationProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "منصة إعداد الاختبارات",
  description: "نظام متكامل للمعلمين لإعداد الاختبارات وإدارة الملفات والمستندات",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className="h-screen w-screen overflow-hidden bg-[#F4F6FA] text-slate-800 antialiased flex flex-row print:block print:h-auto print:w-full print:overflow-visible print:m-0 print:p-0"
      >
        <SubscriptionGuard />
        <GsapAnimationProvider />
        <Sidebar />
        <main className="flex-1 h-screen overflow-hidden flex flex-col print:block print:h-auto print:w-full print:overflow-visible print:m-0 print:p-0">
          <TopHeaderBar />
          {children}
        </main>
      </body>
    </html>
  );
}
