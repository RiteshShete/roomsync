-- Core tables. Money is bigint minor units. RLS is enabled in the same migration so a table can
-- never exist without it; policies and grants come later.
--
-- Composite foreign keys (member_id, household_id) -> household_members(id, household_id) make the
-- database itself guarantee that payers, participants, assignees etc. belong to the row's household.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 60),
  avatar_color text not null default '#4F46E5' check (avatar_color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  currency_code text not null default 'INR' check (currency_code ~ '^[A-Z]{3}$'),
  status text not null default 'active' check (status in ('active', 'archived')),
  default_split text not null default 'equal' check (default_split in ('equal', 'custom', 'percentage')),
  chore_reminders_enabled boolean not null default true,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version int not null default 1
);

create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id),
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  status text not null default 'active' check (status in ('active', 'leaving', 'left')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  move_out_requested_at timestamptz,
  move_out_requested_by uuid references public.household_members (id),
  move_out_effective_date date,
  move_out_note text check (char_length(move_out_note) <= 1000),
  move_out_acknowledged_balance_minor bigint,
  created_at timestamptz not null default now(),
  unique (id, household_id),
  constraint leaving_needs_effective_date check (status <> 'leaving' or move_out_effective_date is not null),
  constraint left_needs_left_at check (status <> 'left' or left_at is not null)
);

create table public.member_move_out_disputes (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.household_members (id) on delete cascade,
  note text not null check (char_length(btrim(note)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid not null references auth.users (id),
  code_hash text not null unique,
  code_hint text not null,
  expires_at timestamptz not null,
  max_uses int check (max_uses is null or max_uses > 0),
  use_count int not null default 0 check (use_count >= 0),
  status text not null default 'active' check (status in ('active', 'revoked', 'expired')),
  created_at timestamptz not null default now()
);

create table public.invite_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  attempted_at timestamptz not null default now(),
  succeeded boolean not null
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  amount_minor bigint not null check (amount_minor between 1 and 10000000000),
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  category text not null default 'other' check (char_length(btrim(category)) between 1 and 50),
  paid_by_member_id uuid not null,
  expense_date date not null,
  notes text check (char_length(notes) <= 1000),
  split_method text not null check (split_method in ('equal', 'custom', 'percentage')),
  created_by uuid not null references auth.users (id),
  updated_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id),
  version int not null default 1,
  unique (id, household_id),
  foreign key (paid_by_member_id, household_id) references public.household_members (id, household_id)
);

-- household_id is denormalised here so both foreign keys can be composite.
create table public.expense_shares (
  expense_id uuid not null,
  household_id uuid not null,
  member_id uuid not null,
  share_amount_minor bigint not null check (share_amount_minor >= 0),
  split_method text not null check (split_method in ('equal', 'custom', 'percentage')),
  percent_bp int check (percent_bp between 0 and 10000),
  created_at timestamptz not null default now(),
  primary key (expense_id, member_id),
  constraint percent_bp_only_for_percentage check ((split_method = 'percentage') = (percent_bp is not null)),
  foreign key (expense_id, household_id) references public.expenses (id, household_id) on delete cascade,
  foreign key (member_id, household_id) references public.household_members (id, household_id)
);

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  from_member_id uuid not null,
  to_member_id uuid not null,
  amount_minor bigint not null check (amount_minor between 1 and 10000000000),
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  settlement_date date not null,
  note text check (char_length(note) <= 500),
  recorded_by uuid not null references auth.users (id),
  status text not null default 'recorded' check (status in ('recorded', 'reversed', 'disputed')),
  status_changed_by uuid references auth.users (id),
  status_changed_at timestamptz,
  status_reason text check (char_length(status_reason) <= 1000),
  created_at timestamptz not null default now(),
  version int not null default 1,
  constraint settlement_parties_differ check (from_member_id <> to_member_id),
  foreign key (from_member_id, household_id) references public.household_members (id, household_id),
  foreign key (to_member_id, household_id) references public.household_members (id, household_id)
);

create table public.chores (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text check (char_length(description) <= 1000),
  assignee_member_id uuid,
  due_date date,
  recurrence_frequency text check (recurrence_frequency in ('daily', 'weekly', 'biweekly', 'monthly')),
  rotation_member_ids uuid[],
  status text not null default 'open' check (status in ('open', 'completed', 'cancelled')),
  created_by uuid not null references auth.users (id),
  completed_at timestamptz,
  completed_by uuid references auth.users (id),
  spawned_next_id uuid references public.chores (id),
  cancel_reason text check (char_length(cancel_reason) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version int not null default 1,
  unique (id, household_id),
  constraint recurrence_needs_due_date check (recurrence_frequency is null or due_date is not null),
  constraint rotation_needs_recurrence check (rotation_member_ids is null or recurrence_frequency is not null),
  constraint rotation_needs_two check (rotation_member_ids is null or cardinality(rotation_member_ids) >= 2),
  foreign key (assignee_member_id, household_id) references public.household_members (id, household_id)
);

create table public.chore_completions (
  id uuid primary key default gen_random_uuid(),
  chore_id uuid not null,
  household_id uuid not null,
  chore_title text not null,
  assignee_member_id uuid,
  completed_by_member_id uuid not null,
  due_date date,
  completed_at timestamptz not null default now(),
  reopened_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (chore_id, household_id) references public.chores (id, household_id) on delete cascade,
  foreign key (assignee_member_id, household_id) references public.household_members (id, household_id),
  foreign key (completed_by_member_id, household_id) references public.household_members (id, household_id)
);

create table public.grocery_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  quantity numeric check (quantity is null or quantity > 0),
  unit text check (char_length(unit) <= 30),
  category text check (char_length(category) <= 50),
  note text check (char_length(note) <= 500),
  status text not null default 'needed' check (status in ('needed', 'purchased')),
  added_by_member_id uuid not null,
  purchased_by_member_id uuid,
  purchased_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version int not null default 1,
  constraint purchased_fields_match_status check (
    (status = 'purchased') = (purchased_by_member_id is not null and purchased_at is not null)
    and (status = 'purchased' or (purchased_by_member_id is null and purchased_at is null))
  ),
  foreign key (added_by_member_id, household_id) references public.household_members (id, household_id),
  foreign key (purchased_by_member_id, household_id) references public.household_members (id, household_id)
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  pinned_at timestamptz,
  deleted_at timestamptz,
  version int not null default 1
);

create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  actor_member_id uuid,
  event_type text not null check (char_length(event_type) between 1 and 60),
  entity_type text not null check (char_length(entity_type) between 1 and 40),
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  recipient_member_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  foreign key (actor_member_id, household_id) references public.household_members (id, household_id)
);

create table public.activity_reads (
  member_id uuid not null references public.household_members (id) on delete cascade,
  event_id uuid not null references public.activity_events (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (member_id, event_id)
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  actor_member_id uuid,
  entity_type text not null check (char_length(entity_type) between 1 and 40),
  entity_id uuid not null,
  action text not null check (char_length(action) between 1 and 60),
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now(),
  foreign key (actor_member_id, household_id) references public.household_members (id, household_id)
);

create table public.notification_prefs (
  member_id uuid primary key references public.household_members (id) on delete cascade,
  categories jsonb not null default '{}'::jsonb,
  quiet_enabled boolean not null default false,
  quiet_start time,
  quiet_end time,
  updated_at timestamptz not null default now(),
  constraint quiet_hours_need_times check (not quiet_enabled or (quiet_start is not null and quiet_end is not null))
);

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.member_move_out_disputes enable row level security;
alter table public.invitations enable row level security;
alter table public.invite_attempts enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_shares enable row level security;
alter table public.settlements enable row level security;
alter table public.chores enable row level security;
alter table public.chore_completions enable row level security;
alter table public.grocery_items enable row level security;
alter table public.announcements enable row level security;
alter table public.activity_events enable row level security;
alter table public.activity_reads enable row level security;
alter table public.audit_events enable row level security;
alter table public.notification_prefs enable row level security;
