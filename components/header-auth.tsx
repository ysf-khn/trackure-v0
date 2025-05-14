import { createClient } from "@/utils/supabase/server";
import AuthButtonClient from "./header-auth-client";

export default async function AuthButton() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <AuthButtonClient user={user} />;
}
