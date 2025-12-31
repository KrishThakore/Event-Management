import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { checkIn } from '@/lib/edge-functions';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const supabase = getSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  const limit = rateLimit(request, user.id);
  if (!limit.allowed) {
    return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid body' }, { status: 400 });
  }

  try {
    const data = await checkIn({
      registration_id: body.registration_id,
      entry_code: body.entry_code
    });
    return NextResponse.json({ success: true, ...data });
  } catch (error: any) {
    console.error('check-in failed', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Check-in failed' },
      { status: 400 }
    );
  }
}
