'use client';

import { useCreateEvent } from './CreateEventProvider';
import { format } from 'date-fns';

export function ReviewSection() {
  const { state } = useCreateEvent();
  const { data } = state;

  const formatTime = (timeString: string) => {
    if (!timeString) return 'Not set';
    return format(new Date(`2000-01-01T${timeString}`), 'h:mm a');
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Not set';
    return format(new Date(dateString), 'PPP');
  };

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Event Details</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <h4 className="text-sm font-medium text-slate-400">Title</h4>
            <p className="text-white">{data.title || 'Not set'}</p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-slate-400">Location</h4>
            <p className="text-white">{data.location || 'Not set'}</p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-slate-400">Date</h4>
            <p className="text-white">{formatDate(data.event_date)}</p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-slate-400">Time</h4>
            <p className="text-white">
              {data.start_time ? formatTime(data.start_time) : 'Not set'}
              {data.end_time ? ` - ${formatTime(data.end_time)}` : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium">Registration & Capacity</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <h4 className="text-sm font-medium text-slate-400">Total Capacity</h4>
            <p className="text-white">{data.total_capacity || 'Unlimited'}</p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-slate-400">Registration Status</h4>
            <p className="text-white capitalize">
              {data.registration_status || 'Not set'}
            </p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-slate-400">Auto-close when full</h4>
            <p className="text-white">{data.auto_close_when_full ? 'Yes' : 'No'}</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium">Pricing</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <h4 className="text-sm font-medium text-slate-400">Event Type</h4>
            <p className="text-white capitalize">{data.event_type || 'Not set'}</p>
          </div>
          {data.event_type === 'paid' && (
            <div>
              <h4 className="text-sm font-medium text-slate-400">Price</h4>
              <p className="text-white">
                ₹{data.price?.toFixed(2)} {data.currency}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium">Visibility & Publishing</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <h4 className="text-sm font-medium text-slate-400">Visibility</h4>
            <p className="text-white capitalize">{data.visibility || 'Not set'}</p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-slate-400">Status</h4>
            <p className="text-white capitalize">
              {data.save_mode === 'publish' ? 'Published (Approved)' : 'Draft'}
            </p>
          </div>
        </div>
      </div>

      {data.form_fields && data.form_fields.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Registration Form Fields</h3>
          <div className="space-y-2">
            {data.form_fields.map((field, index) => (
              <div key={index} className="rounded-md border border-slate-700 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{field.label}</span>
                  <span className="text-sm text-slate-400">
                    {field.field_type} • {field.required ? 'Required' : 'Optional'}
                  </span>
                </div>
                {field.options && field.options.length > 0 && (
                  <div className="mt-2">
                    <h4 className="text-sm font-medium text-slate-400">Options:</h4>
                    <p className="text-sm text-slate-300">
                      {field.options.join(', ')}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
