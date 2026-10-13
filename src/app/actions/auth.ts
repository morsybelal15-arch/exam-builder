"use server";

import { redirect } from "next/navigation";
import { clearSessionCookie } from "@/lib/auth";

// Login is handled exclusively by POST /api/auth/login (see src/app/api/auth/login/route.ts),
// which enforces the per-domain (admin vs tenant) rules and brute-force throttling.

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}
