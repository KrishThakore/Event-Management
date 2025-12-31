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

async function getEventsWithFormFields() {
  const supabase = getSupabaseServerClient();

  const { data: events } = await supabase
    .from('events')
    .select('id,title,status,created_by')
    .eq('status', 'approved')
    .order('title', { ascending: true });

  // Get form fields for each event
  const eventsWithFields = await Promise.all(
    (events ?? []).map(async (event: any) => {
      const { data: formFields } = await supabase
        .from('event_form_fields')
        .select('id,label,field_type,required,options')
        .eq('event_id', event.id)
        .order('created_at');

      return {
        ...event,
        registration_form_fields: formFields || []
      };
    })
  );

  return eventsWithFields;
}

async function handleFormFieldAction(formData: FormData) {
  'use server';

  const action = formData.get('action') as string | null;
  const eventId = formData.get('eventId') as string | null;
  const fieldId = formData.get('fieldId') as string | null;

  if (!action || !eventId) {
    redirect('/admin-dashboard/form-control');
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

  const { data: event } = await supabase
    .from('events')
    .select('id,created_by')
    .eq('id', eventId)
    .single();

  if (!event) {
    redirect('/admin-dashboard/form-control');
  }

  let logAction = '';

  if (action === 'disable_field' && fieldId) {
    // Disable unsafe field - update event_form_fields table
    await supabase
      .from('event_form_fields')
      .update({ 
        disabled: true, 
        disabled_by: user.id, 
        disabled_at: new Date().toISOString() 
      })
      .eq('id', fieldId)
      .eq('event_id', eventId);
    
    logAction = 'FORM_FIELD_DISABLE';
  } else if (action === 'enable_field' && fieldId) {
    // Enable previously disabled field
    await supabase
      .from('event_form_fields')
      .update({ 
        disabled: false, 
        disabled_by: null, 
        disabled_at: null 
      })
      .eq('id', fieldId)
      .eq('event_id', eventId);
    
    logAction = 'FORM_FIELD_ENABLE';
  } else if (action === 'override_field_required' && fieldId) {
    // Override field to make it required (safety)
    await supabase
      .from('event_form_fields')
      .update({ 
        required: true, 
        overridden_by: user.id, 
        overridden_at: new Date().toISOString() 
      })
      .eq('id', fieldId)
      .eq('event_id', eventId);
    
    logAction = 'FORM_FIELD_OVERRIDE_REQUIRED';
  } else if (action === 'remove_field_override' && fieldId) {
    // Remove override - restore original required status
    const { data: field } = await supabase
      .from('event_form_fields')
      .select('original_required')
      .eq('id', fieldId)
      .single();
    
    await supabase
      .from('event_form_fields')
      .update({ 
        required: field?.original_required || false, 
        overridden_by: null, 
        overridden_at: null 
      })
      .eq('id', fieldId)
      .eq('event_id', eventId);
    
    logAction = 'FORM_FIELD_REMOVE_OVERRIDE';
  }

  await supabase.from('admin_logs').insert({
    admin_id: user.id,
    action: logAction,
    details: {
      event_id: eventId,
      field_id: fieldId,
      action: action
    }
  });

  redirect('/admin-dashboard/form-control');
}

interface SearchParams {
  event?: string;
}

export default async function AdminFormControlPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin();
  const events = await getEventsWithFormFields();
  const selectedEventId = searchParams?.event;

  const selectedEvent = events.find(event => event.id === selectedEventId) || events[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Form Control</h1>
        <p className="mt-1 text-sm text-slate-400">
          View and manage registration form fields, ensure data safety, and override unsafe configurations.
        </p>
      </div>

      {/* Event selector */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <form className="w-full max-w-xs">
          <select
            name="event"
            defaultValue={selectedEvent?.id || ''}
            className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
          >
            <option value="">Select event</option>
            {events.map((event: any) => (
              <option key={event.id} value={event.id}>
                {event.title}
              </option>
            ))}
          </select>
        </form>
      </div>

      {!selectedEvent ? (
        <p className="text-sm text-slate-400">Select an event to view its registration form fields.</p>
      ) : (
        <div className="space-y-6">
          {/* Event info */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="text-lg font-medium text-white">{selectedEvent.title}</h2>
            <p className="text-sm text-slate-400 mt-1">
              Registration form fields: {selectedEvent.registration_form_fields?.length || 0}
            </p>
          </div>

          {/* Form fields */}
          {(!selectedEvent.registration_form_fields || selectedEvent.registration_form_fields.length === 0) ? (
            <p className="text-sm text-slate-400">No custom registration fields configured for this event.</p>
          ) : (
            <div className="space-y-4">
              <h3 className="text-md font-medium text-white">Registration Fields</h3>
              {selectedEvent.registration_form_fields.map((field: any, index: number) => (
                <div
                  key={field.id || index}
                  className={`rounded-lg border bg-slate-900/60 p-4 ${
                    field.disabled ? 'border-red-700/50 opacity-60' : 'border-slate-800'
                  }`}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-white">{field.label}</h4>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${
                          field.field_type === 'text' ? 'bg-blue-700/30 text-blue-300' :
                          field.field_type === 'email' ? 'bg-green-700/30 text-green-300' :
                          field.field_type === 'phone' ? 'bg-purple-700/30 text-purple-300' :
                          field.field_type === 'number' ? 'bg-indigo-700/30 text-indigo-300' :
                          field.field_type === 'select' ? 'bg-amber-700/30 text-amber-300' :
                          field.field_type === 'file' ? 'bg-pink-700/30 text-pink-300' :
                          'bg-slate-700 text-slate-300'
                        }`}>
                          {field.field_type}
                        </span>
                        {field.required && (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide bg-red-700/30 text-red-300">
                            REQUIRED
                          </span>
                        )}
                        {field.disabled && (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide bg-red-700/30 text-red-300">
                            DISABLED
                          </span>
                        )}
                        {field.overridden_by && (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide bg-amber-700/30 text-amber-300">
                            OVERRIDDEN
                          </span>
                        )}
                      </div>
                      
                      <p className="text-xs text-slate-300">No placeholder</p>
                      
                      {field.options && field.options.length > 0 && (
                        <div className="text-xs text-slate-400">
                          <span className="font-medium">Options:</span> {field.options.join(', ')}
                        </div>
                      )}
                      
                      <div className="text-xs text-slate-500 space-y-1">
                        <div>Field ID: {field.id || `field-${index}`}</div>
                        {field.disabled && (
                          <div>Disabled by admin at {new Date(field.disabled_at).toLocaleString()}</div>
                        )}
                        {field.overridden_by && (
                          <div>Overridden by admin at {new Date(field.overridden_at).toLocaleString()}</div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <form action={handleFormFieldAction}>
                        <input type="hidden" name="eventId" value={selectedEvent.id} />
                        <input type="hidden" name="fieldId" value={field.id || `field-${index}`} />
                        
                        {field.disabled ? (
                          <button
                            type="submit"
                            name="action"
                            value="enable_field"
                            className="rounded-md bg-emerald-700 px-3 py-1 text-[11px] font-medium text-emerald-50 hover:bg-emerald-600"
                          >
                            Enable Field
                          </button>
                        ) : (
                          <button
                            type="submit"
                            name="action"
                            value="disable_field"
                            className="rounded-md bg-red-700 px-3 py-1 text-[11px] font-medium text-red-50 hover:bg-red-600"
                          >
                            Disable Field
                          </button>
                        )}
                        
                        {!field.required && !field.overridden_by && (
                          <button
                            type="submit"
                            name="action"
                            value="override_field_required"
                            className="rounded-md bg-amber-700 px-3 py-1 text-[11px] font-medium text-amber-50 hover:bg-amber-600"
                          >
                            Make Required
                          </button>
                        )}
                        
                        {field.overridden_by && (
                          <button
                            type="submit"
                            name="action"
                            value="remove_field_override"
                            className="rounded-md border border-slate-600 px-3 py-1 text-[11px] font-medium text-slate-100 hover:border-slate-400"
                          >
                            Remove Override
                          </button>
                        )}
                      </form>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Safety guidelines */}
          <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4 text-xs text-slate-400">
            <p className="font-semibold text-slate-300 mb-2">Form Control Guidelines:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li><strong>Disable Field:</strong> Prevent users from filling potentially unsafe fields</li>
              <li><strong>Make Required:</strong> Override organizer settings to ensure critical data collection</li>
              <li><strong>Enable Field:</strong> Restore previously disabled fields</li>
              <li><strong>Remove Override:</strong> Revert to original organizer configuration</li>
              <li>All actions are logged with full audit trail for accountability</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
