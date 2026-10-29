import { NextRequest, NextResponse } from "next/server";
import { getLocalExams, getLocalExamById, saveLocalExam, deleteLocalExam } from "@/lib/db";
import { requireApiSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await requireApiSession();
    if (!session) {
      return NextResponse.json({ error: "غير مصرح لك بالوصول" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (id) {
      const exam = getLocalExamById(id, session.id);
      if (!exam) {
        return NextResponse.json({ error: "Exam not found" }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        exam: {
          ...exam,
          questions: JSON.parse(exam.questions || "[]"),
          models: exam.models ? JSON.parse(exam.models) : null,
          extraData: exam.extra_data ? JSON.parse(exam.extra_data) : null,
        },
      });
    }

    const exams = getLocalExams(session.id);
    const full = searchParams.get("full") === "1" || searchParams.get("full") === "true";

    const formatted = exams.map((e: any) => {
      const parsedQuestions = JSON.parse(e.questions || "[]");
      const parsedModels = e.models ? JSON.parse(e.models) : null;

      if (full) {
        return {
          ...e,
          questions: parsedQuestions,
          models: parsedModels,
          extraData: e.extra_data ? JSON.parse(e.extra_data) : null,
          _fullLoaded: true,
        };
      }

      // Lightweight summary payload for /created-exams cards (strips heavy Base64 images & full models)
      const previewQuestions = Array.isArray(parsedQuestions)
        ? parsedQuestions.slice(0, 3).map((q: any) => ({
            id: q.id,
            type: q.type,
            text: q.text,
            options: Array.isArray(q.options) ? q.options.slice(0, 4) : [],
            correctOptionIndex: q.correctOptionIndex,
            points: q.points,
          }))
        : [];

      const modelCount =
        parsedModels?.modelCount ||
        (parsedModels?.models?.C ? 3 : parsedModels?.models?.B ? 2 : 1);

      return {
        id: e.id,
        title: e.title,
        paper_title: e.paper_title,
        exam_code: e.exam_code,
        subject: e.subject,
        grade: e.grade,
        duration: e.duration,
        questions_count: e.questions_count,
        total_points: e.total_points,
        date_created: e.date_created,
        created_at: e.created_at,
        questions: previewQuestions,
        models: modelCount > 1 ? { modelCount } : null,
        _fullLoaded: false,
      };
    });
    return NextResponse.json({ success: true, exams: formatted });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireApiSession();
    if (!session) {
      return NextResponse.json({ error: "غير مصرح لك بالوصول" }, { status: 401 });
    }

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
      models,
      extraData,
      extra_data,
      questionsCount,
      questions_count,
      totalPoints,
      total_points,
      dateCreated,
      date_created,
    } = body;

    const rawExtra = extraData ?? extra_data;

    saveLocalExam(
      {
        id: id || `exam-${Date.now()}`,
        title: title || "اختبار جديد",
        paper_title: paper_title ?? paperTitle,
        exam_code: exam_code ?? examCode,
        subject: subject || "عام",
        grade: grade || "مستوى عام",
        duration: duration || "ساعتان",
        questions: typeof questions === "string" ? questions : JSON.stringify(questions || []),
        models: typeof models === "string" ? models : models ? JSON.stringify(models) : undefined,
        extra_data: typeof rawExtra === "string" ? rawExtra : rawExtra ? JSON.stringify(rawExtra) : undefined,
        questions_count: questions_count ?? questionsCount ?? (Array.isArray(questions) ? questions.length : 0),
        total_points: total_points ?? totalPoints ?? 20,
        date_created: date_created ?? dateCreated ?? "اليوم",
      },
      session.id
    );

    return NextResponse.json({ success: true, message: "تم حفظ الاختبار بنجاح في قاعدة البيانات المحلية." });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await requireApiSession();
    if (!session) {
      return NextResponse.json({ error: "غير مصرح لك بالوصول" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing exam ID" }, { status: 400 });
    }
    deleteLocalExam(id, session.id);
    return NextResponse.json({ success: true, message: "تم حذف الاختبار من قاعدة البيانات." });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
