-- Create table for syncing LOT chat sessions and infinite memory summaries
create table if not exists public.lot_chat_sessions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New Chat',
  messages jsonb not null default '[]'::jsonb,
  rolling_summary text not null default '',
  updated_at bigint not null
);

-- Index for fast sorting by newest chats per user
create index if not exists idx_lot_chat_sessions_user_updated
  on public.lot_chat_sessions (user_id, updated_at desc);

-- Enable Row Level Security (RLS)
alter table public.lot_chat_sessions enable row level security;

-- Policy: Users can only view, insert, update, or delete their own chats
create policy "Users manage own LOT chats"
  on public.lot_chat_sessions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
