'use client';

import { useCreateEvent } from './CreateEventProvider';

export function CapacitySection() {
  const { state, updateField, setError, clearError } = useCreateEvent();

  const handleCapacityChange = (value: string) => {
    const numValue = parseInt(value) || 0;
    updateField('total_capacity', numValue);
    
    if (numValue <= 0) {
      setError('total_capacity', 'Capacity must be greater than 0');
    } else {
      clearError('total_capacity');
    }
  };

  return (
    <div className="space-y-4">
      <div className="border-b border-slate-700 pb-2">
        <h2 className="text-lg font-semibold text-white">Capacity & Registration Control</h2>
        <p className="text-sm text-slate-400">Set event capacity and registration settings</p>
      </div>

      <div className="grid gap-4">
        {/* Total Capacity */}
        <div>
          <label htmlFor="total_capacity" className="block text-sm font-medium text-slate-300 mb-1">
            Total Capacity <span className="text-red-400">*</span>
          </label>
          <input
            type="number"
            id="total_capacity"
            value={state.data.total_capacity}
            onChange={(e) => handleCapacityChange(e.target.value)}
            min="1"
            className={`w-full rounded-lg border bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 ${
              state.errors.total_capacity ? 'border-red-500' : 'border-slate-600'
            }`}
            placeholder="Maximum number of attendees"
          />
          {state.errors.total_capacity && (
            <p className="mt-1 text-sm text-red-400">{state.errors.total_capacity}</p>
          )}
          <p className="mt-1 text-xs text-slate-500">Maximum number of people who can register for this event</p>
        </div>

        {/* Registration Status */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Registration Status
          </label>
          <div className="space-y-2">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                name="registration_status"
                value="open"
                checked={state.data.registration_status === 'open'}
                onChange={() => updateField('registration_status', 'open')}
                className="w-4 h-4 text-sky-500 bg-slate-800 border-slate-600 focus:ring-sky-500 focus:ring-2"
              />
              <div className="flex-1">
                <span className="text-sm text-white">Open</span>
                <p className="text-xs text-slate-400">Users can register immediately</p>
              </div>
            </label>
            
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                name="registration_status"
                value="closed"
                checked={state.data.registration_status === 'closed'}
                onChange={() => updateField('registration_status', 'closed')}
                className="w-4 h-4 text-sky-500 bg-slate-800 border-slate-600 focus:ring-sky-500 focus:ring-2"
              />
              <div className="flex-1">
                <span className="text-sm text-white">Closed</span>
                <p className="text-xs text-slate-400">Registration is not available</p>
              </div>
            </label>
          </div>
        </div>

        {/* Auto-close Registration */}
        <div>
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              id="auto_close_when_full"
              checked={state.data.auto_close_when_full}
              onChange={(e) => updateField('auto_close_when_full', e.target.checked)}
              className="w-4 h-4 text-sky-500 bg-slate-800 border-slate-600 rounded focus:ring-sky-500 focus:ring-2"
            />
            <div className="flex-1">
              <span className="text-sm text-white">Auto-close registration when capacity is reached</span>
              <p className="text-xs text-slate-400">
                Automatically close registration when the event reaches maximum capacity
              </p>
            </div>
          </label>
        </div>

        {/* Info Box */}
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
          <div className="flex items-start space-x-2">
            <svg className="w-4 h-4 text-sky-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div className="text-xs text-slate-300">
              <p className="font-medium mb-1">Capacity Enforcement</p>
              <p>Capacity enforcement will be handled by the existing database functions. Admins can create events with registration closed, and the auto-close feature will prevent overbooking when enabled.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
