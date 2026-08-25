-- ============================================================================
-- LOT AI Sovereign Database Schema (Supabase PostgreSQL + pgvector)
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/hvthwecmcifvjewwlpqk/sql
-- ============================================================================

-- 1. Enable Vector Extension for Semantic RAG Search
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. User Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Conversations Table
CREATE TABLE IF NOT EXISTS public.conversations (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL,
  model_id TEXT DEFAULT 'meta/llama-3.1-70b-instruct',
  messages JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Projects Table
CREATE TABLE IF NOT EXISTS public.projects (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#ffffff',
  custom_instructions TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Scheduled Tasks Table
CREATE TABLE IF NOT EXISTS public.scheduled_tasks (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  cron_expression TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Vector Documents Table for RAG & Long-Term Memory
CREATE TABLE IF NOT EXISTS public.vector_documents (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  title TEXT,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Create HNSW Vector Index for Sub-Millisecond Similarity Search
CREATE INDEX IF NOT EXISTS vector_documents_embedding_idx
ON public.vector_documents
USING hnsw (embedding vector_cosine_ops);

-- 8. Enable Row-Level Security (RLS) on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vector_documents ENABLE ROW LEVEL SECURITY;

-- 9. Row-Level Security Policies (Strict User Data Isolation)
CREATE POLICY "Users can manage own profile"
ON public.profiles FOR ALL
USING (auth.uid() = id);

CREATE POLICY "Users can manage own conversations"
ON public.conversations FOR ALL
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own projects"
ON public.projects FOR ALL
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own tasks"
ON public.scheduled_tasks FOR ALL
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own vector documents"
ON public.vector_documents FOR ALL
USING (auth.uid() = user_id);
