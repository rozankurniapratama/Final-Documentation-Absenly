// app/documentation/[taskId]/page.tsx
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import TaskEditor from "./editor";

interface PageProps {
  params: Promise<{ taskId: string }>;
}

export default async function TaskEditorPage({ params }: PageProps) {
  const { taskId } = await params;
  const session = await getSession();

  if (!session?.authenticated) {
    redirect("/login");
  }

  const supabase = await createClient();

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select(`id, name, task_order, is_completed, modules (id, name)`)
    .eq("id", taskId)
    .single();

  if (taskError || !task) {
    console.error("Task fetch error:", taskError);
    notFound();
  }

  const { data: doc } = await supabase
    .from("task_documentation")
    .select("text_content")
    .eq("task_id", taskId)
    .maybeSingle();

  const moduleName = (task.modules as { name: string } | null)?.name || "Unknown Module";

  return (
    <TaskEditor
      taskId={task.id}
      taskName={task.name}
      moduleName={moduleName}
      initialContent={doc?.text_content || null}
    />
  );
}
