"use client";

import { useEffect, useRef, useState } from "react";
import {
  Alert,
  CircularProgress,
  IconButton,
  Snackbar,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import MicRoundedIcon from "@mui/icons-material/MicRounded";
import StopCircleRoundedIcon from "@mui/icons-material/StopCircleRounded";
import { dashboardTokens } from "@/app/theme";

const MAX_RECORDING_SECONDS = 10 * 60;
const RECORDING_WARNING_SECONDS = MAX_RECORDING_SECONDS - 60;

interface VoiceInputButtonProps {
  disabled?: boolean;
  onTranscript: (transcript: string) => void;
}

interface TranscriptionResponse {
  success: boolean;
  data?: { transcript?: string };
  error?: { message?: string };
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function chooseRecordingMimeType() {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
  ];

  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function recordingFileName(mimeType: string) {
  if (mimeType.startsWith("audio/mp4")) return "recording.mp4";
  if (mimeType.startsWith("audio/ogg")) return "recording.ogg";
  return "recording.webm";
}

export function VoiceInputButton({
  disabled = false,
  onTranscript,
}: VoiceInputButtonProps) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const discardRecordingRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const stopMediaTracks = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const clearRecordingTimer = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const transcribeRecording = async (blob: Blob) => {
    if (blob.size === 0) {
      setError("No audio was captured. Please try recording again.");
      return;
    }

    setTranscribing(true);

    try {
      const formData = new FormData();
      formData.set(
        "audio",
        new File([blob], recordingFileName(blob.type), { type: blob.type }),
      );
      const response = await fetch("/api/audio/transcribe", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as TranscriptionResponse;
      const transcript = payload.data?.transcript?.trim();

      if (!response.ok || !payload.success || !transcript) {
        throw new Error(
          payload.error?.message ?? "The recording could not be transcribed.",
        );
      }

      onTranscript(transcript);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The recording could not be transcribed.",
      );
    } finally {
      setTranscribing(false);
    }
  };

  const finishRecording = () => {
    const recorder = recorderRef.current;

    if (recorder?.state === "recording") recorder.stop();
  };

  const cancelRecording = () => {
    discardRecordingRef.current = true;
    finishRecording();
  };

  const startRecording = async () => {
    setError(null);

    if (
      typeof MediaRecorder === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setError("Voice recording is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = chooseRecordingMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      discardRecordingRef.current = false;
      startedAtRef.current = Date.now();
      setElapsedSeconds(0);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        clearRecordingTimer();
        stopMediaTracks();
        setRecording(false);
        recorderRef.current = null;

        if (discardRecordingRef.current) {
          chunksRef.current = [];
          return;
        }

        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || mimeType || "audio/webm",
        });
        chunksRef.current = [];
        void transcribeRecording(blob);
      };

      recorder.start();
      setRecording(true);
      timerRef.current = window.setInterval(() => {
        const nextElapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setElapsedSeconds(nextElapsed);

        if (nextElapsed >= MAX_RECORDING_SECONDS && recorder.state === "recording") {
          recorder.stop();
        }
      }, 250);
    } catch (recordingError) {
      stopMediaTracks();
      setError(
        recordingError instanceof DOMException && recordingError.name === "NotAllowedError"
          ? "Microphone permission was denied. Allow access and try again."
          : "The microphone could not be started.",
      );
    }
  };

  useEffect(() => {
    return () => {
      clearRecordingTimer();
      const recorder = recorderRef.current;

      if (recorder && recorder.state === "recording") {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        recorder.stop();
      }

      stopMediaTracks();
    };
  }, []);

  return (
    <>
      {recording ? (
        <Stack
          direction="row"
          spacing={0.25}
          alignItems="center"
          sx={{
            pl: 1,
            borderRadius: `${dashboardTokens.radiusSm}px`,
            bgcolor: "rgba(239,68,68,0.12)",
            border: "1px solid rgba(248,113,113,0.28)",
          }}
        >
          <Typography
            variant="caption"
            aria-live="polite"
            sx={{ color: "#fca5a5", whiteSpace: "nowrap" }}
          >
            {elapsedSeconds >= RECORDING_WARNING_SECONDS
              ? `Stops in ${formatDuration(Math.max(0, MAX_RECORDING_SECONDS - elapsedSeconds))}`
              : `Recording ${formatDuration(elapsedSeconds)}`}
          </Typography>
          <Tooltip title="Cancel and discard recording">
            <IconButton
              aria-label="Cancel voice recording"
              size="small"
              onClick={cancelRecording}
              sx={{ color: dashboardTokens.textMuted }}
            >
              <CloseRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Stop and transcribe">
            <IconButton
              aria-label="Stop voice recording"
              size="small"
              onClick={finishRecording}
              sx={{ color: "#f87171" }}
            >
              <StopCircleRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      ) : (
        <Tooltip
          title={
            transcribing
              ? "Transcribing recording"
              : "Record voice input for transcription"
          }
        >
          <span>
            <IconButton
              type="button"
              aria-label={transcribing ? "Transcribing voice input" : "Start voice input"}
              onClick={() => void startRecording()}
              disabled={disabled || transcribing}
              sx={{
                width: 36,
                height: 36,
                borderRadius: `${dashboardTokens.radiusSm}px`,
                color: dashboardTokens.textMuted,
                "&:hover": {
                  color: dashboardTokens.text,
                  bgcolor: dashboardTokens.surfaceAlt,
                },
              }}
            >
              {transcribing ? <CircularProgress size={18} /> : <MicRoundedIcon fontSize="small" />}
            </IconButton>
          </span>
        </Tooltip>
      )}
      <Snackbar
        open={Boolean(error)}
        autoHideDuration={6000}
        onClose={() => setError(null)}
      >
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>
    </>
  );
}
