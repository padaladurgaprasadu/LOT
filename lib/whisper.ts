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
  const groqKey = process.env.GROQ_API_KEY;
  const openAiKey = process.env.OPENAI_API_KEY || process.env.WHISPER_API_KEY;
  const apiKey = groqKey || openAiKey;

  if (!apiKey) {
    throw new Error(
      "Speech-to-text is not configured on this server. Set GROQ_API_KEY, OPENAI_API_KEY, or WHISPER_API_KEY to enable voice transcription."
    );
  }

  const endpoint = groqKey
    ? "https://api.groq.com/openai/v1/audio/transcriptions"
    : "https://api.openai.com/v1/audio/transcriptions";
  const modelName = groqKey ? "whisper-large-v3-turbo" : "whisper-1";

  try {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType });
    formData.append("file", blob, fileName);
    formData.append("model", modelName);
    formData.append("response_format", "verbose_json");
    formData.append("language", "en");

    const res = await fetch(endpoint, {
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
