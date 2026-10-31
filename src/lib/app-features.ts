/**
 * Single Source of Truth for App Features & Sidebar Navigation.
 *
 * Reference: The Sidebar is divided into 3 sections:
 *  1. "السنتر" (Center Management)
 *  2. "الاختبارات" (Exams & PDF Tools)
 *  3. "الإعدادات" (Settings & Subscription)
 *
 * Any feature added to `APP_FEATURES_REGISTRY` automatically appears in:
 *  - The client's Sidebar (`src/components/Sidebar.tsx`) — filtered by the tenant's `enabledFeatures`
 *  - Super Admin's "Create New App" installer (`src/components/admin/CreateTenantModal.tsx`)
 *  - Super Admin's "Edit Subscription & Features" modal (`src/components/admin/EditSubscriptionModal.tsx`)
 *  - Route & access guard (`src/components/SubscriptionGuard.tsx`)
 *  - Client's "My Subscription" page (`src/app/my-subscription/page.tsx`)
 */

export type SidebarSectionTitle = "السنتر" | "الاختبارات" | "الإعدادات";

export type SubscriptionCategory = "سنتر" | "معلم" | "تجربة مجانية";

export interface AppFeatureDefinition {
  /** Unique feature identifier stored in tenant's `enabledFeatures` array */
  id: string;
  /** Display name in Sidebar and Super Admin modals */
  name: string;
  /** Route path in the Next.js app */
  href: string;
  /** Which of the 3 Sidebar sections this feature belongs to */
  section: SidebarSectionTitle;
  /** Short description shown in Super Admin feature installer & My Subscription page */
  description: string;
  /** Icon key mapped in UI components */
  iconName:
    | "Home"
    | "Users"
    | "UserCheck"
    | "QrCode"
    | "FileSpreadsheet"
    | "PenTool"
    | "FileText"
    | "FolderUp"
    | "Image"
    | "CreditCard"
    | "PlayCircle";
  /** Default inclusion in subscription presets */
  defaultFor: SubscriptionCategory[];
}

export const SIDEBAR_SECTIONS_ORDER: SidebarSectionTitle[] = [
  "السنتر",
  "الاختبارات",
  "الإعدادات",
];

export const APP_FEATURES_REGISTRY: AppFeatureDefinition[] = [
  // ─────────────────────── 1. قسم السنتر ───────────────────────
  {
    id: "dashboard",
    name: "الرئيسية",
    href: "/",
    section: "السنتر",
    description: "لوحة إحصائيات السنتر، التحصيل الشهري، ومتابعة الغياب اليومي",
    iconName: "Home",
    defaultFor: ["سنتر", "معلم", "تجربة مجانية"],
  },
  {
    id: "groups",
    name: "المجموعات الدراسية",
    href: "/groups",
    section: "السنتر",
    description: "إدارة المجموعات، المواعيد، المعلمين، والصفوف الدراسية",
    iconName: "Users",
    defaultFor: ["سنتر", "معلم", "تجربة مجانية"],
  },
  {
    id: "students",
    name: "الطلاب والحسابات",
    href: "/students",
    section: "السنتر",
    description: "سجلات الطلاب، المصروفات الشهرية، الغياب، ودرجات الاختبارات",
    iconName: "UserCheck",
    defaultFor: ["سنتر", "معلم", "تجربة مجانية"],
  },
  {
    id: "qr-printing",
    name: "طباعة رموز QR",
    href: "/qr-printing",
    section: "السنتر",
    description: "توليد وطباعة كروت الباركود للطلاب لتسجيل الحضور والدفع بالكاميرا",
    iconName: "QrCode",
    defaultFor: ["سنتر", "معلم", "تجربة مجانية"],
  },
  {
    id: "excel-sheets",
    name: "تصدير/استيراد Excel",
    href: "/excel-sheets",
    section: "السنتر",
    description: "استيراد وتصدير كشوف الطلاب والماليات وأرقام الهواتف بصيغة Excel",
    iconName: "FileSpreadsheet",
    defaultFor: ["سنتر", "معلم", "تجربة مجانية"],
  },

  // ─────────────────────── 2. قسم الاختبارات ───────────────────────
  {
    id: "exam-builder",
    name: "منشئ الاختبارات",
    href: "/exam-builder",
    section: "الاختبارات",
    description: "قص واستخراج الأسئلة تلقائياً وتنسيق أوراق الامتحانات الجاهزة للطباعة",
    iconName: "PenTool",
    defaultFor: ["سنتر", "معلم", "تجربة مجانية"],
  },
  {
    id: "created-exams",
    name: "الاختبارات المنشأة",
    href: "/created-exams",
    section: "الاختبارات",
    description: "أرشيف الامتحانات المحفوظة والنماذج المتعددة (أ - ب - ج)",
    iconName: "FileText",
    defaultFor: ["سنتر", "معلم", "تجربة مجانية"],
  },
  {
    id: "uploaded-files",
    name: "الملفات المرفوعة",
    href: "/uploaded-files",
    section: "الاختبارات",
    description: "مكتبة المذكرات والكتب وملفات الـ PDF المرفوعة على السحابة",
    iconName: "FolderUp",
    defaultFor: ["سنتر", "معلم", "تجربة مجانية"],
  },
  {
    id: "images-to-pdf",
    name: "تحويل الصور إلى PDF",
    href: "/images-to-pdf",
    section: "الاختبارات",
    description: "تجميع ودمج صور المذكرات والامتحانات في ملف PDF واحد عالي الدقة",
    iconName: "Image",
    defaultFor: ["سنتر", "معلم", "تجربة مجانية"],
  },

  // ─────────────────────── 3. قسم الإعدادات ───────────────────────
  {
    id: "my-subscription",
    name: "اشتراكي والباقة",
    href: "/my-subscription",
    section: "الإعدادات",
    description: "عرض تفاصيل الباقة، فترة الصلاحية، المميزات المثبتة، وسعة التخزين",
    iconName: "CreditCard",
    defaultFor: ["سنتر", "معلم", "تجربة مجانية"],
  },
  {
    id: "how-to-use",
    name: "كيفية الاستخدام",
    href: "/how-to-use",
    section: "الإعدادات",
    description: "فيديوهات شرح تفصيلية لاستخدام كل قسم وأداة في التطبيق خطوة بخطوة",
    iconName: "PlayCircle",
    defaultFor: ["سنتر", "معلم", "تجربة مجانية"],
  },
];

export const ALL_FEATURE_IDS: string[] = APP_FEATURES_REGISTRY.map((f) => f.id);

/**
 * Returns default feature IDs for a given subscription category ("سنتر" or "معلم").
 */
export function getDefaultFeaturesForCategory(category: SubscriptionCategory): string[] {
  return APP_FEATURES_REGISTRY.filter((f) => f.defaultFor.includes(category)).map((f) => f.id);
}

/**
 * Normalizes a tenant's enabledFeatures array.
 * If undefined/null (legacy tenant), returns all feature IDs so nothing breaks until customized.
 * Preserves only valid feature IDs from `APP_FEATURES_REGISTRY`.
 */
export function normalizeEnabledFeatures(features?: string[] | null): string[] {
  if (!Array.isArray(features) || features.length === 0) {
    return [...ALL_FEATURE_IDS];
  }
  const validSet = new Set(ALL_FEATURE_IDS);
  const filtered = features.filter((id) => validSet.has(id));
  if (filtered.length === 0) {
    return [...ALL_FEATURE_IDS];
  }
  if (!filtered.includes("how-to-use")) {
    filtered.push("how-to-use");
  }
  return filtered;
}

/**
 * Checks whether a given route pathname is allowed for the tenant's enabled features.
 */
export function isPathnameAllowedForFeatures(
  pathname: string,
  enabledFeatures?: string[] | null
): boolean {
  // Public / auth / system paths are always allowed at the feature level
  if (
    pathname === "/login" ||
    pathname === "/denied" ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/s/") ||
    pathname === "/s" ||
    pathname.startsWith("/api/")
  ) {
    return true;
  }

  const normalized = normalizeEnabledFeatures(enabledFeatures);
  const matchedFeature = APP_FEATURES_REGISTRY.find((f) =>
    f.href === "/" ? pathname === "/" : pathname === f.href || pathname.startsWith(`${f.href}/`)
  );

  if (!matchedFeature) {
    return true;
  }

  return normalized.includes(matchedFeature.id);
}

/**
 * Returns the primary landing route (`href`) for a tenant based on their installed features.
 */
export function getFirstAllowedRoute(enabledFeatures?: string[] | null): string {
  const normalized = normalizeEnabledFeatures(enabledFeatures);
  for (const feature of APP_FEATURES_REGISTRY) {
    if (normalized.includes(feature.id)) {
      return feature.href;
    }
  }
  return "/my-subscription";
}

