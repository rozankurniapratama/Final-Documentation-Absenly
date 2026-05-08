"use server";

import { createClient } from "@/lib/supabase/server";
import { clearSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

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

    if (error) {
      return { error: error.message };
    }

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
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq("id", taskId);

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/documentation");
    return { error: null };
  } catch (err) {
    console.error("Update task error:", err);
    return { error: "Failed to update task" };
  }
}

export async function updateModuleAction(
  moduleId: string,
  newName: string
): Promise<{ error: string | null }> {
  try {
    const supabase = await createClient();

    // ✅ FIX: Removed updated_at since your modules table doesn't have it
    const { error } = await supabase
      .from("modules")
      .update({ name: newName })
      .eq("id", moduleId);

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/documentation");
    return { error: null };
  } catch (err) {
    console.error("Update module error:", err);
    return { error: "Failed to update module" };
  }
}

export async function deleteTaskAction(
  taskId: string
): Promise<{ error: string | null }> {
  try {
    const supabase = await createClient();

    await supabase
      .from("task_documentation")
      .delete()
      .eq("task_id", taskId);

    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", taskId);

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/documentation");
    return { error: null };
  } catch (err) {
    console.error("Delete task error:", err);
    return { error: "Failed to delete task" };
  }
}

export async function deleteModuleAction(
  moduleId: string
): Promise<{ error: string | null }> {
  try {
    const supabase = await createClient();

    // ✅ FIX: Properly destructured { data, error }
    const { tasks, error: fetchError } = await supabase
      .from("tasks")
      .select("id")
      .eq("module_id", moduleId);

    if (fetchError) {
      return { error: fetchError.message };
    }

    if (tasks && tasks.length > 0) {
      const taskIds = tasks.map((t) => t.id);
      await supabase
        .from("task_documentation")
        .delete()
        .in("task_id", taskIds);

      await supabase
        .from("tasks")
        .delete()
        .eq("module_id", moduleId);
    }

    const { error } = await supabase
      .from("modules")
      .delete()
      .eq("id", moduleId);

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/documentation");
    return { error: null };
  } catch (err) {
    console.error("Delete module error:", err);
    return { error: "Failed to delete module" };
  }
}

export async function saveDocumentationAction(
  taskId: string,
  textContent: object,
  drawingContent: object
): Promise<{ error: string | null }> {
  try {
    const supabase = await createClient();

    const { error } = await supabase.from("task_documentation").upsert(
      {
        task_id: taskId,
        text_content: textContent,
        drawing_content: drawingContent,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "task_id",
      }
    );

    if (error) {
      return { error: error.message };
    }

    return { error: null };
  } catch (err) {
    console.error("Save documentation error:", err);
    return { error: "Failed to save documentation" };
  }
}

export async function getDocumentationAction(taskId: string): Promise<{
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
    return {
      textContent: null,
      drawingContent: null,
      error: "Failed to load documentation",
    };
  }
}

export async function logoutAction(): Promise<void> {
  await clearSession();
}