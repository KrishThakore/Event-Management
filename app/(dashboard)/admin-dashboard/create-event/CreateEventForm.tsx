'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { EventBasicsSection } from './EventBasicsSection';
import { CapacitySection } from './CapacitySection';
import { PricingSection } from './PricingSection';
import { FormBuilderSection } from './FormBuilderSection';
import { VisibilitySection } from './VisibilitySection';
import { OrganizerSection } from './OrganizerSection';
import { ReviewSection } from './ReviewSection';
import { CreateEventProvider, useCreateEvent } from './CreateEventProvider';

function CreateEventFormContent({ organizers }: { organizers: any[] }) {
  const { state, setSubmitting, toggleConfirmation, validateForm } = useCreateEvent();
  const router = useRouter();

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast.error('Please fix all errors before submitting');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/admin/create-event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
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
        const message = result.error || 'Failed to create event. Please try again.';
        toast.error(message);
        return;
      }

      toast.success('Event created successfully');
      const eventId = result.event?.id as string | undefined;
      if (eventId) {
        router.push(`/admin-dashboard/events?new_event=${encodeURIComponent(eventId)}`);
      } else {
        router.push('/admin-dashboard/events');
      }
    } catch (error) {
      console.error('Error creating event:', error);
      toast.error('Failed to create event. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

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

      {/* Section 7: Review & Confirmation */}
      <Card>
        <CardHeader>
          <CardTitle>Review & Confirmation</CardTitle>
          <CardDescription>Review your event details before publishing</CardDescription>
        </CardHeader>
        <CardContent>
          <ReviewSection />
        </CardContent>
      </Card>

      {/* Primary submit action */}
      <div className="flex justify-end">
        <Button onClick={toggleConfirmation} disabled={state.isSubmitting}>
          {state.isSubmitting ? 'Creating Event...' : 'Create Event'}
        </Button>
      </div>

      {/* Confirmation Dialog */}
      {state.showConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Confirm Event Creation</CardTitle>
              <CardDescription>
                This event will be created as {state.data.save_mode === 'publish' ? 'APPROVED' : 'DRAFT'} and may be visible immediately. Continue?
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-end space-x-4">
              <Button variant="outline" onClick={toggleConfirmation} disabled={state.isSubmitting}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={state.isSubmitting}>
                {state.isSubmitting ? 'Creating...' : 'Confirm & Create'}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export function CreateEventForm({ organizers }: { organizers: any[] }) {
  return (
    <CreateEventProvider>
      <CreateEventFormContent organizers={organizers} />
    </CreateEventProvider>
  );
}
