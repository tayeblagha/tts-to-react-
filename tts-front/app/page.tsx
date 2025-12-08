"use client";
import { useEffect, useRef, useState } from "react";

type CurrentInfo = { lang: string; text: string } | null;

export default function TTSButton() {
  const arabicText = `كيف ترى تأثير الذكاء الاصطناعي على حياتنا اليومية خلال السنوات القادمة؟ ما هي التحديات التي قد نواجهها عند الاعتماد على الآلات والبرمجيات الذكية؟`;
  const frenchText = `Comment voyez-vous l'impact de l'intelligence artificielle sur notre vie quotidienne ?`;
  const englishText = `How do you see the impact of artificial intelligence on our daily lives in the coming years?`;

  // refs and state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState<CurrentInfo>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number | null>(null);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      if (controllerRef.current) controllerRef.current.abort();
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }
    };
  }, []);

  // helper to abort previous request & stop audio
  function stopPrevious() {
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      } catch (e) {
        // ignore
      }
      audioRef.current = null;
    }
    setElapsedTime(null); // reset timer
  }

  async function handleSpeak(text: string, lang: string) {
    stopPrevious();
    setError(null);
    setLoading(true);
    setCurrent({ lang, text });

    startTimeRef.current = performance.now(); // start timer

    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      const res = await fetch("http://localhost:8000/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const bodyText = await res.text().catch(() => "");
        throw new Error(`TTS failed: ${res.status} ${res.statusText} ${bodyText}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
        audioRef.current = null;
      }

      const audio = new Audio(url);
      audioRef.current = audio;

      // calculate elapsed time
      if (startTimeRef.current !== null) {
        const elapsed = (performance.now() - startTimeRef.current) / 1000; // in seconds
        setElapsedTime(parseFloat(elapsed.toFixed(2)));
        startTimeRef.current = null;
      }

      audio.onended = () => setLoading(false);
      audio.onerror = () => {
        console.error("Audio playback error");
        setLoading(false);
        setError("Playback failed");
      };

      await audio.play();
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        console.error(err);
        setError(err?.message ?? "Unknown error");
      }
      setLoading(false);
    } finally {
      controllerRef.current = null;
    }
  }

  // UI helper for buttons
  const Button: React.FC<{ onClick: () => void; children: React.ReactNode; title?: string }> = ({
    onClick,
    children,
    title,
  }) => (
    <button
      onClick={onClick}
      title={title}
      aria-pressed={false}
      style={{
        display: "inline-flex",
        gap: 10,
        alignItems: "center",
        padding: "10px 14px",
        margin: 8,
        fontSize: 16,
        borderRadius: 10,
        border: "2px solid #ddd",
        cursor: "pointer",
        background: "#fff",
        boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <path
          fill="currentColor"
          d="M12 2a4 4 0 0 0-4 4v2.09C6.84 9.03 6 10.57 6 12.3V15l-1.29 1.29A1 1 0 0 0 5.7 18h12.6a1 1 0 0 0 .99-1.71L18 15v-2.7c0-1.73-.84-3.27-2-3.21V6a4 4 0 0 0-4-4zm0 20a2.5 2.5 0 0 0 2.45-2H9.55A2.5 2.5 0 0 0 12 22z"
        />
      </svg>
      <span>{children}</span>
    </button>
  );

  return (
    <div style={{ maxWidth: 720, margin: "2rem auto", textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
      <h2 style={{ marginBottom: 12 }}>Text-to-Speech (TTS)</h2>

      <textarea
        rows={5}
        style={{
          width: "100%",
          fontSize: 16,
          padding: 12,
          borderRadius: 8,
          border: "1px solid #ddd",
          resize: "vertical",
          boxSizing: "border-box",
        }}
        value={current?.text ?? arabicText}
        readOnly
        aria-label="TTS text preview"
      />

      <div style={{ marginTop: 12 }}>
        <Button onClick={() => handleSpeak(arabicText, "ar-EG-SalmaNeural")} title="استمع للسؤال العربي">
          استمع للسؤال العربي
        </Button>

        <Button onClick={() => handleSpeak(frenchText, "fr-FR-HenriNeural")} title="Écouter la question française">
          Écouter la question française
        </Button>

        <Button onClick={() => handleSpeak(englishText, "en-US-AndrewNeural")} title="Listen to English question">
          Listen to English question
        </Button>
      </div>

      <div
        aria-live="polite"
        style={{
          marginTop: 14,
          minHeight: 28,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 4,
          alignItems: "center",
          color: error ? "crimson" : "#333",
        }}
      >
        {loading && <span>Loading audio... {elapsedTime ? `(${elapsedTime}s elapsed)` : ""}</span>}
        {current && !loading && (
          <span>
            {error ? `Error: ${error}` : `Last action: ${shortText(current.text)} — ${current.lang}`}
            {elapsedTime && <span> | Last load time: {elapsedTime}s</span>}
          </span>
        )}
        {!current && !loading && <span>Idle</span>}
      </div>
    </div>
  );

  function shortText(t: string) {
    const max = 40;
    return t.length > max ? t.slice(0, max).trim() + "…" : t;
  }
}
