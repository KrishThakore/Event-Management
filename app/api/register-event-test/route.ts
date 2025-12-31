import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const supabaseUser = getSupabaseServerClient();

  const {
    data: { user }
  } = await supabaseUser.auth.getUser();

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
    const admin = getSupabaseAdminClient();

    const { data: fields, error: fieldsError } = await admin
      .from('event_form_fields')
      .select('id,required,field_type,options,disabled')
      .eq('event_id', eventId);

    if (fieldsError) {
      throw new Error(fieldsError.message);
    }

    const activeFields = (fields || []).filter((f: any) => !f.disabled);

    for (const field of activeFields) {
      if (!field.required) continue;
      const answer = answers.find((a: any) => a.field_id === field.id);
      if (!answer || typeof answer.value !== 'string' || !answer.value.trim()) {
        throw new Error('Missing required field response');
      }
      if (field.field_type === 'select' && Array.isArray(field.options) && field.options.length > 0) {
        if (!field.options.includes(answer.value)) {
          throw new Error('Invalid option selected');
        }
      }
    }

    const { data: registrationId, error } = await admin.rpc('register_for_event', {
      p_event_id: eventId,
      p_user_id: user.id
    });

    if (error || !registrationId) {
      throw new Error(error?.message || 'Unable to register');
    }

    if (answers.length > 0) {
      const payload = answers.map((a: any) => ({
        registration_id: registrationId,
        field_id: a.field_id,
        value: a.value
      }));
      const { error: responsesError } = await admin
        .from('registration_responses')
        .insert(payload);
      if (responsesError) {
        throw new Error(responsesError.message);
      }
    }

    const { error: confirmError } = await admin.rpc('confirm_registration', {
      p_registration_id: registrationId
    });

    if (confirmError) {
      throw new Error(confirmError.message);
    }

    return NextResponse.json({ success: true, free: true, registration_id: registrationId });
  } catch (error: any) {
    console.error('register-event-test failed', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Registration failed' },
      { status: 400 }
    );
  }
}
