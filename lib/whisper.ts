/**
 * OpenAI Whisper Speech-to-Text & Transcription Engine
 * Inspired by https://github.com/openai/whisper
 */

export interface WhisperTranscriptionResult {
  text: string;
  language?: string;
  duration?: number;
  segments?: Array<{
    id: number;
    start: number;
    end: number;
    text: string;
  }>;
}

export async function transcribeAudioWithWhisper(
  audioBuffer: Buffer,
  fileName = "audio.webm",
  mimeType = "audio/webm"
): Promise<WhisperTranscriptionResult> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.WHISPER_API_KEY;

  if (!apiKey) {
    // Returning a canned sentence here made a misconfigured server look like a working
    // transcriber and silently put text the user never said into their message box.
    throw new Error(
      "Speech-to-text is not configured on this server. Set OPENAI_API_KEY (or WHISPER_API_KEY) to enable voice transcription."
    );
  }

  try {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType });
    formData.append("file", blob, fileName);
    formData.append("model", "whisper-1");
    formData.append("response_format", "verbose_json");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!res.ok) {
      throw new Error(`Whisper transcription failed with HTTP ${res.status}`);
    }

    const data = await res.json();
    return {
      text: data.text || "",
      language: data.language || "en",
      duration: data.duration || 0,
      segments: data.segments || [],
    };
  } catch (err: any) {
    console.error("OpenAI Whisper transcription error:", err?.message);
    throw new Error(err?.message || "Whisper transcription failed");
  }
}
