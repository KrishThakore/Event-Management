"use client";

import { RegisterClient } from './RegisterClient';

interface RegistrationFormField {
  id: string;
  label: string;
  field_type: string;
  required: boolean;
  options?: string[] | null;
}

export function EventRegistrationSection({ eventId, registrationOpen, isLoggedIn, registrationFormFields }: { 
  eventId: string; 
  registrationOpen: boolean; 
  isLoggedIn: boolean;
  registrationFormFields?: RegistrationFormField[];
}) {
  if (!registrationOpen) return null;
  
  if (!isLoggedIn) {
    return (
      <p className="text-[11px] text-slate-400">Login to register for this event.</p>
    );
  }
  
  return <RegisterClient eventId={eventId} formFields={registrationFormFields || []} />;
}
