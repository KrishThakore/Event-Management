import { getSupabaseServerClient } from '@/lib/supabase-server';
import { NextRequest } from 'next/server';

function escapeCSVField(field: any): string {
  if (field === null || field === undefined) return '';
  const stringField = String(field);
  if (stringField.includes(',') || stringField.includes('\n') || stringField.includes('"')) {
    return `"${stringField.replace(/"/g, '""')}"`;
  }
  return stringField;
}

function generateCSV(data: any[], headers: string[]): string {
  const csvRows = [];
  csvRows.push(headers.map(escapeCSVField).join(','));
  for (const row of data) {
    const values = headers.map(header => {
      const value = header.split('.').reduce((obj: any, key: string) => obj?.[key], row);
      return escapeCSVField(value);
    });
    csvRows.push(values.join(','));
  }
  return csvRows.join('\n');
}

async function exportRegistrations(supabase: any) {
  const { data } = await supabase
    .from('registrations')
    .select(`
      id,status,entry_code,created_at,
      user:profiles(id,full_name,email),
      event:events(id,title,event_date,is_paid,price)
    `)
    .order('created_at', { ascending: false });

  const headers = [
    'Registration ID',
    'User Name',
    'User Email',
    'Event Title',
    'Event Date',
    'Event Price',
    'Status',
    'Entry Code',
    'Created At'
  ];

  const csvData = (data ?? []).map((reg: any) => ({
    'Registration ID': reg.id,
    'User Name': reg.user?.full_name || '',
    'User Email': reg.user?.email || '',
    'Event Title': reg.event?.title || '',
    'Event Date': reg.event?.event_date ? String(new Date(reg.event.event_date).toLocaleDateString()) : '',
    'Event Price': reg.event?.price || 0,
    'Status': reg.status,
    'Entry Code': reg.entry_code,
    'Created At': String(new Date(reg.created_at).toLocaleString())
  }));

  return generateCSV(csvData, headers);
}

async function exportEventDetailed(supabase: any, eventId: string) {
  const { data } = await supabase
    .from('registrations')
    .select(`
      id,status,entry_code,created_at,event_id,
      user:profiles(id,full_name,email),
      event:events(id,title,event_date,is_paid,price),
      responses:registration_responses(
        value,
        field:event_form_fields(label,field_type,required)
      )
    `)
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });

  const registrations = data ?? [];

  // Collect all distinct field labels for this event so we can make one column per field
  const fieldLabelSet = new Set<string>();
  for (const reg of registrations) {
    for (const resp of reg.responses ?? []) {
      const label = resp.field?.label as string | undefined;
      if (label) {
        fieldLabelSet.add(label);
      }
    }
  }

  const fieldLabels = Array.from(fieldLabelSet).sort();

  const baseHeaders = [
    'Registration ID',
    'User Name',
    'User Email',
    'Event ID',
    'Event Title',
    'Event Date',
    'Event Price',
    'Event Is Paid',
    'Status',
    'Entry Code',
    'Created At'
  ];

  const headers = [...baseHeaders, ...fieldLabels];

  const rows: any[] = [];

  for (const reg of registrations) {
    const row: any = {
      'Registration ID': reg.id,
      'User Name': reg.user?.full_name || '',
      'User Email': reg.user?.email || '',
      'Event ID': reg.event?.id || reg.event_id,
      'Event Title': reg.event?.title || '',
      'Event Date': reg.event?.event_date
        ? String(new Date(reg.event.event_date).toLocaleDateString())
        : '',
      'Event Price': reg.event?.price ?? '',
      'Event Is Paid': reg.event?.is_paid ?? '',
      Status: reg.status,
      'Entry Code': reg.entry_code,
      'Created At': String(new Date(reg.created_at).toLocaleString())
    };

    // Initialise all custom field columns as empty strings
    for (const label of fieldLabels) {
      row[label] = '';
    }

    // Fill in responses: if multiple responses for same label, join them with '; '
    const responses = reg.responses ?? [];
    const valueByLabel: Record<string, string> = {};

    for (const resp of responses) {
      const label = resp.field?.label as string | undefined;
      if (!label) continue;

      const value = resp.value ?? '';
      if (valueByLabel[label]) {
        valueByLabel[label] = `${valueByLabel[label]}; ${value}`;
      } else {
        valueByLabel[label] = value;
      }
    }

    for (const label of Object.keys(valueByLabel)) {
      if (fieldLabelSet.has(label)) {
        row[label] = valueByLabel[label];
      }
    }

    rows.push(row);
  }

  return generateCSV(rows, headers);
}

async function exportAttendance(supabase: any) {
  const { data } = await supabase
    .from('attendance')
    .select(`
      id,checked_in_at,
      registration:registrations(id,entry_code),
      user:profiles(id,full_name,email),
      event:events(id,title,event_date)
    `)
    .order('checked_in_at', { ascending: false });

  const headers = [
    'Attendance ID',
    'User Name',
    'User Email',
    'Event Title',
    'Event Date',
    'Entry Code',
    'Checked In At'
  ];

  const csvData = (data ?? []).map((att: any) => ({
    'Attendance ID': att.id,
    'User Name': att.user?.full_name || '',
    'User Email': att.user?.email || '',
    'Event Title': att.event?.title || '',
    'Event Date': att.event?.event_date ? String(new Date(att.event.event_date).toLocaleDateString()) : '',
    'Entry Code': att.registration?.entry_code || '',
    'Checked In At': String(new Date(att.checked_in_at).toLocaleString())
  }));

  return generateCSV(csvData, headers);
}

async function exportManualRegistrations(supabase: any) {
  const { data } = await supabase
    .from('registrations')
    .select(`
      id,status,entry_code,created_at,
      user:profiles(id,full_name,email),
      event:events(id,title,event_date)
    `)
    .like('entry_code', 'MANUAL-%')
    .order('created_at', { ascending: false });

  const headers = [
    'Registration ID',
    'User Name',
    'User Email',
    'Event Title',
    'Event Date',
    'Status',
    'Entry Code',
    'Created At'
  ];

  const csvData = (data ?? []).map((reg: any) => ({
    'Registration ID': reg.id,
    'User Name': reg.user?.full_name || '',
    'User Email': reg.user?.email || '',
    'Event Title': reg.event?.title || '',
    'Event Date': reg.event?.event_date ? String(new Date(reg.event.event_date).toLocaleDateString()) : '',
    'Status': reg.status,
    'Entry Code': reg.entry_code,
    'Created At': String(new Date(reg.created_at).toLocaleString())
  }));

  return generateCSV(csvData, headers);
}

async function exportPayments(supabase: any) {
  const { data } = await supabase
    .from('payments')
    .select(`
      id,amount,status,razorpay_order_id,razorpay_payment_id,created_at,
      user:profiles(id,full_name,email),
      event:events(id,title,event_date)
    `)
    .order('created_at', { ascending: false });

  const headers = [
    'Payment ID',
    'User Name',
    'User Email',
    'Event Title',
    'Event Date',
    'Amount',
    'Status',
    'Razorpay Order ID',
    'Razorpay Payment ID',
    'Created At'
  ];

  const csvData = (data ?? []).map((payment: any) => ({
    'Payment ID': payment.id,
    'User Name': payment.user?.full_name || '',
    'User Email': payment.user?.email || '',
    'Event Title': payment.event?.title || '',
    'Event Date': payment.event?.event_date ? String(new Date(payment.event.event_date).toLocaleDateString()) : '',
    'Amount': payment.amount,
    'Status': payment.status,
    'Razorpay Order ID': payment.razorpay_order_id || '',
    'Razorpay Payment ID': payment.razorpay_payment_id || '',
    'Created At': String(new Date(payment.created_at).toLocaleString())
  }));

  return generateCSV(csvData, headers);
}

async function exportUsers(supabase: any) {
  const { data } = await supabase
    .from('profiles')
    .select('id,full_name,email,role,created_at')
    .order('created_at', { ascending: false });

  const headers = [
    'User ID',
    'Full Name',
    'Email',
    'Role',
    'Created At'
  ];

  const csvData = (data ?? []).map((user: any) => ({
    'User ID': user.id,
    'Full Name': user.full_name || '',
    'Email': user.email,
    'Role': user.role,
    'Created At': String(new Date(user.created_at).toLocaleString())
  }));

  return generateCSV(csvData, headers);
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const exportType = formData.get('exportType') as string | null;
  const eventId = formData.get('eventId') as string | null;

  if (!exportType) {
    return new Response('Missing exportType', { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') {
    return new Response('Forbidden', { status: 403 });
  }

  let csvData = '';
  let filename = '';

  switch (exportType) {
    case 'registrations':
      csvData = await exportRegistrations(supabase);
      filename = `registrations-${new Date().toISOString().split('T')[0]}.csv`;
      break;
    case 'attendance':
      csvData = await exportAttendance(supabase);
      filename = `attendance-${new Date().toISOString().split('T')[0]}.csv`;
      break;
    case 'manual_registrations':
      csvData = await exportManualRegistrations(supabase);
      filename = `manual-registrations-${new Date().toISOString().split('T')[0]}.csv`;
      break;
    case 'payments':
      csvData = await exportPayments(supabase);
      filename = `payments-${new Date().toISOString().split('T')[0]}.csv`;
      break;
    case 'users':
      csvData = await exportUsers(supabase);
      filename = `users-${new Date().toISOString().split('T')[0]}.csv`;
      break;
    case 'event_detailed':
      if (!eventId) {
        return new Response('Missing eventId', { status: 400 });
      }
      csvData = await exportEventDetailed(supabase, eventId);
      filename = `event-${eventId}-detailed-${new Date().toISOString().split('T')[0]}.csv`;
      break;
  }

  // Log the export action
  await supabase.from('admin_logs').insert({
    admin_id: user.id,
    action: 'EXPORT_DATA',
    details: {
      export_type: exportType,
      filename,
      record_count: csvData.split('\n').length - 1 // Subtract header row
    }
  });

  return new Response(csvData, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  });
}
