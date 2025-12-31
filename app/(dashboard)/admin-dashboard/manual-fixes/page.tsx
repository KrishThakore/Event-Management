import { getSupabaseServerClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';

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

  return { user };
}

async function getSuspiciousPayments() {
  const supabase = getSupabaseServerClient();

  const { data } = await supabase
    .from('payments')
    .select(
      `id,amount,status,razorpay_order_id,razorpay_payment_id,created_at,
       registration:registrations(id,status,entry_code,event_id,user_id),
       event:events(id,title,is_paid,price),
       user:profiles(id,full_name,email)`
    )
    .eq('status', 'SUCCESS')
    .order('created_at', { ascending: false });

  return (data ?? []).filter(
    (p: any) => !p.registration || p.registration.length === 0 || p.registration[0]?.status !== 'CONFIRMED'
  );
}

async function handleManualFix(formData: FormData) {
  'use server';

  const action = formData.get('action') as string | null;
  const paymentId = formData.get('paymentId') as string | null;
  const userEmail = formData.get('userEmail') as string | null;
  const eventId = formData.get('eventId') as string | null;
  const userName = formData.get('userName') as string | null;
  const offlineEventId = formData.get('offlineEventId') as string | null;
  const offlineUserName = formData.get('offlineUserName') as string | null;
  const offlineUserEmail = formData.get('offlineUserEmail') as string | null;

  let redirectStatus: string | null = null;

  if (!action) {
    redirect('/admin-dashboard/manual-fixes');
  }

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

  if (action === 'fix_payment_success_but_registration_missing' && paymentId) {
    // Fix payment success but registration missing
    const { data: payment } = await supabase
      .from('payments')
      .select('id,user_id,event_id,amount,razorpay_payment_id')
      .eq('id', paymentId)
      .single();

    if (payment && payment.user_id && payment.event_id) {
      // Check if registration already exists
      const { data: existingReg } = await supabase
        .from('registrations')
        .select('id')
        .eq('user_id', payment.user_id)
        .eq('event_id', payment.event_id)
        .single();

      if (!existingReg) {
        // Generate entry code
        const entryCode = `MANUAL-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

        // Create registration with payment reference
        const { data: newReg } = await supabase
          .from('registrations')
          .insert({
            user_id: payment.user_id,
            event_id: payment.event_id,
            status: 'CONFIRMED',
            entry_code: entryCode
          })
          .select('id')
          .single();

        await supabase.from('admin_logs').insert({
          admin_id: user.id,
          action: 'MANUAL_FIX_PAYMENT_SUCCESS_BUT_REG_MISSING',
          details: {
            payment_id: paymentId,
            user_id: payment.user_id,
            event_id: payment.event_id,
            amount: payment.amount,
            razorpay_payment_id: payment.razorpay_payment_id,
            registration_id: newReg?.id,
            entry_code: entryCode
          }
        });

        redirectStatus = 'payment_fix_success';
      }
    }
  } else if (action === 'add_user_manually' && userEmail && eventId) {
    // Add user manually (internet failed case)
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('id,full_name')
      .eq('email', userEmail)
      .single();

    if (userProfile) {
      // Check if registration already exists
      const { data: existingReg } = await supabase
        .from('registrations')
        .select('id')
        .eq('user_id', userProfile.id)
        .eq('event_id', eventId)
        .single();

      if (!existingReg) {
        // Generate entry code
        const entryCode = `MANUAL-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

        // Create registration
        const { data: newReg } = await supabase
          .from('registrations')
          .insert({
            user_id: userProfile.id,
            event_id: eventId,
            status: 'CONFIRMED',
            entry_code: entryCode
          })
          .select('id')
          .single();

        await supabase.from('admin_logs').insert({
          admin_id: user.id,
          action: 'MANUAL_ADD_USER_INTERNET_FAILED',
          details: {
            user_email: userEmail,
            user_id: userProfile.id,
            event_id: eventId,
            registration_id: newReg?.id,
            entry_code: entryCode
          }
        });

        redirectStatus = 'manual_add_success';
      }
    }
  } else if (action === 'add_offline_registration' && offlineEventId && offlineUserName && offlineUserEmail) {
    // Add offline registration
    // First create user profile if doesn't exist
    let userProfile = null;
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id,full_name')
      .eq('email', offlineUserEmail)
      .single();

    if (!existingUser) {
      // Create new user profile
      const { data: newUser } = await supabase
        .from('profiles')
        .insert({
          email: offlineUserEmail,
          full_name: offlineUserName,
          role: 'student'
        })
        .select('id,full_name')
        .single();
      userProfile = newUser;
    } else {
      userProfile = existingUser;
    }

    if (userProfile) {
      // Check if registration already exists
      const { data: existingReg } = await supabase
        .from('registrations')
        .select('id')
        .eq('user_id', userProfile.id)
        .eq('event_id', offlineEventId)
        .single();

      if (!existingReg) {
        // Generate entry code
        const entryCode = `MANUAL-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

        // Create registration
        const { data: newReg } = await supabase
          .from('registrations')
          .insert({
            user_id: userProfile.id,
            event_id: offlineEventId,
            status: 'CONFIRMED',
            entry_code: entryCode
          })
          .select('id')
          .single();

        await supabase.from('admin_logs').insert({
          admin_id: user.id,
          action: 'MANUAL_OFFLINE_REGISTRATION',
          details: {
            user_email: offlineUserEmail,
            user_name: offlineUserName,
            user_id: userProfile.id,
            event_id: offlineEventId,
            registration_id: newReg?.id,
            entry_code: entryCode
          }
        });

        redirectStatus = 'offline_add_success';
      }
    }
  }

  const basePath = '/admin-dashboard/manual-fixes';
  if (redirectStatus) {
    redirect(`${basePath}?status=${encodeURIComponent(redirectStatus)}`);
  }

  redirect(basePath);
}

async function getEvents() {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from('events')
    .select('id,title,event_date')
    .eq('status', 'approved')
    .order('event_date', { ascending: true });
  return data ?? [];
}

export default async function AdminManualFixesPage({
  searchParams
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  await requireAdmin();
  const suspiciousPayments = await getSuspiciousPayments();
  const events = await getEvents();

  const statusParam = typeof searchParams?.status === 'string' ? searchParams.status : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Manual Fixes</h1>
        <p className="mt-1 text-sm text-slate-400">
          Fix payment-success-but-registration-missing issues, add users manually, and generate entry codes.
        </p>
      </div>

      {statusParam === 'manual_add_success' && (
        <div className="rounded-md border border-emerald-700 bg-emerald-900/40 px-4 py-2 text-xs text-emerald-50">
          User was registered to the selected event successfully.
        </div>
      )}

      {statusParam === 'offline_add_success' && (
        <div className="rounded-md border border-amber-700 bg-amber-900/40 px-4 py-2 text-xs text-amber-50">
          Offline registration was created successfully.
        </div>
      )}

      {/* Suspicious payments section */}
      <div className="space-y-3">
        <h2 className="text-lg font-medium text-white">Suspicious Payments</h2>
        {suspiciousPayments.length === 0 ? (
          <p className="text-sm text-slate-400">No suspicious payments found.</p>
        ) : (
          <div className="space-y-3 text-sm">
            {suspiciousPayments.map((payment: any) => (
              <div
                key={payment.id}
                className="rounded-xl border border-red-700/50 bg-red-900/20 p-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold text-white">
                        ₹{payment.amount}
                      </h2>
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide bg-red-700/30 text-red-300">
                        SUCCESS
                      </span>
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide bg-amber-700/30 text-amber-300">
                        Missing Registration
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">
                      {payment.event?.title ?? 'Event'} · {payment.user?.full_name ?? 'Unknown'} ({payment.user?.email})
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Payment ID: {payment.razorpay_payment_id ?? 'N/A'}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Created: {new Date(payment.created_at).toLocaleString()}
                    </p>
                  </div>
                  <form action={handleManualFix}>
                    <input type="hidden" name="paymentId" value={payment.id} />
                    <button
                      type="submit"
                      name="action"
                      value="fix_payment_success_but_registration_missing"
                      className="rounded-md bg-amber-700 px-3 py-1 text-[11px] font-medium text-amber-50 hover:bg-amber-600"
                    >
                      Fix Registration
                    </button>
                    <script
                      dangerouslySetInnerHTML={{
                        __html: `
                          document.querySelector('[name="action"][value="fix_payment_success_but_registration_missing"]').addEventListener('click', function(e) {
                            if (!confirm('Fix registration for ${payment.user?.full_name || payment.user?.email}?\\n\\nThis will create a manual registration and attach payment reference.')) {
                              e.preventDefault();
                            }
                          });
                        `,
                      }}
                    />
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Manual user addition section */}
      <div className="space-y-3">
        <h2 className="text-lg font-medium text-white">Add User Manually (Internet Failed)</h2>
        <form action={handleManualFix} className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label htmlFor="userEmail" className="block text-xs font-medium text-slate-300">
                User Email
              </label>
              <input
                type="email"
                id="userEmail"
                name="userEmail"
                required
                placeholder="user@example.com"
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>
            <div>
              <label htmlFor="eventId" className="block text-xs font-medium text-slate-300">
                Event
              </label>
              <select
                id="eventId"
                name="eventId"
                required
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              >
                <option value="">Select event</option>
                {events.map((event: any) => (
                  <option key={event.id} value={event.id}>
                    {event.title} ({new Date(event.event_date).toLocaleDateString()})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="submit"
            name="action"
            value="add_user_manually"
            className="rounded-md bg-emerald-700 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-600"
          >
            Add User Manually
          </button>
          <script
            dangerouslySetInnerHTML={{
              __html: `
                document.querySelector('[name="action"][value="add_user_manually"]').addEventListener('click', function(e) {
                  if (!confirm('Add user manually?\\n\\nThis will create a manual registration for a user who paid but internet failed.')) {
                    e.preventDefault();
                  }
                });
              `,
            }}
          />
        </form>
      </div>

      {/* Offline registration section */}
      <div className="space-y-3">
        <h2 className="text-lg font-medium text-white">Add Offline Registration</h2>
        <form action={handleManualFix} className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label htmlFor="offlineUserName" className="block text-xs font-medium text-slate-300">
                Full Name
              </label>
              <input
                type="text"
                id="offlineUserName"
                name="offlineUserName"
                required
                placeholder="John Doe"
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>
            <div>
              <label htmlFor="offlineUserEmail" className="block text-xs font-medium text-slate-300">
                Email
              </label>
              <input
                type="email"
                id="offlineUserEmail"
                name="offlineUserEmail"
                required
                placeholder="user@example.com"
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>
            <div>
              <label htmlFor="offlineEventId" className="block text-xs font-medium text-slate-300">
                Event
              </label>
              <select
                id="offlineEventId"
                name="offlineEventId"
                required
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              >
                <option value="">Select event</option>
                {events.map((event: any) => (
                  <option key={event.id} value={event.id}>
                    {event.title} ({new Date(event.event_date).toLocaleDateString()})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="submit"
            name="action"
            value="add_offline_registration"
            className="rounded-md bg-amber-700 px-4 py-2 text-xs font-medium text-amber-50 hover:bg-amber-600"
          >
            Add Offline Registration
          </button>
          <script
            dangerouslySetInnerHTML={{
              __html: `
                document.querySelector('[name="action"][value="add_offline_registration"]').addEventListener('click', function(e) {
                  if (!confirm('Add offline registration?\\n\\nThis will create a new user profile and manual registration for offline participants.')) {
                    e.preventDefault();
                  }
                });
              `,
            }}
          />
        </form>
      </div>

      {/* Instructions */}
      <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4 text-xs text-slate-400">
        <p className="font-semibold text-slate-300 mb-2">Manual Fix Guidelines:</p>
        <ul className="space-y-1 list-disc list-inside">
          <li>Only use manual fixes for verified edge cases (e.g., payment success but registration failed)</li>
          <li>All manual fixes are logged in admin logs with full details</li>
          <li>Manual registrations are marked with "MANUAL-" prefix in entry codes</li>
          <li>Verify user identity and payment status before creating manual registrations</li>
        </ul>
      </div>
    </div>
  );
}
