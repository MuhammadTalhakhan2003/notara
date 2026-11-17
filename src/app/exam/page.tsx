import type { Metadata } from "next";
import { ExamCoach } from "@/components/exam";

export const metadata: Metadata = {
  title: "Exam Coach",
  description:
    "Exam practice where every explanation points to the exact line in your study material, and any citation the server cannot find in the source is rejected.",
};

export default function ExamPage() {
  return <ExamCoach />;
}
