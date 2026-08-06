import { redirect } from "next/navigation";

/**
 * /homeworks/[id] — redirect to the student homework detail.
 * Students reach homework through the teacher hub page, not directly by ID.
 * This stub satisfies Next.js routing and redirects to the hub root.
 */
export default function HomeworkByIdPage() {
  redirect("/");
}
