'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { EventBasicsSection } from '../../create-event/EventBasicsSection';
import { CapacitySection } from '../../create-event/CapacitySection';
import { PricingSection } from '../../create-event/PricingSection';
import { FormBuilderSection } from '../../create-event/FormBuilderSection';
import { VisibilitySection } from '../../create-event/VisibilitySection';
import { OrganizerSection } from '../../create-event/OrganizerSection';
import { CreateEventProvider, useCreateEvent, FormField, EventData } from '../../create-event/CreateEventProvider';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Check, X, ArrowRight } from 'lucide-react';

interface Event {
  id: string;
  title: string;
  description: string;
  category: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  location: string;
  max_participants: number;
  price: number;
  image_url?: string;
  status: 'draft' | 'published' | 'cancelled';
  registration_deadline?: string;
  organizer_id: string;
  created_at: string;
  updated_at: string;
  form_fields?: FormField[];
}

interface EditEventFormProps {
  initialData: Event;
}

function EditEventFormContent({ initialData }: EditEventFormProps) {
  const { state, setSubmitting, toggleConfirmation, validateForm } = useCreateEvent();
  const router = useRouter();
  const [organizers, setOrganizers] = useState<any[]>([]);

  // Map initial event data to form data structure
  const mapInitialData = (event: Event): Partial<EventData> => ({
    title: event.title,
    description: event.description,
    location: event.location,
    event_date: event.start_date.split('T')[0], // Extract date part
    start_time: event.start_time,
    end_time: event.end_time,
    total_capacity: event.max_participants,
    registration_status: 'open', // Default, could be derived from event status
    auto_close_when_full: true, // Default
    event_type: event.price > 0 ? 'paid' : 'free',
    price: event.price,
    currency: 'INR', // Default
    form_fields: event.form_fields || [],
    visibility: event.status === 'published' ? 'public' : 'hidden',
    save_mode: event.status === 'published' ? 'publish' : 'draft',
    assigned_organizer: event.organizer_id,
  });

  useEffect(() => {
    // Load organizers for the organizer section
    const loadOrganizers = async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data } = await supabase
          .from('users')
          .select('id, email, full_name')
          .eq('role', 'organizer');
        
        if (data) {
          setOrganizers(data);
        }
      } catch (error) {
        console.error('Failed to load organizers:', error);
      }
    };

    loadOrganizers();
  }, []);

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast.error('Please fix all errors before submitting');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/admin/update-event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventId: initialData.id,
          event: {
            title: state.data.title,
            description: state.data.description,
            location: state.data.location,
            event_date: state.data.event_date,
            start_time: state.data.start_time,
            end_time: state.data.end_time,
            capacity: state.data.total_capacity,
            is_registration_open: state.data.registration_status === 'open',
            price: state.data.event_type === 'paid' ? state.data.price : 0,
            status: state.data.save_mode === 'publish' ? 'approved' : 'draft',
            visibility: state.data.visibility,
            assigned_organizer: state.data.assigned_organizer || null,
          },
          form_fields: state.data.form_fields,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        const message = result.error || 'Failed to update event. Please try again.';
        toast.error(message);
        return;
      }

      toast.success('Event updated successfully');
      router.push(`/admin-dashboard/events?updated_event=${encodeURIComponent(initialData.id)}`);
    } catch (error) {
      console.error('Error updating event:', error);
      toast.error('Failed to update event. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate differences for review modal
  const getDifferences = () => {
    const original = mapInitialData(initialData);
    const current = state.data;
    const differences: Array<{ field: string; label: string; original: any; current: any; type: 'text' | 'boolean' | 'number' }> = [];

    const fields: Array<{ key: keyof EventData; label: string; type: 'text' | 'boolean' | 'number' }> = [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'description', label: 'Description', type: 'text' },
      { key: 'location', label: 'Location', type: 'text' },
      { key: 'event_date', label: 'Event Date', type: 'text' },
      { key: 'start_time', label: 'Start Time', type: 'text' },
      { key: 'end_time', label: 'End Time', type: 'text' },
      { key: 'total_capacity', label: 'Capacity', type: 'number' },
      { key: 'registration_status', label: 'Registration Status', type: 'text' },
      { key: 'event_type', label: 'Event Type', type: 'text' },
      { key: 'price', label: 'Price', type: 'number' },
      { key: 'visibility', label: 'Visibility', type: 'text' },
      { key: 'save_mode', label: 'Save Mode', type: 'text' },
    ];

    fields.forEach(({ key, label, type }) => {
      const originalValue = original[key];
      const currentValue = current[key];
      
      if (JSON.stringify(originalValue) !== JSON.stringify(currentValue)) {
        differences.push({
          field: key,
          label,
          original: originalValue,
          current: currentValue,
          type
        });
      }
    });

    return differences;
  };

  const differences = getDifferences();
  const hasChanges = differences.length > 0;

  return (
    <div className="space-y-6">
      {/* Section 1: Event Basics */}
      <Card>
        <CardHeader>
          <CardTitle>Event Basics</CardTitle>
          <CardDescription>Basic information about your event</CardDescription>
        </CardHeader>
        <CardContent>
          <EventBasicsSection />
        </CardContent>
      </Card>

      {/* Section 2: Capacity & Registration */}
      <Card>
        <CardHeader>
          <CardTitle>Capacity & Registration</CardTitle>
          <CardDescription>Set capacity and registration options</CardDescription>
        </CardHeader>
        <CardContent>
          <CapacitySection />
        </CardContent>
      </Card>

      {/* Section 3: Pricing & Payment */}
      <Card>
        <CardHeader>
          <CardTitle>Pricing & Payment</CardTitle>
          <CardDescription>Configure pricing and payment options</CardDescription>
        </CardHeader>
        <CardContent>
          <PricingSection />
        </CardContent>
      </Card>

      {/* Section 4: Registration Form Builder */}
      <Card>
        <CardHeader>
          <CardTitle>Registration Form Builder</CardTitle>
          <CardDescription>Customize the registration form</CardDescription>
        </CardHeader>
        <CardContent>
          <FormBuilderSection />
        </CardContent>
      </Card>

      {/* Section 5: Visibility & Publishing */}
      <Card>
        <CardHeader>
          <CardTitle>Visibility & Publishing</CardTitle>
          <CardDescription>Control event visibility and publishing</CardDescription>
        </CardHeader>
        <CardContent>
          <VisibilitySection />
        </CardContent>
      </Card>

      {/* Section 6: Organizer Assignment */}
      <Card>
        <CardHeader>
          <CardTitle>Organizer Assignment</CardTitle>
          <CardDescription>Assign an organizer (optional)</CardDescription>
        </CardHeader>
        <CardContent>
          <OrganizerSection organizers={organizers} />
        </CardContent>
      </Card>

      {/* Primary submit action */}
      <div className="flex justify-end">
        <Button 
          onClick={toggleConfirmation} 
          disabled={state.isSubmitting || !hasChanges}
        >
          {state.isSubmitting ? 'Updating Event...' : hasChanges ? 'Update Event' : 'No Changes to Save'}
        </Button>
      </div>

      {/* Diff-style Confirmation Dialog */}
      {state.showConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Review Event Changes</CardTitle>
              <CardDescription>
                Review the changes before updating the event
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {hasChanges ? (
                <>
                  <div className="space-y-3">
                    {differences.map((diff, index) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">{diff.label}</h4>
                          <Badge variant="secondary">Modified</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500 mb-1">Original:</p>
                            <div className="bg-red-50 border border-red-200 rounded p-2 text-red-800">
                              {diff.type === 'boolean' 
                                ? (diff.original ? 'Yes' : 'No')
                                : (diff.original || 'Empty')
                              }
                            </div>
                          </div>
                          <div>
                            <p className="text-gray-500 mb-1">New:</p>
                            <div className="bg-green-50 border border-green-200 rounded p-2 text-green-800">
                              {diff.type === 'boolean' 
                                ? (diff.current ? 'Yes' : 'No')
                                : (diff.current || 'Empty')
                              }
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <Separator />
                  
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h4 className="font-medium text-yellow-800 mb-2">Summary</h4>
                    <p className="text-sm text-yellow-700">
                      You are making {differences.length} change{differences.length !== 1 ? 's' : ''} to this event.
                      The event will be updated as {state.data.save_mode === 'publish' ? 'PUBLISHED' : 'DRAFT'}.
                    </p>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">No changes detected</p>
                </div>
              )}
              
              <div className="flex justify-end space-x-4 pt-4">
                <Button variant="outline" onClick={toggleConfirmation} disabled={state.isSubmitting}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSubmit} 
                  disabled={state.isSubmitting || !hasChanges}
                >
                  {state.isSubmitting ? 'Updating...' : 'Confirm & Update'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function EditEventForm({ initialData }: EditEventFormProps) {
  const mappedInitialData = {
    title: initialData.title,
    description: initialData.description,
    location: initialData.location,
    event_date: initialData.start_date.split('T')[0],
    start_time: initialData.start_time,
    end_time: initialData.end_time,
    total_capacity: initialData.max_participants,
    registration_status: 'open' as const,
    auto_close_when_full: true,
    event_type: initialData.price > 0 ? 'paid' as const : 'free' as const,
    price: initialData.price,
    currency: 'INR',
    form_fields: initialData.form_fields || [],
    visibility: initialData.status === 'published' ? 'public' as const : 'hidden' as const,
    save_mode: initialData.status === 'published' ? 'publish' as const : 'draft' as const,
    assigned_organizer: initialData.organizer_id,
  };

  return (
    <CreateEventProvider initialData={mappedInitialData}>
      <EditEventFormContent initialData={initialData} />
    </CreateEventProvider>
  );
}
