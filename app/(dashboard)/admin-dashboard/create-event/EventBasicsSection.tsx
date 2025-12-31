'use client';

import { useCreateEvent } from './CreateEventProvider';

export function EventBasicsSection() {
  const { state, updateField, setError, clearError } = useCreateEvent();

  const handleInputChange = (field: string, value: string) => {
    updateField(field as any, value);
    
    // Basic validation
    if (field === 'title' && !value.trim()) {
      setError('title', 'Event title is required');
    } else if (field === 'title') {
      clearError('title');
    }
    
    if (field === 'description' && !value.trim()) {
      setError('description', 'Event description is required');
    } else if (field === 'description') {
      clearError('description');
    }
    
    if (field === 'location' && !value.trim()) {
      setError('location', 'Location is required');
    } else if (field === 'location') {
      clearError('location');
    }
  };

  const handleDateChange = (value: string) => {
    updateField('event_date', value);
    
    if (!value) {
      setError('event_date', 'Event date is required');
    } else {
      const eventDate = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (eventDate < today) {
        setError('event_date', 'Event date must be today or in the future');
      } else {
        clearError('event_date');
      }
    }
  };

  const handleTimeChange = (field: 'start_time' | 'end_time', value: string) => {
    updateField(field, value);
    
    if (!value) {
      setError(field, `${field === 'start_time' ? 'Start' : 'End'} time is required`);
    } else {
      clearError(field);
      
      // Validate end time is after start time
      if (field === 'end_time' && state.data.start_time) {
        const start = new Date(`2000-01-01T${state.data.start_time}`);
        const end = new Date(`2000-01-01T${value}`);
        if (end <= start) {
          setError('end_time', 'End time must be after start time');
        } else {
          clearError('end_time');
        }
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="border-b border-slate-700 pb-2">
        <h2 className="text-lg font-semibold text-white">Event Basics</h2>
        <p className="text-sm text-slate-400">Required information about your event</p>
      </div>

      <div className="grid gap-4">
        {/* Event Title */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-slate-300 mb-1">
            Event Title <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            id="title"
            value={state.data.title}
            onChange={(e) => handleInputChange('title', e.target.value)}
            className={`w-full rounded-lg border bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 ${
              state.errors.title ? 'border-red-500' : 'border-slate-600'
            }`}
            placeholder="Enter event title"
          />
          {state.errors.title && (
            <p className="mt-1 text-sm text-red-400">{state.errors.title}</p>
          )}
        </div>

        {/* Event Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-slate-300 mb-1">
            Event Description <span className="text-red-400">*</span>
          </label>
          <textarea
            id="description"
            value={state.data.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            rows={4}
            className={`w-full rounded-lg border bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-vertical ${
              state.errors.description ? 'border-red-500' : 'border-slate-600'
            }`}
            placeholder="Describe your event in detail"
          />
          {state.errors.description && (
            <p className="mt-1 text-sm text-red-400">{state.errors.description}</p>
          )}
        </div>

        {/* Location */}
        <div>
          <label htmlFor="location" className="block text-sm font-medium text-slate-300 mb-1">
            Location <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            id="location"
            value={state.data.location}
            onChange={(e) => handleInputChange('location', e.target.value)}
            className={`w-full rounded-lg border bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 ${
              state.errors.location ? 'border-red-500' : 'border-slate-600'
            }`}
            placeholder="Event location or venue"
          />
          {state.errors.location && (
            <p className="mt-1 text-sm text-red-400">{state.errors.location}</p>
          )}
        </div>

        {/* Event Date */}
        <div>
          <label htmlFor="event_date" className="block text-sm font-medium text-slate-300 mb-1">
            Event Date <span className="text-red-400">*</span>
          </label>
          <input
            type="date"
            id="event_date"
            value={state.data.event_date}
            onChange={(e) => handleDateChange(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className={`w-full rounded-lg border bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 ${
              state.errors.event_date ? 'border-red-500' : 'border-slate-600'
            }`}
          />
          {state.errors.event_date && (
            <p className="mt-1 text-sm text-red-400">{state.errors.event_date}</p>
          )}
        </div>

        {/* Start and End Times */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="start_time" className="block text-sm font-medium text-slate-300 mb-1">
              Start Time <span className="text-red-400">*</span>
            </label>
            <input
              type="time"
              id="start_time"
              value={state.data.start_time}
              onChange={(e) => handleTimeChange('start_time', e.target.value)}
              className={`w-full rounded-lg border bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                state.errors.start_time ? 'border-red-500' : 'border-slate-600'
              }`}
            />
            {state.errors.start_time && (
              <p className="mt-1 text-sm text-red-400">{state.errors.start_time}</p>
            )}
          </div>

          <div>
            <label htmlFor="end_time" className="block text-sm font-medium text-slate-300 mb-1">
              End Time <span className="text-red-400">*</span>
            </label>
            <input
              type="time"
              id="end_time"
              value={state.data.end_time}
              onChange={(e) => handleTimeChange('end_time', e.target.value)}
              className={`w-full rounded-lg border bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                state.errors.end_time ? 'border-red-500' : 'border-slate-600'
              }`}
            />
            {state.errors.end_time && (
              <p className="mt-1 text-sm text-red-400">{state.errors.end_time}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
