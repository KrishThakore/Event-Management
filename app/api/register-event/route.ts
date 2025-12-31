import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { registerForEvent } from '@/lib/edge-functions';
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

  const eventId = body?.event_id as string | undefined;
  if (!eventId) {
    return NextResponse.json({ success: false, error: 'Missing event_id' }, { status: 400 });
  }
  const answers = Array.isArray(body?.answers) ? body.answers : [];

  try {
    const data = await registerForEvent(eventId, answers);
    return NextResponse.json({ success: true, ...data });
  } catch (error: any) {
    console.error('register-event failed', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Registration failed' },
      { status: 400 }
    );
  }
}
