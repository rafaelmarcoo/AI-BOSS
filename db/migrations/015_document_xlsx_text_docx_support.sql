-- Allow XLSX, plain text, and DOCX uploads alongside the existing PDF, CSV,
-- and image document types.
ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_file_type_check;

ALTER TABLE public.documents
  ADD CONSTRAINT documents_file_type_check
  CHECK (file_type IN ('pdf', 'csv', 'image', 'xlsx', 'text', 'docx'));
