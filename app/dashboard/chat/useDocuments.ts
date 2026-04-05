"use client";

import { useEffect, useRef, useState } from "react";
import type {
  DocumentSummaryView,
  DocumentsApiResponse,
  UploadDocumentApiResponse,
} from "./types";

const POLL_INTERVAL_MS = 2500;

function hasPendingDocuments(documents: DocumentSummaryView[]) {
  return documents.some(
    (document) =>
      document.status === "uploaded" || document.status === "processing"
  );
}

export function useDocuments(conversationId: string | null) {
  const [documents, setDocuments] = useState<DocumentSummaryView[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const pollingRef = useRef<number | null>(null);

  const loadDocuments = async (toggleLoading = true) => {
    if (toggleLoading) {
      setDocumentsLoading(true);
    }

    try {
      const response = await fetch("/api/documents");
      const payload = (await response.json()) as DocumentsApiResponse;

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error?.message ?? "Could not load documents.");
      }

      setDocuments(payload.data.documents);
      setDocumentsError(null);
    } catch (error) {
      setDocumentsError(
        error instanceof Error ? error.message : "Could not load documents."
      );
    } finally {
      if (toggleLoading) {
        setDocumentsLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadDocuments();
  }, []);

  useEffect(() => {
    if (pollingRef.current) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    if (!hasPendingDocuments(documents)) {
      return;
    }

    pollingRef.current = window.setInterval(() => {
      void loadDocuments(false);
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollingRef.current) {
        window.clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [documents]);

  const uploadDocument = async (file: File) => {
    const formData = new FormData();
    formData.set("file", file);

    if (conversationId) {
      formData.set("conversationId", conversationId);
    }

    setUploading(true);
    setDocumentsError(null);

    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as UploadDocumentApiResponse;

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error?.message ?? "Could not upload document.");
      }

      setDocuments((prev) => [
        payload.data!.document,
        ...prev.filter((document) => document.id !== payload.data!.document.id),
      ]);
    } catch (error) {
      setDocumentsError(
        error instanceof Error ? error.message : "Could not upload document."
      );
    } finally {
      setUploading(false);
    }
  };

  return {
    documents,
    documentsLoading,
    uploading,
    documentsError,
    uploadDocument,
    refreshDocuments: () => loadDocuments(false),
  };
}
