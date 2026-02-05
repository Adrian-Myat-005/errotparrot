# EarrotParrot - AI Shadowing Engine

**EarrotParrot** is a modern language learning application designed for the "Shadowing" technique. It uses advanced AI to provide real-time feedback, human-like speech synthesis, and intelligent pronunciation coaching.

## 🚀 Features

### 🎙️ Hybrid Shadowing Engine
*   **Free Mode:** Uses browser-native SpeechSynthesis and SpeechRecognition for unlimited, offline practice.
*   **Power Mode (AI-Enhanced):**
    *   **Edge-TTS:** Human-like neural voices for natural listening practice.
    *   **Groq Whisper:** Ultra-fast, state-of-the-art speech-to-text transcription.
    *   **Google Gemini:** Detailed AI coaching with pronunciation and fluency scoring.

### ✨ Key Capabilities
*   **AI Lesson Generator:** Generate custom practice paragraphs on any topic (e.g., "Business Meeting", "Travel Tips").
*   **Karaoke Highlighting:** Real-time word tracking as you listen or speak.
*   **Audio Visualizer:** Visual feedback of your speech intensity.
*   **Progress History:** Localized history tracking of your scores and improvements.

## 🛠️ Tech Stack

*   **Frontend:** HTML5, CSS3, Vanilla JavaScript.
*   **Backend (Serverless):** 
    *   Node.js (Vercel Functions) for Transcription and Scoring.
    *   Python (Vercel Functions) for Edge-TTS generation.
*   **AI Models:** 
    *   Google Gemini Pro (Scoring & Generation)
    *   Groq Whisper (Transcription)
    *   Edge-TTS (Neural Speech)

## 📦 Project Structure

```text
├── api/                # Vercel Serverless Functions
│   ├── generate.js     # AI Lesson Generation (Gemini)
│   ├── score.js        # Pronunciation Scoring (Gemini)
│   ├── transcribe.js   # Audio Transcription (Groq/Whisper)
│   └── tts.py          # Neural TTS (Edge-TTS)
├── app.js              # UI Orchestration
├── ShadowingEngine.js  # Core Audio/AI Logic
├── index.html          # Main Interface
├── style.css           # Styling
└── vercel.json         # Vercel Configuration
```

## 🚦 Getting Started

### 1. Prerequisites
*   Node.js 20.x
*   API Keys for **Groq** and **Google Gemini**.

### 2. Configuration
Create a `.env` file or set environment variables in Vercel:
```ini
GROQ_API_KEY=your_groq_key
GEMINI_API_KEY=your_gemini_key
```

### 3. Local Development
```bash
npm install
vercel dev
```
Open the provided local URL (usually `http://localhost:3000`) to start practicing.

## ☁️ Deployment

Deployed effortlessly to **Vercel**:
1. Push to GitHub.
2. Import project in Vercel.
3. Add Environment Variables.
4. Deploy!

## 📜 License
ISC
