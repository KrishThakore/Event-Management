import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 403 });
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const eventId = body?.eventId as string | undefined;

    if (!eventId) {
      return NextResponse.json({ success: false, error: 'Missing eventId' }, { status: 400 });
    }

    // Get the full event data including form fields
    const { data: fullEvent, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (eventError || !fullEvent) {
      return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 });
    }

    // Get form fields for the event
    const { data: formFields, error: formFieldsError } = await supabase
      .from('event_form_fields')
      .select('*')
      .eq('event_id', eventId);

    if (formFieldsError) {
      return NextResponse.json({ success: false, error: 'Failed to load form fields' }, { status: 500 });
    }

    // Create cloned event
    const clonedEventData = {
      title: body?.title || `${fullEvent.title} (Copy)`,
      description: fullEvent.description,
      location: fullEvent.location,
      event_date: body?.event_date || new Date().toISOString().split('T')[0], // Default to today or provided date
      start_time: fullEvent.start_time,
      end_time: fullEvent.end_time,
      capacity: fullEvent.capacity,
      is_registration_open: false, // Start with registration closed
      status: 'draft',
      price: fullEvent.price,
      visibility: 'hidden',
      created_by: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: clonedEvent, error: cloneError } = await supabase
      .from('events')
      .insert(clonedEventData)
      .select()
      .single();

    if (cloneError || !clonedEvent) {
      return NextResponse.json({ success: false, error: 'Failed to clone event' }, { status: 500 });
    }

    // Clone form fields if they exist
    if (formFields && formFields.length > 0) {
      const clonedFormFields = formFields.map((field: any) => ({
        event_id: clonedEvent.id,
        label: field.label,
        field_type: field.field_type,
        required: field.required,
        options: field.options,
        disabled: false,
        original_required: field.original_required,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      const { error: formFieldsCloneError } = await supabase
        .from('event_form_fields')
        .insert(clonedFormFields);

      if (formFieldsCloneError) {
        // Log the error but don't fail the entire operation
        console.error('Failed to clone form fields:', formFieldsCloneError);
      }
    }

    // Log clone action
    const { error: logError } = await supabase.from('admin_logs').insert({
      admin_id: user.id,
      action: 'EVENT_CLONE',
      details: {
        original_event_id: eventId,
        cloned_event_id: clonedEvent.id,
        original_title: fullEvent.title,
        cloned_title: clonedEventData.title
      }
    });

    if (logError) {
      console.error('Failed to log clone action:', logError);
    }

    return NextResponse.json({ 
      success: true, 
      event: clonedEvent,
      message: 'Event cloned successfully'
    }, { status: 200 });

  } catch (error: any) {
    console.error('clone-event API error', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
