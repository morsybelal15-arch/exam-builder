import { NextRequest, NextResponse } from "next/server";
import { getLocalExams, getLocalExamById, saveLocalExam, deleteLocalExam } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (id) {
      const exam = getLocalExamById(id);
      if (!exam) {
        return NextResponse.json({ error: "Exam not found" }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        exam: {
          ...exam,
          questions: JSON.parse(exam.questions || "[]"),
        },
      });
    }

    const exams = getLocalExams();
    const formatted = exams.map((e: any) => ({
      ...e,
      questions: JSON.parse(e.questions || "[]"),
    }));
    return NextResponse.json({ success: true, exams: formatted });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      id,
      title,
      paper_title,
      paperTitle,
      exam_code,
      examCode,
      subject,
      grade,
      duration,
      questions,
      questionsCount,
      questions_count,
      totalPoints,
      total_points,
      dateCreated,
      date_created,
    } = body;

    saveLocalExam({
      id: id || `exam-${Date.now()}`,
      title: title || "اختبار جديد",
      paper_title: paper_title ?? paperTitle,
      exam_code: exam_code ?? examCode,
      subject: subject || "عام",
      grade: grade || "مستوى عام",
      duration: duration || "ساعتان",
      questions: typeof questions === "string" ? questions : JSON.stringify(questions || []),
      questions_count: questions_count ?? questionsCount ?? (Array.isArray(questions) ? questions.length : 0),
      total_points: total_points ?? totalPoints ?? 20,
      date_created: date_created ?? dateCreated ?? "اليوم",
    });

    return NextResponse.json({ success: true, message: "تم حفظ الاختبار بنجاح في قاعدة البيانات المحلية." });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing exam ID" }, { status: 400 });
    }
    deleteLocalExam(id);
    return NextResponse.json({ success: true, message: "تم حذف الاختبار من قاعدة البيانات." });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
