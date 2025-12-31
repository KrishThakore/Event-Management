"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { User } from "@supabase/supabase-js";
import { toast } from "sonner";

export function UserMenu() {
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function handleLogout() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(error.message ?? "Unable to log out");
      return;
    }
    toast.success("Logged out");
    setOpen(false);
    router.push("/");
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-xs font-medium text-slate-200 hover:border-slate-500"
      >
        {user?.email?.[0]?.toUpperCase() ?? "U"}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-40 rounded-md border border-slate-800 bg-slate-900 py-1 text-xs shadow-lg">
          {!user && (
            <Link
              href="/login"
              className="block px-3 py-2 text-slate-200 hover:bg-slate-800"
              onClick={() => setOpen(false)}
            >
              Login
            </Link>
          )}
          {user && (
            <>
              <button
                type="button"
                className="flex w-full px-3 py-2 text-left text-slate-200 hover:bg-slate-800"
                onClick={() => {
                  router.push("/dashboard");
                  setOpen(false);
                }}
              >
                Dashboard
              </button>
              <button
                type="button"
                className="flex w-full px-3 py-2 text-left text-red-300 hover:bg-red-900/40"
                onClick={handleLogout}
              >
                Logout
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
