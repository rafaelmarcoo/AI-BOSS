-- Enable pgvector for semantic search over document chunks.
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Conversations group chat messages into user-owned threads.
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (id, user_id)
);

-- Each chat message belongs to a single conversation.
CREATE TABLE IF NOT EXISTS public.conversation_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  conversation_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  citations JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT conversation_messages_conversation_fk
    FOREIGN KEY (conversation_id, user_id)
    REFERENCES public.conversations(id, user_id)
    ON DELETE CASCADE,
  CONSTRAINT conversation_messages_role_check
    CHECK (role IN ('user', 'assistant'))
);

-- Documents represent uploaded files stored in Supabase Storage.
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  conversation_id UUID,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploaded',
  document_type TEXT,
  raw_text TEXT,
  metadata JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (id, user_id),
  CONSTRAINT documents_conversation_fk
    FOREIGN KEY (conversation_id, user_id)
    REFERENCES public.conversations(id, user_id)
    ON DELETE SET NULL,
  CONSTRAINT documents_status_check
    CHECK (status IN ('uploaded', 'processing', 'ready', 'failed')),
  CONSTRAINT documents_file_type_check
    CHECK (file_type IN ('pdf', 'csv'))
);

-- Document chunks are the retrieval units used for RAG.
CREATE TABLE IF NOT EXISTS public.document_chunks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  document_id UUID NOT NULL,
  user_id UUID NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  source_page INTEGER,
  metadata JSONB,
  embedding extensions.vector(1536),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT document_chunks_document_fk
    FOREIGN KEY (document_id, user_id)
    REFERENCES public.documents(id, user_id)
    ON DELETE CASCADE,
  CONSTRAINT document_chunks_chunk_index_check
    CHECK (chunk_index >= 0),
  CONSTRAINT document_chunks_source_page_check
    CHECK (source_page IS NULL OR source_page > 0),
  UNIQUE (document_id, chunk_index)
);

-- Decision log becomes an audit/event table rather than the source of truth for chat history.
ALTER TABLE public.decision_log
ADD COLUMN IF NOT EXISTS conversation_id UUID,
ADD COLUMN IF NOT EXISTS assistant_message_id UUID,
ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'chat_completion';

ALTER TABLE public.decision_log
ADD CONSTRAINT decision_log_conversation_fk
  FOREIGN KEY (conversation_id)
  REFERENCES public.conversations(id)
  ON DELETE SET NULL;

ALTER TABLE public.decision_log
ADD CONSTRAINT decision_log_assistant_message_fk
  FOREIGN KEY (assistant_message_id)
  REFERENCES public.conversation_messages(id)
  ON DELETE SET NULL;

ALTER TABLE public.decision_log
ADD CONSTRAINT decision_log_event_type_check
  CHECK (event_type IN ('chat_completion', 'document_ingestion', 'retrieval', 'tool_call', 'calculation'));

-- Indexes for common access patterns.
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON public.conversations(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation_id
  ON public.conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_user_id_created_at
  ON public.conversation_messages(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_conversation_id ON public.documents(conversation_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON public.documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON public.documents(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON public.document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_user_id ON public.document_chunks(user_id);

CREATE INDEX IF NOT EXISTS idx_decision_log_conversation_id ON public.decision_log(conversation_id);
CREATE INDEX IF NOT EXISTS idx_decision_log_assistant_message_id ON public.decision_log(assistant_message_id);
CREATE INDEX IF NOT EXISTS idx_decision_log_event_type ON public.decision_log(event_type);

-- Vector similarity index for semantic search.
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding_hnsw
  ON public.document_chunks
  USING hnsw (embedding extensions.vector_cosine_ops);

-- Enable RLS on the new tables.
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

-- Conversations policies.
CREATE POLICY "Users can view own conversations"
  ON public.conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations"
  ON public.conversations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations"
  ON public.conversations FOR DELETE
  USING (auth.uid() = user_id);

-- Conversation message policies.
CREATE POLICY "Users can view own conversation messages"
  ON public.conversation_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversation messages"
  ON public.conversation_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversation messages"
  ON public.conversation_messages FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversation messages"
  ON public.conversation_messages FOR DELETE
  USING (auth.uid() = user_id);

-- Document policies.
CREATE POLICY "Users can view own documents"
  ON public.documents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own documents"
  ON public.documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own documents"
  ON public.documents FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own documents"
  ON public.documents FOR DELETE
  USING (auth.uid() = user_id);

-- Document chunk policies.
CREATE POLICY "Users can view own document chunks"
  ON public.document_chunks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own document chunks"
  ON public.document_chunks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own document chunks"
  ON public.document_chunks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own document chunks"
  ON public.document_chunks FOR DELETE
  USING (auth.uid() = user_id);

-- Reuse the shared updated_at trigger for new mutable tables.
CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
