'use client';

import { useCreateEvent } from './CreateEventProvider';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

export function VisibilitySection() {
  const { state, updateField } = useCreateEvent();

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <h3 className="mb-2 text-sm font-medium">Visibility</h3>
          <RadioGroup
            value={state.data.visibility}
            onValueChange={(value: 'public' | 'hidden') => updateField('visibility', value)}
            className="space-y-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="public" id="public" />
              <Label htmlFor="public">Public (visible to users)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="hidden" id="hidden" />
              <Label htmlFor="hidden">Hidden (admin-only)</Label>
            </div>
          </RadioGroup>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-medium">Save Mode</h3>
          <RadioGroup
            value={state.data.save_mode}
            onValueChange={(value: 'publish' | 'draft') => updateField('save_mode', value)}
            className="space-y-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="publish" id="publish" />
              <Label htmlFor="publish">Publish now</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="draft" id="draft" />
              <Label htmlFor="draft">Save as draft</Label>
            </div>
          </RadioGroup>
        </div>
      </div>
    </div>
  );
}
