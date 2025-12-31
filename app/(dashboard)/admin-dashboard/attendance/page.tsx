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

async function getAttendanceData() {
  const supabase = getSupabaseServerClient();

  const { data: attendance } = await supabase
    .from('attendance')
    .select('id,checked_in_at,registration_id')
    .order('checked_in_at', { ascending: false });

  const { data: allRegistrations } = await supabase
    .from('registrations')
    .select(
      `id,status,entry_code,event_id,user_id,
       event:events(id,title,event_date),
       user:profiles(id,full_name)`
    )
    .eq('status', 'CONFIRMED')
    .order('created_at', { ascending: false });

  const attendanceMap = new Map<string, { id: string; checked_in_at: string }>();
  for (const a of attendance ?? []) {
    attendanceMap.set(a.registration_id as string, {
      id: a.id as string,
      checked_in_at: a.checked_in_at as string
    });
  }

  const attendanceList = (allRegistrations ?? [])
    .filter((r: any) => attendanceMap.has(r.id as string))
    .map((r: any) => {
      const att = attendanceMap.get(r.id as string)!;
      return {
        id: att.id,
        checkedInAt: att.checked_in_at,
        registrationId: r.id,
        event: r.event,
        user: r.user,
        entryCode: r.entry_code,
        registrationStatus: r.status
      };
    });

  const notCheckedIn = (allRegistrations ?? [])
    .filter((r) => !attendanceMap.has(r.id as string))
    .map((r: any) => ({
      registrationId: r.id,
      event: r.event,
      user: r.user,
      entryCode: r.entry_code,
      registrationStatus: r.status
    }));

  // Calculate attendance statistics per event
  const eventStats = new Map<string, { total: number; present: number; absent: number }>();

  // Initialize totals per event from all confirmed registrations
  for (const reg of allRegistrations ?? []) {
    const eventId = reg.event_id as string;
    const stats = eventStats.get(eventId) || { total: 0, present: 0, absent: 0 };
    stats.total += 1;
    eventStats.set(eventId, stats);
  }

  // Add present counts based on attendanceMap
  for (const reg of allRegistrations ?? []) {
    const eventId = reg.event_id as string;
    if (!attendanceMap.has(reg.id as string)) continue;
    const stats = eventStats.get(eventId) || { total: 0, present: 0, absent: 0 };
    stats.present += 1;
    eventStats.set(eventId, stats);
  }

  // Calculate absent
  for (const [eventId, stats] of eventStats.entries()) {
    stats.absent = stats.total - stats.present;
  }

  return { attendanceList, notCheckedIn, eventStats };
}

async function handleAttendanceAction(formData: FormData) {
  'use server';

  const action = formData.get('action') as string | null;
  const registrationId = formData.get('registrationId') as string | null;
  const entryCode = formData.get('entryCode') as string | null;

  if (!action) {
    redirect('/admin-dashboard/attendance');
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

  let registration = null;

  // Find registration by different methods
  if (action === 'checkin_by_code' && entryCode) {
    const { data: regData } = await supabase
      .from('registrations')
      .select('id,status,entry_code,event_id,user_id')
      .eq('entry_code', entryCode)
      .eq('status', 'CONFIRMED')
      .single();
    registration = regData;
  } else if (action === 'checkin_by_id' && registrationId) {
    const { data: regData } = await supabase
      .from('registrations')
      .select('id,status,entry_code,event_id,user_id')
      .eq('id', registrationId)
      .eq('status', 'CONFIRMED')
      .single();
    registration = regData;
  } else if (action === 'checkin' && registrationId) {
    const { data: regData } = await supabase
      .from('registrations')
      .select('id,status,entry_code,event_id,user_id')
      .eq('id', registrationId)
      .eq('status', 'CONFIRMED')
      .single();
    registration = regData;
  } else if (action === 'undo' && registrationId) {
    const { data: regData } = await supabase
      .from('registrations')
      .select('id,status,entry_code,event_id,user_id')
      .eq('id', registrationId)
      .single();
    registration = regData;
  }

  if (!registration) {
    redirect('/admin-dashboard/attendance');
  }

  const finalRegistrationId = registration.id;

  if (action === 'checkin' || action === 'checkin_by_code' || action === 'checkin_by_id') {
    const { data: existing } = await supabase
      .from('attendance')
      .select('id')
      .eq('registration_id', finalRegistrationId)
      .single();

    if (!existing) {
      await supabase
        .from('attendance')
        .insert({ registration_id: finalRegistrationId });

      await supabase.from('admin_logs').insert({
        admin_id: user.id,
        action: 'ATTENDANCE_CHECKIN',
        details: {
          registration_id: finalRegistrationId,
          event_id: registration.event_id,
          user_id: registration.user_id,
          entry_code: registration.entry_code,
          method: action.replace('checkin_', '')
        }
      });
    }
  } else if (action === 'undo') {
    await supabase
      .from('attendance')
      .delete()
      .eq('registration_id', finalRegistrationId);

    await supabase.from('admin_logs').insert({
      admin_id: user.id,
      action: 'ATTENDANCE_UNDO',
      details: {
        registration_id: finalRegistrationId,
        event_id: registration.event_id,
        user_id: registration.user_id,
        entry_code: registration.entry_code
      }
    });
  }

  redirect('/admin-dashboard/attendance');
}

export default async function AdminAttendancePage() {
  await requireAdmin();
  const { attendanceList, notCheckedIn, eventStats } = await getAttendanceData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Attendance</h1>
        <p className="mt-1 text-sm text-slate-400">
          View attendance per event, mark attendance by QR code, entry code, or registration ID, and undo check-ins.
        </p>
      </div>

      {/* Attendance Statistics */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <h2 className="text-lg font-medium text-white mb-4">Event Attendance Statistics</h2>
        {Array.from(eventStats.entries()).length === 0 ? (
          <p className="text-sm text-slate-400">No events with confirmed registrations.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {Array.from(eventStats.entries()).map(([eventId, stats]) => {
              const attendance = attendanceList.find(a => a.event?.id === eventId);
              const eventName = attendance?.event?.title || `Event ${eventId}`;
              const percentage = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;
              
              return (
                <div key={eventId} className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                  <h3 className="text-sm font-medium text-white mb-2">{eventName}</h3>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Total Registered:</span>
                      <span className="text-slate-200 font-medium">{stats.total}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Present:</span>
                      <span className="text-emerald-400 font-medium">{stats.present}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Absent:</span>
                      <span className="text-red-400 font-medium">{stats.absent}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Attendance Rate:</span>
                      <span className="text-sky-400 font-medium">{percentage}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Manual Check-in Methods */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <h2 className="text-lg font-medium text-white mb-4">Manual Check-in</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {/* QR Scanner */}
          <div>
            <h3 className="text-sm font-medium text-slate-300 mb-2">QR Code Scanner</h3>
            <form action={handleAttendanceAction} className="space-y-2">
              <div>
                <input
                  type="text"
                  name="entryCode"
                  placeholder="Scan QR code or enter entry code"
                  className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                />
              </div>
              <button
                type="submit"
                name="action"
                value="checkin_by_code"
                className="w-full rounded-md bg-sky-700 px-3 py-2 text-xs font-medium text-white hover:bg-sky-600"
              >
                Check In (QR/Entry Code)
              </button>
            </form>
          </div>

          {/* Entry Code */}
          <div>
            <h3 className="text-sm font-medium text-slate-300 mb-2">Entry Code</h3>
            <form action={handleAttendanceAction} className="space-y-2">
              <div>
                <input
                  type="text"
                  name="entryCode"
                  placeholder="Enter entry code manually"
                  className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                />
              </div>
              <button
                type="submit"
                name="action"
                value="checkin_by_code"
                className="w-full rounded-md bg-emerald-700 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-600"
              >
                Check In (Entry Code)
              </button>
            </form>
          </div>

          {/* Registration ID */}
          <div>
            <h3 className="text-sm font-medium text-slate-300 mb-2">Registration ID</h3>
            <form action={handleAttendanceAction} className="space-y-2">
              <div>
                <input
                  type="text"
                  name="registrationId"
                  placeholder="Enter registration ID"
                  className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                />
              </div>
              <button
                type="submit"
                name="action"
                value="checkin_by_id"
                className="w-full rounded-md bg-amber-700 px-3 py-2 text-xs font-medium text-white hover:bg-amber-600"
              >
                Check In (Registration ID)
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-lg font-medium text-white">Checked In</h2>
          {attendanceList.length === 0 ? (
            <p className="text-sm text-slate-400">No one checked in yet.</p>
          ) : (
            <div className="space-y-2 text-sm">
              {attendanceList.map((a: any) => (
                <div
                  key={a.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/60 p-3"
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1">
                      <p className="font-medium text-white">{a.event?.title ?? 'Event'}</p>
                      <p className="text-xs text-slate-300">
                        {a.user?.full_name ?? 'User'} · {a.entryCode ?? 'N/A'}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Checked in at {new Date(a.checkedInAt).toLocaleString()}
                      </p>
                    </div>
                    <form action={handleAttendanceAction}>
                      <input type="hidden" name="registrationId" value={a.registrationId} />
                      <button
                        type="submit"
                        name="action"
                        value="undo"
                        className="rounded-md border border-slate-600 px-3 py-1 text-[11px] font-medium text-slate-100 hover:border-slate-400"
                      >
                        Undo check-in
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-medium text-white">Not Checked In</h2>
          {notCheckedIn.length === 0 ? (
            <p className="text-sm text-slate-400">All confirmed registrations are checked in.</p>
          ) : (
            <div className="space-y-2 text-sm">
              {notCheckedIn.map((r: any) => (
                <div
                  key={r.registrationId}
                  className="rounded-xl border border-slate-800 bg-slate-900/60 p-3"
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1">
                      <p className="font-medium text-white">{r.event?.title ?? 'Event'}</p>
                      <p className="text-xs text-slate-300">
                        {r.user?.full_name ?? 'User'} · {r.entryCode ?? 'N/A'}
                      </p>
                      <p className="text-[11px] text-slate-400">Confirmed registration</p>
                    </div>
                    <form action={handleAttendanceAction}>
                      <input type="hidden" name="registrationId" value={r.registrationId} />
                      <button
                        type="submit"
                        name="action"
                        value="checkin"
                        className="rounded-md bg-emerald-700 px-3 py-1 text-[11px] font-medium text-white hover:bg-emerald-600"
                      >
                        Check in
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
