/**
 * LOT-OS Client-Side Speech Transcription Web Worker
 * Specification: Milestone 1 (R1) - Off-thread Whisper speech-to-text inference
 *
 * Emits progress, status, tokens, and final transcription results.
 * Gracefully signals fallback to server-side endpoint (/api/whisper) if WebAssembly
 * or @huggingface/transformers pipeline fails to initialize in the worker context.
 */

import type {
  TranscriptionWorkerIncomingMessage,
  TranscriptionWorkerOutgoingMessage,
} from "@/lib/lot-os/types";

// Type-safe worker context messaging
const post = (msg: TranscriptionWorkerOutgoingMessage): void => {
  if (typeof self !== "undefined" && typeof (self as any).postMessage === "function") {
    (self as any).postMessage(msg);
  }
};

interface TranscriptionState {
  modelName: string;
  language: string;
  sampleRate: number;
  isInitializing: boolean;
  isReady: boolean;
  fallbackActive: boolean;
  pipelineInstance: any | null;
  audioBuffer: number[];
}

const state: TranscriptionState = {
  modelName: "onnx-community/whisper-tiny.en",
  language: "en",
  sampleRate: 16000,
  isInitializing: false,
  isReady: false,
  fallbackActive: false,
  pipelineInstance: null,
  audioBuffer: [],
};

let initPromise: Promise<any> | null = null;

/**
 * Lazily initializes the Hugging Face Transformers ASR pipeline inside the worker.
 * Uses a singleton initPromise to ensure concurrent messages await the single
 * in-flight compilation rather than spawning duplicate WASM compilers.
 */
async function getTranscriber() {
  if (state.pipelineInstance) {
    return state.pipelineInstance;
  }

  if (state.fallbackActive) {
    throw new Error("Local worker pipeline disabled; fallback active.");
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    state.isInitializing = true;
    post({
      type: "STATUS",
      status: "loading",
      message: `Initializing local Whisper pipeline (${state.modelName})...`,
    });

    try {
      post({ type: "PROGRESS", progress: 15, stage: "loading_transformers_module" });

      // Dynamic import to prevent SSR bundling failures and support graceful fallback
      const { pipeline, env } = await import("@huggingface/transformers");

      if (env) {
        // Configure Hugging Face environment for worker/Wasm runtime
        env.allowLocalModels = false;
        if (env.backends?.onnx?.wasm) {
          env.backends.onnx.wasm.numThreads = 1;
        }
      }

      post({ type: "PROGRESS", progress: 40, stage: "compiling_onnx_weights" });

      const transcriber = await pipeline(
        "automatic-speech-recognition" as any,
        state.modelName,
        {
          progress_callback: (info: any) => {
            if (info && typeof info.progress === "number") {
              post({
                type: "PROGRESS",
                progress: Math.min(99, Math.round(info.progress * 100)),
                stage: info.status || "downloading_model",
              });
            }
          },
        }
      );

      state.pipelineInstance = transcriber;
      state.isReady = true;
      state.isInitializing = false;

      post({
        type: "STATUS",
        status: "ready",
        message: `Whisper pipeline (${state.modelName}) is compiled and ready.`,
      });
      post({ type: "PROGRESS", progress: 100, stage: "ready" });

      return transcriber;
    } catch (err: any) {
      state.isInitializing = false;
      state.isReady = false;
      state.fallbackActive = true;
      state.pipelineInstance = null;

      const errMsg = err?.message || "Failed to initialize @huggingface/transformers pipeline";
      console.warn("[TranscriptionWorker] Local ASR pipeline failed, enabling fallback:", errMsg);

      post({
        type: "STATUS",
        status: "fallback",
        message: "Client WebAssembly pipeline unavailable. Falling back to server-side Whisper API.",
      });

      post({
        type: "ERROR",
        error: errMsg,
        fallbackToCloud: true,
      });

      return null;
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

/**
 * Transcribes an accumulated or standalone audio buffer.
 */
async function processAudio(audioData: Float32Array, isFinal: boolean = false) {
  const startTime = Date.now();
  post({
    type: "STATUS",
    status: "processing",
    message: `Transcribing ${audioData.length} audio samples...`,
  });

  try {
    const transcriber = await getTranscriber();

    if (!transcriber) {
      // In fallback mode, advise client to dispatch audio buffer to /api/whisper
      post({
        type: "ERROR",
        error: "Local ASR worker inactive; route audio chunk to /api/whisper",
        fallbackToCloud: true,
      });
      return;
    }

    // Execute speech-to-text inference
    const output = await transcriber(audioData, {
      language: state.language,
      task: "transcribe",
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: false,
    });

    const transcribedText =
      typeof output?.text === "string"
        ? output.text.trim()
        : Array.isArray(output) && output[0]?.text
        ? output[0].text.trim()
        : "";

    if (transcribedText) {
      post({
        type: "TOKEN",
        token: transcribedText,
        isFinal,
      });

      post({
        type: "RESULT",
        text: transcribedText,
        confidence: 0.95,
        durationMs: Date.now() - startTime,
      });
    }

    post({
      type: "STATUS",
      status: isFinal ? "done" : "ready",
      message: isFinal ? "Transcription complete." : "Ready for next audio chunk.",
    });
  } catch (err: any) {
    const errMsg = err?.message || "Audio inference error in transcription worker";
    console.error("[TranscriptionWorker] Inference error:", errMsg);

    post({
      type: "ERROR",
      error: errMsg,
      fallbackToCloud: true,
    });

    post({
      type: "STATUS",
      status: "fallback",
      message: "Inference failed; routing to cloud Whisper fallback.",
    });
  }
}

// ==========================================
// Worker Event Listener
// ==========================================

if (typeof self !== "undefined") {
  self.addEventListener("message", async (event: MessageEvent<TranscriptionWorkerIncomingMessage>) => {
    const data = event.data;
    if (!data || !data.type) return;

    switch (data.type) {
      case "TRANSCRIPTION_START": {
        if (data.model) state.modelName = data.model;
        if (data.language) state.language = data.language;
        if (data.sampleRate) state.sampleRate = data.sampleRate;
        state.fallbackActive = false;
        state.audioBuffer = [];

        // Pre-warm or initialize the pipeline asynchronously
        await getTranscriber();
        break;
      }

      case "AUDIO_CHUNK": {
        if (!data.chunk || !(data.chunk instanceof Float32Array)) {
          post({
            type: "ERROR",
            error: "Invalid audio chunk provided; expected Float32Array",
          });
          return;
        }

        // If local pipeline has fallen back, immediately notify client to use server API
        if (state.fallbackActive) {
          post({
            type: "ERROR",
            error: "Worker operating in fallback mode",
            fallbackToCloud: true,
          });
          return;
        }

        // Accumulate incoming samples into audioBuffer
        for (let i = 0; i < data.chunk.length; i++) {
          state.audioBuffer.push(data.chunk[i]);
        }

        const isFinal = Boolean(data.isFinal);
        const shouldProcess =
          state.audioBuffer.length >= state.sampleRate || isFinal;

        if (shouldProcess && state.audioBuffer.length > 0) {
          const contiguousBuffer = new Float32Array(state.audioBuffer);
          state.audioBuffer = [];
          await processAudio(contiguousBuffer, isFinal);
        } else if (isFinal && state.audioBuffer.length === 0) {
          post({
            type: "STATUS",
            status: "done",
            message: "Transcription complete (empty buffer).",
          });
        }
        break;
      }

      case "RESET": {
        state.audioBuffer = [];
        post({
          type: "STATUS",
          status: state.isReady ? "ready" : "idle",
          message: "Worker audio buffer reset",
        });
        break;
      }

      case "TERMINATE": {
        state.pipelineInstance = null;
        initPromise = null;
        state.isReady = false;
        state.audioBuffer = [];
        post({
          type: "STATUS",
          status: "idle",
          message: "Worker terminated",
        });
        break;
      }

      default:
        console.warn("[TranscriptionWorker] Unknown message type:", (data as any).type);
        break;
    }
  });
}

export {};
