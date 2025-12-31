'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronDown, Edit, Calendar, MapPin, Users } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Event {
  id: string;
  title: string;
  location: string;
  event_date: string;
  start_time: string;
  end_time: string;
  status: string;
}

export default function EditEventsDropdown() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase
          .from('events')
          .select('id, title, location, event_date, start_time, end_time, status')
          .order('event_date', { ascending: true })
          .limit(10); // Limit to 10 most recent events

        if (error) {
          setError(error.message);
          return;
        }

        setEvents(data || []);
      } catch (err) {
        setError('Failed to load events');
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-between rounded-md px-3 py-2 text-xs text-slate-400">
        <span>Loading events...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-between rounded-md px-3 py-2 text-xs text-red-400">
        <span>Error loading events</span>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-between rounded-md px-3 py-2 text-xs text-slate-400">
        <span>No events found</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center justify-between rounded-md px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 hover:text-white w-full">
        <span>Edit Events</span>
        <ChevronDown className="h-3 w-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 bg-slate-900 border-slate-700">
        <DropdownMenuLabel className="text-slate-200 text-xs font-semibold">
          Select Event to Edit
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-slate-700" />
        
        {events.map((event) => (
          <DropdownMenuItem key={event.id} className="text-slate-200 hover:bg-slate-800 p-0">
            <Link
              href={`/admin-dashboard/events/${event.id}/edit`}
              className="flex items-start space-x-2 w-full p-2"
            >
              <Edit className="h-3 w-3 mt-0.5 text-slate-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-slate-100 truncate">
                  {event.title}
                </div>
                <div className="flex items-center space-x-2 mt-1 text-[10px] text-slate-400">
                  <div className="flex items-center space-x-1">
                    <Calendar className="h-2.5 w-2.5" />
                    <span>{new Date(event.event_date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <MapPin className="h-2.5 w-2.5" />
                    <span className="truncate max-w-[100px]">{event.location}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2 mt-0.5">
                  <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                    event.status === 'approved' ? 'bg-green-800/50 text-green-200' :
                    event.status === 'draft' ? 'bg-yellow-800/50 text-yellow-200' :
                    event.status === 'cancelled' ? 'bg-red-800/50 text-red-200' :
                    'bg-slate-800/50 text-slate-200'
                  }`}>
                    {event.status}
                  </span>
                  <span className="text-[9px] text-slate-500">
                    {event.start_time} - {event.end_time}
                  </span>
                </div>
              </div>
            </Link>
          </DropdownMenuItem>
        ))}
        
        <DropdownMenuSeparator className="bg-slate-700" />
        <DropdownMenuItem className="text-slate-400 hover:bg-slate-800">
          <Link
            href="/admin-dashboard/events"
            className="flex items-center space-x-2 w-full p-2"
          >
            <Users className="h-3 w-3" />
            <span className="text-xs">View All Events</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
