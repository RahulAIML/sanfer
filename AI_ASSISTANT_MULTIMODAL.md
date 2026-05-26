# Sanfer Dashboard — AI Assistant Architecture & Multimodal Support

> Documents the AI assistant implementation, context injection system, and multimodal (text + image) capabilities.

---

## 1. Overview

The Sanfer dashboard includes an embedded AI assistant powered by **Google Gemini 2.0 Flash**, accessible via the sparkle icon (✦) in the bottom-right corner. It provides:

- Natural language Q&A about Sanfer simulation data
- Automatic dashboard context injection (KPIs, active filters, current page)
- Screenshot/image upload for visual analysis
- Markdown-rendered responses with syntax highlighting
- Bilingual support (Spanish / English, auto-detected from dashboard language setting)

---

## 2. Architecture

```
src/components/ai/
└── AIAssistant.tsx      — Panel UI, message state, context builder, Gemini calls
```

### 2.1 Panel State

Managed via Zustand (`useAppStore`):

| State key | Type | Description |
|---|---|---|
| `isAIPanelOpen` | boolean | Panel visibility |
| `toggleAIPanel` | () => void | Open/close toggle |

Panel is rendered in `App.tsx` outside the router — persists across page navigation.

### 2.2 Message State

Local to `AIAssistant.tsx` via `useState`:

```typescript
interface Message {
  role: 'user' | 'assistant'
  content: string
  image?: string   // base64 data URL for multimodal messages
}
```

Conversation history maintained in component state for the session; cleared on panel close.

---

## 3. Context Injection System

Every API call to Gemini includes a **system context block** prepended to the conversation. This block is rebuilt on each message to reflect the current dashboard state.

### 3.1 Context Builder (`buildContext()`)

```typescript
function buildContext(): string {
  const ctx = [
    "You are the Sanfer Sales Training AI assistant...",
    `Language: ${language === 'es' ? 'Spanish' : 'English'}`,
    `Current page: ${currentPageName}`,
  ]

  if (kpis) {
    ctx.push(`KPI Summary:
      - Total simulations: ${kpis.totalSimulations}
      - Average score: ${kpis.averageScore}%
      - Pass rate: ${kpis.passRate}%
      - Active advisors: ${kpis.activeAdvisors}
      - Passed: ${kpis.passCount} | Failed: ${kpis.failCount}`)
  }

  if (filters.selectedActivityId) {
    ctx.push(`Active filter: Activity ID ${filters.selectedActivityId}`)
  }
  if (filters.selectedLineId) {
    ctx.push(`Active filter: Business Line ID ${filters.selectedLineId}`)
  }
  if (filters.dateFrom || filters.dateTo) {
    ctx.push(`Date range: ${filters.dateFrom ?? 'start'} → ${filters.dateTo ?? 'now'}`)
  }

  return ctx.join('\n')
}
```

### 3.2 Context Scoping by Page

| Page | Extra context injected |
|---|---|
| Overview | KPI summary, active filters |
| Advisors | Same |
| Business Lines | Line stats summary if available |
| Reports | KPI summary + sim count |
| All pages | Current page name |

---

## 4. Multimodal Support

### 4.1 Image Upload

Users can attach images to their messages by clicking the image icon (📎) in the chat input area. Supported formats: any browser-readable image (PNG, JPEG, WebP, GIF).

**Implementation:**

```typescript
// File input → FileReader → base64 data URL
const reader = new FileReader()
reader.onload = (e) => {
  setAttachedImage(e.target?.result as string)
}
reader.readAsDataURL(file)
```

The base64 data URL is stored in component state and displayed as a preview thumbnail in the input area.

### 4.2 Multimodal API Call

When an image is attached, the Gemini API call switches from text-only to multimodal `inlineData`:

```typescript
const parts: Part[] = []

if (image) {
  const [header, data] = image.split(',')
  const mimeType = header.match(/:(.*?);/)?.[1] ?? 'image/png'
  parts.push({
    inlineData: { mimeType, data }
  })
}

parts.push({ text: `${systemContext}\n\nUser: ${userMessage}` })

const result = await model.generateContent(parts)
```

### 4.3 Use Cases

| Use case | Example |
|---|---|
| Chart interpretation | Upload a screenshot → "What does this trend mean for Q3?" |
| Score analysis | Paste a score table image → "Which advisors need coaching?" |
| Document parsing | Upload a training doc → "Summarize the key techniques" |
| Error diagnosis | Screenshot of an error → "What's wrong here?" |

---

## 5. Gemini Configuration

### 5.1 Model

| Parameter | Value |
|---|---|
| Model ID | `gemini-2.0-flash` (default) |
| Override | `VITE_GEMINI_MODEL` env var |
| API key | `VITE_GEMINI_API_KEY` env var |

### 5.2 Generation Config

```typescript
const generationConfig = {
  temperature: 0.7,
  topP: 0.95,
  maxOutputTokens: 1024,
}
```

Temperature 0.7 balances analytical precision with natural conversational flow.

### 5.3 Safety Settings

Default Gemini safety settings apply. No custom harm categories overridden — the assistant is scoped to sales training analytics and does not generate sensitive content.

---

## 6. Response Rendering

AI responses are rendered via `react-markdown` with:

- **GFM** (GitHub Flavored Markdown) — tables, strikethrough, task lists
- **Syntax highlighting** via `react-syntax-highlighter` (Prism, dark theme)
- **Custom renderers** for code blocks: language badge, copy button

```tsx
<ReactMarkdown
  remarkPlugins={[remarkGfm]}
  components={{
    code({ node, inline, className, children, ...props }) {
      const lang = /language-(\w+)/.exec(className ?? '')?.[1]
      return !inline && lang ? (
        <SyntaxHighlighter language={lang} style={oneDark} PreTag="div">
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      ) : (
        <code className="bg-slate-800 px-1 rounded text-accent" {...props}>
          {children}
        </code>
      )
    },
  }}
>
  {message.content}
</ReactMarkdown>
```

---

## 7. System Prompt

The AI is initialized with:

```
You are the Sanfer Sales Training AI assistant embedded in the Sanfer Sales Training 
Intelligence Platform. You help sales managers and training coordinators analyze 
simulation performance data, identify coaching opportunities, and interpret KPI trends.

You have access to real-time dashboard context including KPI summaries and active 
filters. Be concise, data-driven, and actionable. When making recommendations, 
reference the specific metrics shown in the dashboard context.

Respond in the same language as the user (Spanish or English).
```

### 7.1 Greeting Messages

| Language | Greeting |
|---|---|
| ES | "¡Hola! Soy tu asistente de inteligencia de entrenamiento Sanfer. Puedo ayudarte a analizar el rendimiento de simulaciones, identificar oportunidades de coaching y responder preguntas sobre los datos del dashboard. ¿En qué puedo ayudarte?" |
| EN | "Hi! I'm your Sanfer training intelligence assistant. I can help you analyze simulation performance, identify coaching opportunities, and answer questions about your dashboard data. How can I help?" |

---

## 8. Graceful Degradation

| Condition | Behavior |
|---|---|
| `VITE_GEMINI_API_KEY` not set | Input disabled, message: "AI assistant not configured. Set VITE_GEMINI_API_KEY." |
| Gemini API error | Error message shown in chat: "Sorry, I encountered an error. Please try again." |
| No dashboard data loaded | Context omits KPI block — assistant still responds to general questions |
| Image too large | Browser FileReader handles; Gemini has 20MB inline data limit |

---

## 9. Future Enhancements

| Enhancement | Priority | Notes |
|---|---|---|
| Conversation persistence | Medium | Save chat history to `localStorage` per session |
| Proactive insights | Medium | Push alert if pass rate drops >10% — AI suggests action |
| Export chat transcript | Low | Download conversation as PDF |
| Voice input | Low | Web Speech API → text → Gemini |
| Function calling | High | Allow AI to apply filters, navigate to pages |
| Streaming responses | Medium | `generateContentStream()` for progressive rendering |
