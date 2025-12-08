"use client";
import { useEffect, useRef, useState } from "react";

type CurrentInfo = { lang: string; text: string } | null;
type CacheEntry = { url?: string; loading: boolean; error?: string };

export default function TTSButton() {
  const arabicText = `كيف ترى تأثير الذكاء الاصطناعي على حياتنا اليومية خلال السنوات القادمة؟ ما هي التحديات التي قد نواجهها عند الاعتماد على الآلات والبرمجيات الذكية؟`;
  const frenchText = `Comment voyez-vous l'impact de l'intelligence artificielle sur notre vie quotidienne ?`;
  const englishText = `How do you see the impact of artificial intelligence on our daily lives in the coming years?`;

  const languages = [
    { key: "ar-SA-HamedNeural", text: arabicText, label: "استمع للسؤال العربي" },
    { key: "fr-FR-HenriNeural", text: frenchText, label: "Écouter la question française" },
    { key: "en-US-AndrewNeural", text: englishText, label: "Listen to English question" },
  ];

  // refs and state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const controllersRef = useRef<Record<string, AbortController | null>>({});
  const createdUrlsRef = useRef<Record<string, string>>({}); // for cleanup

  const [loading, setLoading] = useState(false); // UI-wide "playing/generating" flag
  const [current, setCurrent] = useState<CurrentInfo>(null);
  const [error, setError] = useState<string | null>(null);

  // cache per-voice/url
  const [cache, setCache] = useState<Record<string, CacheEntry>>(() =>
    languages.reduce((acc, l) => {
      acc[l.key] = { loading: true }; // start as loading
      return acc;
    }, {} as Record<string, CacheEntry>)
  );

  // cleanup on unmount: abort controllers + revoke objectURLs + stop audio
  useEffect(() => {
    return () => {
      // abort any in-flight fetches
      Object.values(controllersRef.current).forEach((c) => c?.abort());
      // revoke created URLs
      Object.values(createdUrlsRef.current).forEach((u) => {
        try {
          URL.revokeObjectURL(u);
        } catch {}
      });
      // stop audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Prefetch all languages on mount
  useEffect(() => {
    languages.forEach((langObj) => {
      // only fetch if not already fetched (idempotent across remount)
      if (cache[langObj.key] && cache[langObj.key].url) return;

      const controller = new AbortController();
      controllersRef.current[langObj.key] = controller;

      // set loading flag for this lang
      setCache((prev) => ({ ...prev, [langObj.key]: { ...(prev[langObj.key] ?? {}), loading: true } }));

      fetch("http://localhost:8000/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: langObj.text, lang: langObj.key }),
        signal: controller.signal,
      })
        .then(async (res) => {
          if (!res.ok) {
            const txt = await res.text().catch(() => "");
            throw new Error(`TTS failed: ${res.status} ${res.statusText} ${txt}`);
          }
          return res.blob();
        })
        .then((blob) => {
          const url = URL.createObjectURL(blob);
          createdUrlsRef.current[langObj.key] = url;
          setCache((prev) => ({ ...prev, [langObj.key]: { url, loading: false } }));
        })
        .catch((err: any) => {
          if (err?.name === "AbortError") {
            // aborted - ignore
            setCache((prev) => ({ ...prev, [langObj.key]: { ...(prev[langObj.key] ?? {}), loading: false, error: "aborted" } }));
            return;
          }
          console.error("Prefetch error", langObj.key, err);
          setCache((prev) => ({ ...prev, [langObj.key]: { ...(prev[langObj.key] ?? {}), loading: false, error: err?.message ?? "unknown" } }));
        })
        .finally(() => {
          controllersRef.current[langObj.key] = null;
        });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  // helper to stop previous audio and abort any on-going manual request
  function stopPrevious() {
    // If audio is playing, stop it
    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch (e) {
        // ignore
      }
      audioRef.current = null;
    }
  }

  // Play the cached audio if available, otherwise generate on-demand
  async function handleSpeak(text: string, lang: string) {
    stopPrevious();
    setError(null);
    setLoading(true);
    setCurrent({ lang, text });

    const cached = cache[lang];

    try {
      let urlToPlay: string | undefined = cached?.url;

      // if we don't have a cached url or it had an error, generate on-demand
      if (!urlToPlay) {
        // create a controller for this on-demand request so user can abort (if you want)
        const controller = new AbortController();
        controllersRef.current[lang] = controller;

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
        urlToPlay = URL.createObjectURL(blob);
        // cache this generated audio for future plays
        createdUrlsRef.current[lang] = urlToPlay;
        setCache((prev) => ({ ...prev, [lang]: { url: urlToPlay, loading: false } }));
      }

      if (!urlToPlay) {
        throw new Error("No audio available");
      }

      // create a fresh Audio element and play it
      const audio = new Audio(urlToPlay);
      audioRef.current = audio;

      audio.onended = () => {
        setLoading(false);
      };
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
      // remove the temporary controller used for on-demand (if any)
      controllersRef.current[lang] = null;
    }
  }

  // UI helper for buttons (unchanged)
  const Button: React.FC<{ onClick: () => void; children: React.ReactNode; title?: string; disabled?: boolean }> = ({
    onClick,
    children,
    title,
    disabled,
  }) => (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
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
        cursor: disabled ? "not-allowed" : "pointer",
        background: "#fff",
        boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
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
        {languages.map((l) => (
          <Button
            key={l.key}
            onClick={() => handleSpeak(l.text, l.key)}
            title={l.label}
            disabled={cache[l.key]?.loading === true && !cache[l.key]?.url} // disable only while initial prefetch loading with no url
          >
            {l.label}
            {/* show small status */}
            {cache[l.key]?.loading && <span style={{ marginLeft: 8 }}>⏳</span>}
            {cache[l.key]?.error && <span style={{ marginLeft: 8, color: "crimson" }}>⚠</span>}
          </Button>
        ))}
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
        {loading && <span>Loading audio...</span>}
        {current && !loading && (
          <span>{error ? `Error: ${error}` : `Last action: ${shortText(current.text)} — ${current.lang}`}</span>
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
