'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

interface NotCheckedInItem {
  registrationId: string;
  event: any;
  user: any;
  entryCode?: string | null;
  registrationStatus: string;
}

interface Props {
  notCheckedIn: NotCheckedInItem[];
}

export function AttendanceCheckinClient({ notCheckedIn }: Props) {
  const router = useRouter();
  const [loadingByCode, setLoadingByCode] = useState(false);
  const [loadingById, setLoadingById] = useState(false);
  const [loadingRegistrationId, setLoadingRegistrationId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [notCheckedInState, setNotCheckedInState] = useState<NotCheckedInItem[]>(notCheckedIn);

  async function checkInRequest(body: { entry_code?: string; registration_id?: string }) {
    setErrorMessage(null);
    setSuccessMessage(null);

    const res = await fetch('/api/check-in', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || data.success === false) {
      const message = data?.error || 'Check-in failed';
      setErrorMessage(message);
      return false;
    }

    setSuccessMessage('Attendance marked present successfully.');
    // Refresh server-rendered data (attendance lists, stats)
    router.refresh();
    return true;
  }

  async function handleCheckinByCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const entryCode = (formData.get('entryCode') as string | null)?.trim();
    if (!entryCode) return;

    try {
      setLoadingByCode(true);
      const ok = await checkInRequest({ entry_code: entryCode });
      if (ok) {
        e.currentTarget.reset();
      }
    } finally {
      setLoadingByCode(false);
    }
  }

  async function handleCheckinById(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const registrationId = (formData.get('registrationId') as string | null)?.trim();
    if (!registrationId) return;

    try {
      setLoadingById(true);
      const ok = await checkInRequest({ registration_id: registrationId });
      if (ok) {
        // Optimistically remove this registration from local list
        setNotCheckedInState((prev) => prev.filter((item) => item.registrationId !== registrationId));
        e.currentTarget.reset();
      }
    } finally {
      setLoadingById(false);
    }
  }

  async function handleSingleCheckin(registrationId: string) {
    try {
      setLoadingRegistrationId(registrationId);
      const ok = await checkInRequest({ registration_id: registrationId });
      if (ok) {
        // Optimistically remove from local list so UI updates immediately
        setNotCheckedInState((prev) => prev.filter((item) => item.registrationId !== registrationId));
      }
    } finally {
      setLoadingRegistrationId(null);
    }
  }

  return (
    <>
      {/* Manual Check-in Methods */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <h2 className="text-lg font-medium text-white mb-4">Manual Check-in</h2>
        {errorMessage && (
          <p className="mb-2 text-xs text-red-400">{errorMessage}</p>
        )}
        {successMessage && (
          <p className="mb-2 text-xs text-emerald-400">
            Attendance is marked present successfully.
          </p>
        )}
        <div className="grid gap-4 md:grid-cols-3">
          {/* QR Scanner / Entry Code combined */}
          <div>
            <h3 className="text-sm font-medium text-slate-300 mb-2">QR Code Scanner</h3>
            <form onSubmit={handleCheckinByCode} className="space-y-2">
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
                disabled={loadingByCode}
                className="w-full rounded-md bg-sky-700 px-3 py-2 text-xs font-medium text-white hover:bg-sky-600 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loadingByCode ? 'Checking in…' : 'Check In (QR/Entry Code)'}
              </button>
            </form>
          </div>

          {/* Entry Code only */}
          <div>
            <h3 className="text-sm font-medium text-slate-300 mb-2">Entry Code</h3>
            <form onSubmit={handleCheckinByCode} className="space-y-2">
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
                disabled={loadingByCode}
                className="w-full rounded-md bg-emerald-700 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loadingByCode ? 'Checking in…' : 'Check In (Entry Code)'}
              </button>
            </form>
          </div>

          {/* Registration ID */}
          <div>
            <h3 className="text-sm font-medium text-slate-300 mb-2">Registration ID</h3>
            <form onSubmit={handleCheckinById} className="space-y-2">
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
                disabled={loadingById}
                className="w-full rounded-md bg-amber-700 px-3 py-2 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loadingById ? 'Checking in…' : 'Check In (Registration ID)'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Not Checked In list with client-side check-in */}
      <div className="space-y-3">
        <h2 className="text-lg font-medium text-white">Not Checked In</h2>
        {notCheckedInState.length === 0 ? (
          <p className="text-sm text-slate-400">All confirmed registrations are checked in.</p>
        ) : (
          <div className="space-y-2 text-sm">
            {notCheckedInState.map((r) => (
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
                  <button
                    type="button"
                    onClick={() => handleSingleCheckin(r.registrationId)}
                    disabled={loadingRegistrationId === r.registrationId}
                    className="rounded-md bg-emerald-700 px-3 py-1 text-[11px] font-medium text-white hover:bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loadingRegistrationId === r.registrationId ? 'Checking in…' : 'Check in'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
