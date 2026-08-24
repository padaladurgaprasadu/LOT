# LOT - Autonomous AI Agent

**LOT** is a modern, dark-themed AI Agent web interface 

Developed by **Durga prasadu padala**.

---

## ⚡ Features

- **Exact Dark Minimal Theme**: Pure `#000000` aesthetic with sleek typography, custom glowing mandala logo, and high contrast text.
- **Collapsible Sidebar**:
  - Top header with LOT Logo & Title.
  - **New Chat** button with white pen icon.
  - **Schedule Tasks**: Automate recurring prompt runs & cron triggers.
  - **Projects Workspace**: Contextual projects and custom instructions.
  - **Chat History**: Categorized by Today, Yesterday, and Previous 7 Days with rename and delete options.
  - **User Profile**: Bottom card with account settings and Sign In / Sign Up modal.
- **Top Bar**:
  - Model Selector .
  - API Key status indicator & settings modal.
  - Share button (Copy link, export formatted Markdown, download JSON).
- **Hero Screen**:
  - Centered *"Where should we begin?"* typography and quick prompt starter cards.
- **Floating Capsule Input**:
  - `+` menu for file uploads, Code mode, and Web search context.
  - Auto-expanding multiline input (`Ask LOT anything...`).
  - Voice Microphone (Web Speech API speech-to-text).
  - Upward send arrow & Stop generation button.
  - Caption: `LOT can make mistakes. Please check important information.`
- **Agent Intelligence & Streaming**:
  - Real-time token streaming.
  - Markdown formatting & syntax-highlighted code blocks with 1-click copy.
  - Collapsible **Thought Process & Reasoning Trace** drawer (for DeepSeek-R1 and Nemotron).
  - Text-to-speech audio playback.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure your API Key (Optional)
Either add it in the app's **Settings (⚙)** modal or create `.env.local`:
```bash
YOUR_API_KEY=your-key-here
```

### 3. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.
