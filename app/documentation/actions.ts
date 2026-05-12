"use server";

import { createClient } from "@/lib/supabase/server";
import { clearSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// ==================== TASK ACTIONS ====================

export async function toggleTaskAction(
  taskId: string,
  completed: boolean
): Promise<{ error: string | null }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("tasks")
      .update({ is_completed: completed, updated_at: new Date().toISOString() })
      .eq("id", taskId);

    if (error) return { error: error.message };
    revalidatePath("/documentation");
    return { error: null };
  } catch (err) {
    console.error("Toggle task error:", err);
    return { error: "Failed to update task" };
  }
}

export async function updateTaskAction(
  taskId: string,
  updates: { name?: string; task_order?: number }
): Promise<{ error: string | null }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("tasks")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", taskId);

    if (error) return { error: error.message };
    revalidatePath("/documentation");
    return { error: null };
  } catch (err) {
    console.error("Update task error:", err);
    return { error: "Failed to update task" };
  }
}

export async function deleteTaskAction(
  taskId: string
): Promise<{ error: string | null }> {
  try {
    const supabase = await createClient();
    await supabase.from("task_documentation").delete().eq("task_id", taskId);
    const { error } = await supabase.from("tasks").delete().eq("id", taskId);

    if (error) return { error: error.message };
    revalidatePath("/documentation");
    return { error: null };
  } catch (err) {
    console.error("Delete task error:", err);
    return { error: "Failed to delete task" };
  }
}

// ==================== MODULE ACTIONS ====================

export async function updateModuleAction(
  moduleId: string,
  newName: string
): Promise<{ error: string | null }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("modules")
      .update({ name: newName })
      .eq("id", moduleId);

    if (error) return { error: error.message };
    revalidatePath("/documentation");
    return { error: null };
  } catch (err) {
    console.error("Update module error:", err);
    return { error: "Failed to update module" };
  }
}

export async function deleteModuleAction(
  moduleId: string
): Promise<{ error: string | null }> {
  try {
    const supabase = await createClient();
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id")
      .eq("module_id", moduleId);

    if (tasks && tasks.length > 0) {
      const taskIds = tasks.map((t) => t.id);
      await supabase.from("task_documentation").delete().in("task_id", taskIds);
      await supabase.from("tasks").delete().eq("module_id", moduleId);
    }

    const { error } = await supabase.from("modules").delete().eq("id", moduleId);
    if (error) return { error: error.message };
    revalidatePath("/documentation");
    return { error: null };
  } catch (err) {
    console.error("Delete module error:", err);
    return { error: "Failed to delete module" };
  }
}

export async function createModuleAction(
  name: string
): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    const supabase = await createClient();
    const { count } = await supabase
      .from("modules")
      .select("*", { count: "exact", head: true });

    const { data, error } = await supabase
      .from("modules")
      .insert({ name: name.trim(), display_order: (count ?? 0) + 1 })
      .select("id")
      .single();

    if (error) return { data: null, error: error.message };
    revalidatePath("/documentation");
    return { data: { id: data.id }, error: null };
  } catch (err) {
    console.error("Create module error:", err);
    return { data: null, error: "Failed to create module" };
  }
}

export async function createTaskAction(
  moduleId: string,
  data: { name: string; task_order: number }
): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    const supabase = await createClient();
    const { data: newTask, error } = await supabase
      .from("tasks")
      .insert({
        name: data.name.trim(),
        task_order: data.task_order,
        is_completed: false,
        module_id: moduleId,
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) return { data: null, error: error.message };
    revalidatePath("/documentation");
    return { data: { id: newTask.id }, error: null };
  } catch (err) {
    console.error("Create task error:", err);
    return { data: null, error: "Failed to create task" };
  }
}

// ==================== DOCUMENTATION ACTIONS ====================

export async function saveDocumentationAction(
  taskId: string,
  textContent: object,
  drawingContent: object
): Promise<{ error: string | null }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("task_documentation")
      .upsert(
        {
          task_id: taskId,
          text_content: textContent,
          drawing_content: drawingContent,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "task_id" }
      );

    if (error) return { error: error.message };
    return { error: null };
  } catch (err) {
    console.error("Save documentation error:", err);
    return { error: "Failed to save documentation" };
  }
}

export async function getDocumentationAction(
  taskId: string
): Promise<{
  textContent: object | null;
  drawingContent: object | null;
  error: string | null;
}> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("task_documentation")
      .select("text_content, drawing_content")
      .eq("task_id", taskId)
      .single();

    if (error && error.code !== "PGRST116") {
      return { textContent: null, drawingContent: null, error: error.message };
    }

    return {
      textContent: data?.text_content || null,
      drawingContent: data?.drawing_content || null,
      error: null,
    };
  } catch (err) {
    console.error("Get documentation error:", err);
    return { textContent: null, drawingContent: null, error: "Failed to load documentation" };
  }
}

// ==================== AUTH ACTIONS ====================

export async function logoutAction(): Promise<void> {
  await clearSession();
}
