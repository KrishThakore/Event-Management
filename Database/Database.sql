-- ===============================
-- EXTENSIONS
-- ===============================
create extension if not exists "pgcrypto";

-- ===============================
-- PROFILES (User roles)
-- ===============================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text check (role in ('student','organizer','admin')) not null default 'student',
  created_at timestamptz default now()
);

-- ===============================
-- EVENTS
-- ===============================
create table events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  location text,

  event_date date not null,
  start_time time not null,
  end_time time not null,

  capacity integer not null check (capacity > 0),
  is_registration_open boolean default true,

  price numeric(10,2) default 0,
  is_paid boolean generated always as (price > 0) stored,

  created_by uuid references profiles(id),
  assigned_organizer uuid references profiles(id),
  status text check (status in ('draft','approved','cancelled')) default 'draft',

  created_at timestamptz default now()
);

-- ===============================
-- EVENT FORM FIELDS
-- ===============================
create table event_form_fields (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade,
  label text not null,
  field_type text check (field_type in ('text','number','select','file')) not null,
  required boolean default false,
  options jsonb,
  created_at timestamptz default now()
);

-- ===============================
-- REGISTRATIONS
-- ===============================
create table registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,

  status text check (status in ('PENDING','CONFIRMED','CANCELLED')) not null,
  entry_code text unique,

  created_at timestamptz default now(),
  unique (event_id, user_id)
);

-- ===============================
-- REGISTRATION RESPONSES
-- ===============================
create table registration_responses (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid references registrations(id) on delete cascade,
  field_id uuid references event_form_fields(id) on delete cascade,
  value text
);

-- ===============================
-- PAYMENTS
-- ===============================
create table payments (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid references registrations(id) on delete cascade,

  razorpay_order_id text unique,
  razorpay_payment_id text unique,
  razorpay_signature text,

  amount numeric(10,2) not null,
  status text check (status in ('CREATED','SUCCESS','FAILED')) not null,

  created_at timestamptz default now()
);

-- ===============================
-- ATTENDANCE
-- ===============================
create table attendance (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid unique references registrations(id) on delete cascade,
  checked_in_at timestamptz default now()
);

-- ===============================
-- ADMIN LOGS
-- ===============================
create table admin_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references profiles(id),
  action text not null,
  details jsonb,
  created_at timestamptz default now()
);

-- ===============================
-- INDEXES
-- ===============================
create index idx_events_date on events(event_date);
create index idx_registrations_event on registrations(event_id);
create index idx_registrations_status on registrations(status);
create index idx_registrations_entry_code on registrations(entry_code);
create index idx_payments_status on payments(status);

-- ===============================
-- CAPACITY-SAFE REGISTRATION FUNCTION
-- ===============================
create or replace function register_for_event(
  p_event_id uuid,
  p_user_id uuid
)
returns uuid
language plpgsql
as $$
declare
  v_capacity int;
  v_count int;
  v_registration_id uuid;
begin
  select capacity
  into v_capacity
  from events
  where id = p_event_id
    and is_registration_open = true
    and status = 'approved'
  for update;

  if not found then
    raise exception 'Registration closed or event not approved';
  end if;

  select count(*)
  into v_count
  from registrations
  where event_id = p_event_id
    and status in ('PENDING','CONFIRMED');

  if v_count >= v_capacity then
    raise exception 'Event capacity full';
  end if;

  insert into registrations (event_id, user_id, status)
  values (p_event_id, p_user_id, 'PENDING')
  returning id into v_registration_id;

  return v_registration_id;
end;
$$;

-- ===============================
-- CONFIRM REGISTRATION (GENERATE ENTRY CODE)
-- ===============================
create or replace function confirm_registration(
  p_registration_id uuid
)
returns void
language plpgsql
as $$
declare
  v_code text;
begin
  v_code := 'GAN-' || upper(substr(gen_random_uuid()::text, 1, 6));

  update registrations
  set status = 'CONFIRMED',
      entry_code = v_code
  where id = p_registration_id;
end;
$$;

-- ===============================
-- ADMIN CHECK FUNCTION
-- ===============================
create or replace function is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from profiles 
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ===============================
-- TEST BYPASS FUNCTION (TEMPORARY RLS DISABLE)
-- ===============================
create or replace function test_bypass()
returns integer
language plpgsql
security definer
as $$
declare
  user_count integer;
begin
  -- Temporarily disable RLS
  execute 'set local row_security = off';
  
  -- Count all profiles
  select count(*) into user_count from profiles;
  
  return user_count;
end;
$$;

-- ===============================
-- ADMIN PROFILES VIEW (BYPASSES RLS)
-- ===============================
create view admin_profiles_view as
select id, full_name, email, role, created_at, disabled 
from profiles;

-- Grant access to the view
grant usage on schema public to authenticated;
grant select on admin_profiles_view to authenticated;

-- ===============================
-- WORKING ADMIN BYPASS FUNCTION
-- ===============================
create or replace function get_all_profiles_for_admin()
returns table(id uuid, full_name text, email text, role text, created_at timestamptz, disabled boolean)
language sql
security definer
as $$
  -- This function completely bypasses RLS by using a direct query
  -- with security definer and no RLS policy interference
  select 
    p.id, 
    p.full_name, 
    p.email, 
    p.role, 
    p.created_at, 
    p.disabled
  from profiles p
  order by p.created_at desc;
$$;
create or replace function admin_bypass_profiles()
returns table(id uuid, full_name text, email text, role text, created_at timestamptz, disabled boolean)
language plpgsql
security definer
as $$
declare
  original_rls_setting boolean;
begin
  -- Save current RLS setting
  select current_setting('row_security', true)::boolean into original_rls_setting;
  
  -- Temporarily disable RLS
  execute 'set local row_security = off';
  
  -- Return all profiles
  return query
  select id, full_name, email, role, created_at, disabled 
  from profiles
  order by created_at desc;
  
  -- RLS will be automatically restored when function ends
end;
$$;

-- ===============================
-- GET TOTAL USERS COUNT FUNCTION (TEMPORARY RLS DISABLE)
-- ===============================
create or replace function get_total_users_count()
returns integer
language plpgsql
security definer
as $$
declare
  user_count integer;
begin
  -- Temporarily disable RLS
  execute 'set local row_security = off';
  
  -- Count all profiles
  select count(*) into user_count from profiles;
  
  return user_count;
end;
$$;

-- ===============================
-- ROW LEVEL SECURITY
-- ===============================
alter table profiles enable row level security;
alter table events enable row level security;
alter table registrations enable row level security;
alter table payments enable row level security;
alter table attendance enable row level security;
alter table admin_logs enable row level security;

-- ===============================
-- SIMPLE ADMIN CHECK FOR MANUAL ADMIN CREATION
-- ===============================

-- Function to check if user is admin based on email OR role
create or replace function is_admin_by_email()
returns boolean
language sql
security definer
as $$
  -- Check if user is admin by email OR by role in profiles
  -- This avoids recursion by checking email first, then role
  select 
    case 
      when (
        select email from auth.users where id = auth.uid()
      ) in ('krshthakore@gmail.com', 'admin@university.edu') then true
      when exists (
        select 1 from profiles p 
        where p.id = auth.uid() and p.role = 'admin'
      ) then true
      else false
    end;
$$;

-- Create admin policy using email check
create policy "Admin can view all profiles"
on profiles for select
using (is_admin_by_email());

-- Create user policy that doesn't apply to admins
create policy "Users view own profile"
on profiles for select
using (auth.uid() = id and not is_admin_by_email());

-- Also create policies for update operations
create policy "Admin can update all profiles"
on profiles for update
using (is_admin_by_email());

create policy "Users can update own profile"
on profiles for update
using (auth.uid() = id and not is_admin_by_email());

-- ===============================
-- RLS POLICIES
-- ===============================

-- Admin can view all profiles
create policy "Admin can view all profiles"
on profiles for select
using (is_admin_by_email());

-- Users can view their own profile (if not admin)
create policy "Users view own profile"
on profiles for select
using (auth.uid() = id and not is_admin_by_email());

-- Admin can update all profiles
create policy "Admin can update all profiles"
on profiles for update
using (is_admin_by_email());

-- Users can update their own profile (if not admin)
create policy "Users can update own profile"
on profiles for update
using (auth.uid() = id and not is_admin_by_email());
-- Allow profile insertion (for admin-created users)
create policy "Allow profile insert"
on profiles for insert
with check (is_admin_by_email());

-- ===============================
-- RLS POLICIES FOR OTHER TABLES
-- ===============================
create policy "Public view approved events"
on events for select
using (status = 'approved');

create policy "Organizer & admin manage events"
on events for all
using (
  created_by = auth.uid()
  or assigned_organizer = auth.uid()
  or is_admin_by_email()
);

-- Also create insert policy for admins
create policy "Admin create events"
on events for insert
with check (is_admin_by_email());

create policy "User view own registrations"
on registrations for select
using (user_id = auth.uid());

create policy "Admin manage registrations"
on registrations for all
using (is_admin_by_email());

create policy "Admin manage payments"
on payments for all
using (is_admin_by_email());

create policy "Admin & organizer attendance"
on attendance for all
using (
  is_admin_by_email()
  or exists (
    select 1 from profiles
    where id = auth.uid()
      and role = 'organizer'
  )
);

create policy "Admin logs only"
on admin_logs for all
using (is_admin_by_email());
