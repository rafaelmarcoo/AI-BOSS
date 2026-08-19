-- Allow image uploads (photographed receipts, statements, etc.) alongside
-- the existing PDF and CSV document types.
ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_file_type_check;

ALTER TABLE public.documents
  ADD CONSTRAINT documents_file_type_check
  CHECK (file_type IN ('pdf', 'csv', 'image'));
