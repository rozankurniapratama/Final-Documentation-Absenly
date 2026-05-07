"use server";

import bcrypt from "bcryptjs";
import { createClient } from "@/lib/supabase/server";
import { createSession, setSessionCookie } from "@/lib/auth";

export async function loginAction(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const password = formData.get("password") as string;

  if (!password) {
    return { error: "Password is required" };
  }

  try {
    const supabase = await createClient();

    // Get stored password hash from app_settings
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "password_hash")
      .single();

    if (error || !data) {
      return { error: "Authentication system not configured" };
    }

    const storedHash = data.value;

    // Compare password with stored hash
    const isValid = await bcrypt.compare(password, storedHash);

    if (!isValid) {
      return { error: "Invalid password" };
    }

    // Create session and set cookie
    const token = await createSession();
    await setSessionCookie(token);

    return { error: null };
  } catch (err) {
    console.error("Login error:", err);
    return { error: "An error occurred during login" };
  }
}
