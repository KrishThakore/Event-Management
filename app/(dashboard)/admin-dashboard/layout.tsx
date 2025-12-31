import { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import EditEventsDropdown from '@/components/admin/EditEventsDropdown';

export const revalidate = 0;

async function requireAdmin() {
  const supabase = getSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/admin');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') {
    redirect('/');
  }

  return { user, profile };
}

export default async function AdminDashboardLayout({ children }: { children: ReactNode }) {
  const { profile } = await requireAdmin();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="hidden w-64 flex-shrink-0 border-r border-slate-800 bg-slate-900/80 px-4 py-6 md:flex md:flex-col">
          <div className="mb-8 px-2">
            <h1 className="text-lg font-semibold tracking-tight text-white">Admin Panel</h1>
            <p className="mt-1 text-[11px] text-slate-400">University Event Management</p>
          </div>

          <nav className="flex-1 space-y-1 text-sm">
            <AdminNavItem href="/admin-dashboard" label="Dashboard (Overview)" />
            <AdminNavItem href="/admin-dashboard/events" label="Events" />
            <AdminNavItem href="/admin-dashboard/create-event" label="Create Event" />
            <AdminNavItem href="/admin-dashboard/edit-event" label="Edit Event" />
            <AdminNavItem href="/admin-dashboard/registrations" label="Registrations" />
            <AdminNavItem href="/admin-dashboard/attendance" label="Attendance" />
            <AdminNavItem href="/admin-dashboard/payments" label="Payments" />
            <AdminNavItem href="/admin-dashboard/users" label="Users" />
            <AdminNavItem href="/admin-dashboard/form-control" label="Form Control" />
            <AdminNavItem href="/admin-dashboard/manual-fixes" label="Manual Fixes" />
            <AdminNavItem href="/admin-dashboard/logs" label="Logs / Audit" />
            <AdminNavItem href="/admin-dashboard/exports" label="Exports" />
          </nav>

          <form
            action="/api/admin/logout"
            method="post"
            className="mt-6 border-t border-slate-800 pt-4"
          >
            <button
              type="submit"
              className="flex w-full items-center justify-between rounded-md bg-red-900/30 px-3 py-2 text-xs font-medium text-red-200 hover:bg-red-900/50"
            >
              <span>Logout</span>
            </button>
          </form>
        </aside>

        {/* Mobile sidebar placeholder (collapsible) */}
        <div className="flex w-full flex-1 flex-col md:pl-0">
          <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-4 py-3 md:hidden">
            <div>
              <p className="text-xs font-medium text-slate-300">Admin Panel</p>
              <p className="text-[11px] text-slate-500">Tap menu to navigate</p>
            </div>
            {/* You can wire a real mobile drawer later */}
          </header>

          <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

function AdminNavItem({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-md px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 hover:text-white"
    >
      <span>{label}</span>
    </Link>
  );
}
