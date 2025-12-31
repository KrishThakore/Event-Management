'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    // Filter users based on search term
    if (searchTerm.trim() === '') {
      setFilteredUsers(users);
    } else {
      const filtered = users.filter(user => 
        user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredUsers(filtered);
    }
  }, [searchTerm, users]);

  async function fetchUsers() {
    try {
      const supabase = getSupabaseBrowserClient();
      
      // Check if user is logged in
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/admin');
        return;
      }

      // Get user email to check if admin
      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData?.user?.email;
      
      // Email check first: If the user's email is in the hardcoded list, they're admin
      const adminEmails = ['krshthakore@gmail.com', 'admin@university.edu']; // Update with your admin emails
      let isAdmin = false;
      
      if (userEmail && adminEmails.includes(userEmail)) {
        isAdmin = true;
      } else {
        // Role check second: If not in email list, checks if they have admin role in profiles
        // Use the new working bypass function to avoid RLS recursion
        const { data: allUsers } = await supabase
          .rpc('get_all_profiles_for_admin');
        
        const currentUserProfile = allUsers?.find((u: any) => u.id === user.id);
        isAdmin = currentUserProfile?.role === 'admin';
      }
      
      if (!isAdmin) {
        router.push('/');
        return;
      }

      // Use the new working bypass function to get all users with stats
      const { data: usersData } = await supabase
        .rpc('get_all_profiles_for_admin');

      const { data: events } = await supabase
        .from('events')
        .select('id,created_by');

      const { data: registrations } = await supabase
        .from('registrations')
        .select('id,user_id');

      const { data: attendance } = await supabase
        .from('attendance')
        .select(`
          id,
          registration_id,
          registrations!inner(
            user_id
          )
        `);

      const userStats = new Map<string, { eventsCreated: number; registrationsCount: number; attendanceCount: number }>();

      for (const user of usersData ?? []) {
        userStats.set((user as any).id as string, {
          eventsCreated: 0,
          registrationsCount: 0,
          attendanceCount: 0
        });
      }

      for (const event of events ?? []) {
        const stats = userStats.get((event as any).created_by as string);
        if (stats) stats.eventsCreated += 1;
      }

      for (const reg of registrations ?? []) {
        const stats = userStats.get((reg as any).user_id as string);
        if (stats) stats.registrationsCount += 1;
      }

      for (const att of attendance ?? []) {
        const stats = userStats.get((att as any).registrations.user_id as string);
        if (stats) stats.attendanceCount += 1;
      }

      const usersWithStats = (usersData ?? []).map((user: any) => ({
        ...user,
        stats: userStats.get(user.id as string) ?? { eventsCreated: 0, registrationsCount: 0, attendanceCount: 0 }
      }));

      setUsers(usersWithStats);
      setFilteredUsers(usersWithStats);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleRoleAction(action: string, targetUserId: string) {
    try {
      const supabase = getSupabaseBrowserClient();
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user email to check if admin
      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData?.user?.email;
      
      // Email check first: If the user's email is in the hardcoded list, they're admin
      const adminEmails = ['krshthakore@gmail.com', 'admin@university.edu']; // Update with your admin emails
      let isAdmin = false;
      
      if (userEmail && adminEmails.includes(userEmail)) {
        isAdmin = true;
      } else {
        // Role check second: If not in email list, checks if they have admin role in profiles
        // Use the new working bypass function to avoid RLS recursion
        const { data: allUsers } = await supabase
          .rpc('get_all_profiles_for_admin');
        
        const currentUserProfile = allUsers?.find((u: any) => u.id === user.id);
        isAdmin = currentUserProfile?.role === 'admin';
      }
      
      if (!isAdmin) return;

      // Prevent self-demotion
      if (targetUserId === user.id) return;

      // Get target user profile using the new working bypass function
      const { data: allUsers } = await supabase
        .rpc('get_all_profiles_for_admin');

      const targetProfile = allUsers?.find((u: any) => u.id === targetUserId);
      if (!targetProfile) return;

      let newRole: 'student' | 'organizer' | 'admin' | null = null;
      let logAction = '';
      let disableUser = false;

      if (action === 'promote_student_to_organizer' && targetProfile.role === 'student') {
        newRole = 'organizer';
        logAction = 'ROLE_PROMOTE_STUDENT_TO_ORGANIZER';
      } else if (action === 'promote_organizer_to_admin' && targetProfile.role === 'organizer') {
        newRole = 'admin';
        logAction = 'ROLE_PROMOTE_ORGANIZER_TO_ADMIN';
      } else if (action === 'demote_organizer_to_student' && targetProfile.role === 'organizer') {
        newRole = 'student';
        logAction = 'ROLE_DEMOTE_ORGANIZER_TO_STUDENT';
      } else if (action === 'demote_admin_to_organizer' && targetProfile.role === 'admin') {
        newRole = 'organizer';
        logAction = 'ROLE_DEMOTE_ADMIN_TO_ORGANIZER';
      } else if (action === 'disable_user') {
        disableUser = true;
        logAction = 'USER_DISABLE';
      } else if (action === 'enable_user') {
        disableUser = false;
        logAction = 'USER_ENABLE';
      }

      if (newRole) {
        await supabase
          .from('profiles')
          .update({ role: newRole })
          .eq('id', targetUserId);

        await supabase.from('admin_logs').insert({
          admin_id: user.id,
          action: logAction,
          details: {
            target_user_id: targetUserId,
            previous_role: targetProfile.role,
            new_role: newRole
          }
        });
      } else if (action === 'disable_user' || action === 'enable_user') {
        await supabase
          .from('profiles')
          .update({ disabled: disableUser })
          .eq('id', targetUserId);

        await supabase.from('admin_logs').insert({
          admin_id: user.id,
          action: logAction,
          details: {
            target_user_id: targetUserId,
            disabled: disableUser
          }
        });
      }

      // Refresh users
      await fetchUsers();
    } catch (error) {
      console.error('Error updating user role:', error);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Users & Roles</h1>
        <p className="mt-1 text-sm text-slate-400">
          View all users, promote or demote roles, and see user statistics.
        </p>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 pl-10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
        />
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      {/* Results count */}
      <div className="text-sm text-slate-400">
        {filteredUsers.length} {filteredUsers.length === 1 ? 'user' : 'users'} found
        {searchTerm && ` (searching for "${searchTerm}")`}
      </div>

      {filteredUsers.length === 0 ? (
        <p className="text-sm text-slate-400">
          {searchTerm ? 'No users found matching your search.' : 'No users found.'}
        </p>
      ) : (
        <div className="space-y-3 text-sm">
          {filteredUsers.map((user: any) => {
            const canPromoteStudentToOrganizer = user.role === 'student';
            const canPromoteOrganizerToAdmin = user.role === 'organizer';
            const canDemoteOrganizerToStudent = user.role === 'organizer';
            const canDemoteAdminToOrganizer = user.role === 'admin';

            return (
              <div
                key={user.id}
                className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold text-white">
                        {user.full_name || 'Unnamed User'}
                      </h2>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${
                        user.role === 'admin'
                          ? 'bg-red-700/30 text-red-300'
                          : user.role === 'organizer'
                          ? 'bg-amber-700/30 text-amber-300'
                          : 'bg-slate-700 text-slate-300'
                      }`}>
                        {user.role}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">{user.email}</p>
                    <p className="text-[11px] text-slate-400">
                      Joined {new Date(user.created_at).toLocaleDateString()}
                    </p>
                    <div className="flex flex-wrap gap-3 text-[11px] text-slate-500">
                      <span>Events created: {user.stats.eventsCreated}</span>
                      <span>Registrations: {user.stats.registrationsCount}</span>
                      <span>Attendance: {user.stats.attendanceCount}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 md:justify-end">
                    <div className="flex flex-wrap gap-2">
                      {canPromoteStudentToOrganizer && (
                        <button
                          onClick={() => handleRoleAction('promote_student_to_organizer', user.id)}
                          className="rounded-md bg-amber-700 px-3 py-1 text-[11px] font-medium text-amber-50 hover:bg-amber-600"
                        >
                          Promote to Organizer
                        </button>
                      )}
                      {canPromoteOrganizerToAdmin && (
                        <button
                          onClick={() => handleRoleAction('promote_organizer_to_admin', user.id)}
                          className="rounded-md bg-red-700 px-3 py-1 text-[11px] font-medium text-red-50 hover:bg-red-600"
                        >
                          Promote to Admin
                        </button>
                      )}
                      {canDemoteOrganizerToStudent && (
                        <button
                          onClick={() => handleRoleAction('demote_organizer_to_student', user.id)}
                          className="rounded-md border border-slate-600 px-3 py-1 text-[11px] font-medium text-slate-100 hover:border-slate-400"
                        >
                          Demote to Student
                        </button>
                      )}
                      {canDemoteAdminToOrganizer && (
                        <button
                          onClick={() => handleRoleAction('demote_admin_to_organizer', user.id)}
                          className="rounded-md border border-slate-600 px-3 py-1 text-[11px] font-medium text-slate-100 hover:border-slate-400"
                        >
                          Demote to Organizer
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
