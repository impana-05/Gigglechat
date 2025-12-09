import { createClient } from '@supabase/supabase-js';

// Use the specific Supabase URL provided.
const supabaseUrl = 'https://edalovfqbhmhvtpzjwpm.supabase.co';

// Use the specific Supabase Anon Key provided.
// Added trim() to ensure no accidental whitespace from copy-pasting causes auth failures.
const supabaseAnonKey = ((typeof process !== 'undefined' && process.env?.SUPABASE_ANON_KEY) || 'sb_publishable_iq_94pt4S3IKRjDYk9-dHA_zwVA9Oq2').trim();

// Ensure the client is created with valid arguments
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * --- CRITICAL: RUN THIS SQL IN SUPABASE SQL EDITOR TO FIX PERMISSIONS ---
 * 
 * -- 1. Enable Row Level Security (RLS) on all tables
 * alter table profiles enable row level security;
 * alter table friend_requests enable row level security;
 * alter table friends enable row level security;
 * alter table messages enable row level security;
 * 
 * -- 2. Profiles Policies
 * create policy "Public profiles are viewable by everyone" on profiles for select using (true);
 * create policy "Users can insert their own profile" on profiles for insert with check (auth.uid() = id);
 * create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
 * 
 * -- 3. Friend Requests Policies
 * create policy "Users can view requests they sent or received" on friend_requests for select using (auth.uid() = sender_id or auth.uid() = receiver_id);
 * create policy "Users can create requests" on friend_requests for insert with check (auth.uid() = sender_id);
 * create policy "Receiver can update status" on friend_requests for update using (auth.uid() = receiver_id);
 * 
 * -- 4. Friends Policies
 * create policy "Users can view their own friends" on friends for select using (auth.uid() = user_id);
 * create policy "Users can insert friendship rows" on friends for insert with check (auth.uid() = user_id or auth.uid() = friend_id);
 * 
 * -- 5. Messages Policies
 * create policy "Users can view their own messages" on messages for select using (auth.uid() = sender_id or auth.uid() = receiver_id);
 * create policy "Users can send messages" on messages for insert with check (auth.uid() = sender_id);
 * 
 * -- 6. ENABLE REALTIME
 * alter publication supabase_realtime add table messages, friend_requests, friends, profiles;
 * 
 * -- 7. Database Schema (If not already created)
 * create table if not exists profiles (
 *   id uuid references auth.users not null primary key,
 *   username text unique,
 *   avatar_url text,
 *   bio text,
 *   updated_at timestamp with time zone
 * );
 * 
 * create table if not exists friend_requests (
 *   id uuid default uuid_generate_v4() primary key,
 *   sender_id uuid references profiles(id),
 *   receiver_id uuid references profiles(id),
 *   status text check (status in ('pending', 'accepted', 'rejected')) default 'pending',
 *   created_at timestamp with time zone default now()
 * );
 * 
 * create table if not exists friends (
 *   user_id uuid references profiles(id),
 *   friend_id uuid references profiles(id),
 *   created_at timestamp with time zone default now(),
 *   primary key (user_id, friend_id)
 * );
 * 
 * create table if not exists messages (
 *   id uuid default uuid_generate_v4() primary key,
 *   sender_id uuid references profiles(id),
 *   receiver_id uuid references profiles(id),
 *   content text,
 *   is_toxic boolean default false,
 *   created_at timestamp with time zone default now()
 * );
 * 
 * -- 8. REFRESH CACHE
 * NOTIFY pgrst, 'reload schema';
 */