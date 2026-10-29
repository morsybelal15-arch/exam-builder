export interface Group {
  id: string;
  name: string;
  teacher: string;
  academicYear: string;
  subject: string;
  createdAt: number;
  updatedAt: number;
}

export type StudentStatus = "active" | "inactive";

export interface Student {
  id: string;
  code: string; // e.g. "ST-1001" or unique identifier for QR
  name: string;
  academicYear: string;
  groupId: string;
  groupName?: string;
  parentPhone: string;
  studentPhone: string;
  monthlyFee: number;
  status: StudentStatus;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  leftAt?: number;
}

export type PaymentStatus = "paid" | "unpaid" | "returned";

export interface FinancialRecord {
  id: string;
  studentId: string;
  groupId: string;
  month: string; // format "YYYY-MM", e.g. "2026-10"
  status: PaymentStatus;
  paidAmount: number; // e.g. 150 out of 200
  totalAmount: number; // e.g. 200
  updatedAt: number;
  notes?: string;
}

export type AttendanceStatus = "attended" | "absent";

export interface AttendanceRecord {
  id: string;
  studentId: string;
  groupId: string;
  date: string; // format "YYYY-MM-DD"
  status: AttendanceStatus;
  time?: string;
  method?: "camera_qr" | "manual";
}

export interface GroupClassSession {
  id: string;
  groupId: string;
  date: string; // format "YYYY-MM-DD"
  title?: string;
}

export interface ExamRecord {
  id: string;
  groupId: string;
  examName: string;
  totalScore: number;
  date: string;
  createdAt: number;
}

export interface StudentGradeRecord {
  id: string;
  examRecordId: string;
  studentId: string;
  score: number;
  notes?: string;
  method?: "camera_ai" | "manual";
  recordedAt: number;
}

export interface SavedQrPdf {
  id: string;
  title: string;
  groupName?: string;
  studentIds: string[];
  createdAt: number;
  pagesCount: number;
}
