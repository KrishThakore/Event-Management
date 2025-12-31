'use client';

import { useCreateEvent } from './CreateEventProvider';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Organizer = {
  id: string;
  full_name: string;
  email: string;
};

export function OrganizerSection({ organizers }: { organizers: Organizer[] }) {
  const { state, updateField } = useCreateEvent();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="organizer">Assign Organizer (Optional)</Label>
        <Select
          value={state.data.assigned_organizer || ''}
          onValueChange={(value: string) => updateField('assigned_organizer', value === '__admin' ? null : value || null)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select an organizer (optional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__admin">Created by Admin</SelectItem>
            {organizers.map((organizer) => (
              <SelectItem key={organizer.id} value={organizer.id}>
                {organizer.full_name} ({organizer.email})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-slate-400">
          Assigning an organizer will give them management access to this event.
        </p>
      </div>
    </div>
  );
}
