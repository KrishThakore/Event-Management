import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase-server';

interface IncomingFormField {
  id?: string;
  label: string;
  field_type: 'text' | 'number' | 'select' | 'file';
  required: boolean;
  options?: string[];
  disabled?: boolean;
  original_required?: boolean;
}

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
    const eventInput = body?.event;
    const formFields = (body?.form_fields ?? []) as IncomingFormField[];
    const allowCapacityOverride = body?.allow_capacity_override === true;

    if (!eventId) {
      return NextResponse.json({ success: false, error: 'Missing event_id' }, { status: 400 });
    }

    if (!eventInput) {
      return NextResponse.json({ success: false, error: 'Missing event payload' }, { status: 400 });
    }

    const {
      data: existingEvent,
      error: existingEventError
    } = await supabase
      .from('events')
      .select(
        'id,title,description,location,event_date,start_time,end_time,capacity,is_registration_open,status,price,visibility,assigned_organizer'
      )
      .eq('id', eventId)
      .single();

    if (existingEventError || !existingEvent) {
      return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 });
    }

    // Capacity safeguard: count confirmed registrations
    const { count: confirmedCount } = await supabase
      .from('registrations')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('status', 'CONFIRMED');

    const normalizedCapacity = Number(eventInput.capacity ?? existingEvent.capacity ?? 0);
    if (!Number.isFinite(normalizedCapacity) || normalizedCapacity <= 0) {
      return NextResponse.json(
        { success: false, error: 'Capacity must be greater than 0' },
        { status: 400 }
      );
    }

    if ((confirmedCount ?? 0) > normalizedCapacity && !allowCapacityOverride) {
      return NextResponse.json(
        {
          success: false,
          error: 'Capacity is lower than confirmed registrations',
          code: 'CAPACITY_BELOW_CONFIRMED',
          confirmed_registrations: confirmedCount ?? 0
        },
        { status: 400 }
      );
    }

    // Time validation
    if (!eventInput.start_time || !eventInput.end_time || !eventInput.event_date) {
      return NextResponse.json(
        { success: false, error: 'Missing required date/time fields' },
        { status: 400 }
      );
    }

    const start = new Date(`2000-01-01T${eventInput.start_time}`);
    const end = new Date(`2000-01-01T${eventInput.end_time}`);
    if (
      !(start instanceof Date) ||
      !(end instanceof Date) ||
      isNaN(start.getTime()) ||
      isNaN(end.getTime()) ||
      end <= start
    ) {
      return NextResponse.json(
        { success: false, error: 'End time must be after start time' },
        { status: 400 }
      );
    }

    // Past-event restriction: only allow description/location edits
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const existingEventDate = new Date(existingEvent.event_date as string);

    if (existingEventDate < today) {
      const changingDateOrTime =
        eventInput.event_date !== existingEvent.event_date ||
        eventInput.start_time !== existingEvent.start_time ||
        eventInput.end_time !== existingEvent.end_time;

      const changingCapacity =
        typeof eventInput.capacity !== 'undefined' &&
        Number(eventInput.capacity) !== Number(existingEvent.capacity ?? 0);

      if (changingDateOrTime || changingCapacity) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Past events can only be edited for description and location. Date, time, and capacity cannot be changed.'
          },
          { status: 400 }
        );
      }
    }

    // Pricing & registration normalization
    const eventType: 'free' | 'paid' = eventInput.event_type === 'paid' ? 'paid' : 'free';
    let price = Number(eventInput.price ?? 0);
    if (eventType === 'paid') {
      if (!Number.isFinite(price) || price <= 0) {
        return NextResponse.json(
          { success: false, error: 'Price must be greater than 0 for paid events' },
          { status: 400 }
        );
      }
    } else {
      price = 0;
    }

    const registrationStatus: 'open' | 'closed' =
      eventInput.registration_status === 'closed' ? 'closed' : 'open';

    let nextStatus: 'approved' | 'draft' | 'cancelled' = existingEvent.status as any;
    if (eventInput.status === 'cancelled') {
      nextStatus = 'cancelled';
    } else if (eventInput.save_mode === 'draft') {
      nextStatus = 'draft';
    } else if (eventInput.save_mode === 'publish') {
      nextStatus = 'approved';
    }

    const visibility: 'public' | 'hidden' =
      eventInput.visibility === 'hidden' ? 'hidden' : 'public';

    const updatedEventPayload: Record<string, any> = {
      title: eventInput.title ?? existingEvent.title,
      description: eventInput.description ?? existingEvent.description,
      location: eventInput.location ?? existingEvent.location,
      event_date: eventInput.event_date ?? existingEvent.event_date,
      start_time: eventInput.start_time ?? existingEvent.start_time,
      end_time: eventInput.end_time ?? existingEvent.end_time,
      capacity: normalizedCapacity,
      is_registration_open: registrationStatus === 'open',
      price,
      status: nextStatus,
      visibility,
      assigned_organizer:
        typeof eventInput.assigned_organizer !== 'undefined'
          ? eventInput.assigned_organizer
          : existingEvent.assigned_organizer ?? null
    };

    if (nextStatus === 'cancelled') {
      updatedEventPayload.is_registration_open = false;
    }

    // Compute event-level changed fields diff
    const changedFields: Record<string, { old: any; new: any }> = {};
    for (const key of Object.keys(updatedEventPayload)) {
      const oldVal = (existingEvent as any)[key];
      const newVal = updatedEventPayload[key];
      const oldJson = oldVal === undefined ? null : JSON.stringify(oldVal);
      const newJson = newVal === undefined ? null : JSON.stringify(newVal);
      if (oldJson !== newJson) {
        changedFields[key] = { old: oldVal, new: newVal };
      }
    }

    const nowIso = new Date().toISOString();

    // Handle form field updates
    const { data: existingFields, error: existingFieldsError } = await supabase
      .from('event_form_fields')
      .select(
        'id,label,field_type,required,options,disabled,disabled_by,disabled_at,original_required,overridden_by,overridden_at'
      )
      .eq('event_id', eventId);

    if (existingFieldsError) {
      return NextResponse.json(
        { success: false, error: 'Failed to load current form fields' },
        { status: 500 }
      );
    }

    const existingById = new Map<string, any>();
    for (const field of existingFields ?? []) {
      existingById.set(field.id as string, field);
    }

    const incomingById = new Map<string, IncomingFormField>();
    for (const field of formFields) {
      if (field.id) {
        incomingById.set(field.id, field);
      }
    }

    const formFieldChanges: any[] = [];

    // 1) Update existing fields present in payload
    const fieldsToUpdate: any[] = [];
    for (const [id, existing] of existingById.entries()) {
      const incoming = incomingById.get(id);
      if (!incoming) {
        continue;
      }

      const required = !!incoming.required;
      const disabled = !!incoming.disabled;
      const options = incoming.options ?? null;
      const originalRequired =
        typeof existing.original_required === 'boolean'
          ? existing.original_required
          : typeof incoming.original_required === 'boolean'
          ? incoming.original_required
          : required;

      const isOverridden = originalRequired !== required;

      const updatePayload: any = {
        label: incoming.label,
        field_type: incoming.field_type,
        required,
        options,
        disabled,
        original_required: originalRequired,
        overridden_by: isOverridden ? user.id : null,
        overridden_at: isOverridden ? nowIso : null
      };

      if (disabled && !existing.disabled) {
        updatePayload.disabled_by = user.id;
        updatePayload.disabled_at = nowIso;
      }

      fieldsToUpdate.push({ id, updatePayload });

      const fieldDiff: any = {
        id,
        label: { old: existing.label, new: incoming.label },
        required: { old: existing.required, new: required },
        disabled: { old: existing.disabled, new: disabled },
        original_required: { old: existing.original_required, new: originalRequired }
      };
      formFieldChanges.push(fieldDiff);
    }

    for (const item of fieldsToUpdate) {
      const { error } = await supabase
        .from('event_form_fields')
        .update(item.updatePayload)
        .eq('id', item.id);
      if (error) {
        return NextResponse.json(
          { success: false, error: 'Failed to update form fields' },
          { status: 500 }
        );
      }
    }

    // 2) Soft-disable fields removed from payload
    const removedFields: any[] = [];
    for (const [id, existing] of existingById.entries()) {
      if (incomingById.has(id)) continue;

      if (!existing.disabled) {
        const { error } = await supabase
          .from('event_form_fields')
          .update({ disabled: true, disabled_by: user.id, disabled_at: nowIso })
          .eq('id', id);
        if (error) {
          return NextResponse.json(
            { success: false, error: 'Failed to disable removed form fields' },
            { status: 500 }
          );
        }

        removedFields.push({ id, label: existing.label });
      }
    }

    // 3) Insert new fields (without matching existing id)
    const newFieldsToInsert: any[] = [];
    for (const field of formFields) {
      if (field.id && existingById.has(field.id)) continue;

      const required = !!field.required;
      const disabled = !!field.disabled;
      const originalRequired =
        typeof field.original_required === 'boolean' ? field.original_required : required;
      const isOverridden = originalRequired !== required;

      newFieldsToInsert.push({
        event_id: eventId,
        label: field.label,
        field_type: field.field_type,
        required,
        options: field.options ?? null,
        disabled,
        disabled_by: disabled ? user.id : null,
        disabled_at: disabled ? nowIso : null,
        original_required: originalRequired,
        overridden_by: isOverridden ? user.id : null,
        overridden_at: isOverridden ? nowIso : null
      });
    }

    if (newFieldsToInsert.length > 0) {
      const { error } = await supabase
        .from('event_form_fields')
        .insert(newFieldsToInsert);
      if (error) {
        return NextResponse.json(
          { success: false, error: 'Failed to insert new form fields' },
          { status: 500 }
        );
      }
    }

    if (removedFields.length > 0) {
      changedFields.form_fields_removed = { old: removedFields, new: [] };
    }
    if (formFieldChanges.length > 0) {
      changedFields.form_fields_updated = { old: formFieldChanges, new: [] };
    }

    // Finally, update the event row
    const { data: updatedEvent, error: updateError } = await supabase
      .from('events')
      .update(updatedEventPayload)
      .eq('id', eventId)
      .select()
      .single();

    if (updateError || !updatedEvent) {
      return NextResponse.json(
        { success: false, error: 'Failed to update event' },
        { status: 500 }
      );
    }

    // Log admin action
    const { error: logError } = await supabase.from('admin_logs').insert({
      admin_id: user.id,
      action: 'UPDATE_EVENT',
      details: {
        event_id: eventId,
        changed_fields: changedFields,
        timestamp: nowIso
      }
    });

    if (logError) {
      console.error('Failed to log admin UPDATE_EVENT action', logError);
    }

    return NextResponse.json({ success: true, event: updatedEvent }, { status: 200 });
  } catch (error: any) {
    console.error('update-event API error', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

