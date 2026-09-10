"use client";

import { useEffect, useRef, useState } from "react";
import type {
  DocumentSummaryView,
  DocumentsApiResponse,
  UploadDocumentApiResponse,
} from "./types";

const POLL_INTERVAL_MS = 2500;

export interface DocumentWarning {
  document: DocumentSummaryView;
  message: string;
}

interface UseDocumentsOptions {
  onDocumentsProcessed?: () => void;
  onDocumentWarning?: (warning: DocumentWarning) => void;
}

function hasPendingDocuments(documents: DocumentSummaryView[]) {
  return documents.some(
    (document) =>
      document.status === "uploaded" || document.status === "processing"
  );
}

function isPendingStatus(status: DocumentSummaryView["status"]) {
  return status === "uploaded" || status === "processing";
}

function getMetricObservationCount(metadata: unknown): number | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const count = (metadata as Record<string, unknown>).metricObservationCount;

  return typeof count === "number" ? count : null;
}

interface CsvValueIssue {
  rowNumber: number;
  label: string;
  rawValue: string;
}

function getCsvValueIssues(metadata: unknown): CsvValueIssue[] {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return [];
  }

  const issues = (metadata as Record<string, unknown>).valueIssues;

  return Array.isArray(issues) ? (issues as CsvValueIssue[]) : [];
}

function buildDocumentWarningMessage(document: DocumentSummaryView): string | null {
  const valueIssues = getCsvValueIssues(document.metadata);

  if (valueIssues.length > 0) {
    const details = valueIssues
      .slice(0, 3)
      .map((issue) => `${issue.label} ("${issue.rawValue}")`)
      .join(", ");
    const remaining = valueIssues.length - 3;
    const suffix = remaining > 0 ? `, and ${remaining} more` : "";

    return `${document.file_name}: these values couldn't be read as numbers: ${details}${suffix}.`;
  }

  if (getMetricObservationCount(document.metadata) === 0) {
    return `${document.file_name} uploaded, but no financial data was recognized in it. Check that it includes recognizable account/amount data.`;
  }

  return null;
}

function findNewlyFinishedDocuments(
  previousDocuments: DocumentSummaryView[],
  nextDocuments: DocumentSummaryView[]
) {
  const previousStatuses = new Map(
    previousDocuments.map((document) => [document.id, document.status])
  );

  return nextDocuments.filter((document) => {
    const previousStatus = previousStatuses.get(document.id);

    return Boolean(previousStatus && isPendingStatus(previousStatus) && !isPendingStatus(document.status));
  });
}

function findNewlyWarnedDocuments(
  previousDocuments: DocumentSummaryView[],
  nextDocuments: DocumentSummaryView[]
): DocumentWarning[] {
  return findNewlyFinishedDocuments(previousDocuments, nextDocuments)
    .filter((document) => document.status === "ready")
    .flatMap((document) => {
      const message = buildDocumentWarningMessage(document);

      return message ? [{ document, message }] : [];
    });
}

export function useDocuments(
  conversationId: string | null,
  options: UseDocumentsOptions = {}
) {
  const [documents, setDocuments] = useState<DocumentSummaryView[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const pollingRef = useRef<number | null>(null);
  const onDocumentsProcessedRef = useRef(options.onDocumentsProcessed);
  const onDocumentWarningRef = useRef(options.onDocumentWarning);

  useEffect(() => {
    onDocumentsProcessedRef.current = options.onDocumentsProcessed;
  }, [options.onDocumentsProcessed]);

  useEffect(() => {
    onDocumentWarningRef.current = options.onDocumentWarning;
  }, [options.onDocumentWarning]);

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

      setDocuments((previousDocuments) => {
        const nextDocuments = payload.data!.documents;
        const finishedDocuments = findNewlyFinishedDocuments(
          previousDocuments,
          nextDocuments
        );

        if (finishedDocuments.length > 0) {
          window.setTimeout(() => {
            onDocumentsProcessedRef.current?.();
          }, 0);
        }

        const warnedDocuments = findNewlyWarnedDocuments(
          previousDocuments,
          nextDocuments
        );

        warnedDocuments.forEach((warning) => {
          window.setTimeout(() => {
            onDocumentWarningRef.current?.(warning);
          }, 0);
        });

        return nextDocuments;
      });
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
