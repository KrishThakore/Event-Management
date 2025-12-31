import { getSupabaseServerClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { CreateEventForm } from './CreateEventForm';

export const revalidate = 0;

async function requireAdmin() {
  const supabase = getSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/admin');
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
    // Use the working bypass function to avoid RLS recursion
    const { data: allUsers } = await supabase
      .rpc('get_all_profiles_for_admin');
    
    const currentUserProfile = allUsers?.find((u: any) => u.id === user.id);
    isAdmin = currentUserProfile?.role === 'admin';
  }
  
  if (!isAdmin) {
    redirect('/');
  }

  return { user };
}

async function getOrganizers() {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .rpc('get_all_profiles_for_admin')
    .eq('role', 'organizer');
  
  return data || [];
}

export default async function CreateEventPage() {
  await requireAdmin();
  const organizers = await getOrganizers();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Create Event</h1>
        <p className="mt-1 text-sm text-slate-400">
          Create official/system-level events that are auto-approved.
        </p>
      </div>

      <CreateEventForm organizers={organizers} />
    </div>
  );
}
