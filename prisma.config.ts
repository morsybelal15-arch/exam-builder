import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL || "postgresql://exam_builder:ExamBuilder2026!@127.0.0.1:5432/exam_builder_db?schema=public",
  },
});
