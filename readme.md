

---

## Backend Setup (FastAPI + edge_tts)

### 1. Install dependencies

```bash
pip install fastapi uvicorn edge-tts
```
### 3. Run the backend

```bash
uvicorn main:app --reload --port 8000
```

Backend will be available at:

```
http://localhost:8000/tts
```

---

## Frontend Setup (React / Next.js)

### 1. Create `TTSButton.tsx`

Use the **React component provided earlier** (with bell icon, loading state, and timer).

Key points:

* Uses `fetch("http://localhost:8000/tts")` to get audio
* Handles **multiple clicks** and **aborts previous requests**
* Tracks **elapsed time** for TTS generation
* Plays audio in browser

### 2. Add to a page/component

```tsx
import TTSButton from './TTSButton';

export default function Page() {
  return (
    <div>
      <h1>TTS Demo</h1>
      <TTSButton />
    </div>
  );
}
```

### 3. Run the frontend

```bash
npm install
npm run dev
```

Frontend runs at:

```
http://localhost:3000
```

---

## Features

* **Languages & Voices:** Customize `lang` property for any `edge_tts` voice
* **Loading Indicator:** Shows spinner + timer while TTS is generating
* **Abort Previous:** Clicking a button cancels previous request & plays new audio
* **Bell Icon:** User-friendly button icon
* **Last Played Info:** Shows text snippet, language, and last load time

---

## Example Usage

**Arabic Button:**

```
استمع للسؤال العربي 🔔
```

**French Button:**

```
Écouter la question française 🔔
```

**English Button:**

```
Listen to English question 🔔
```

**During loading:**

```
Loading audio... (0.42s elapsed)
```

**After playback:**

```
Last action: كيف ترى تأثير الذك… — ar-EG-ShakirNeural | Last load time: 0.42s
```

---

## Notes

* `edge_tts` supports a wide range of neural voices — change `lang` to any supported one
* Timer measures **time from request start until audio is ready**
* React frontend handles multiple rapid clicks gracefully
* Temporary audio files are automatically deleted when replaced

---

If you want, I can **update your React TTSButton** to **show a live-updating timer while the TTS request is in progress**, so the user can see the seconds counting up in real time — very useful for longer texts.

Do you want me to do that next?
