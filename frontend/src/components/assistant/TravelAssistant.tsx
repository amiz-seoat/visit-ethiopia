import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, MessageCircle, Send, X, ExternalLink } from 'lucide-react';
import { askAssistant, type AssistantSource, type ChatTurn } from '../../api/assistant';
import { getErrorMessage } from '../../services/api';

interface Msg extends ChatTurn {
  sources?: AssistantSource[];
  mode?: 'llm' | 'retrieval';
  error?: boolean;
}

const STORAGE_KEY = 've-assistant-chat';
const SUGGESTIONS = [
  'Which places do you know?',
  'When is Timket and where should I see it?',
  'What should I see in Lalibela?',
  'Best lakes near Hawassa and Langano?',
  'Which museums are in Addis Ababa?',
];

function loadSaved(): Msg[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(-20) : [];
  } catch {
    return [];
  }
}

/** Render the assistant's light markdown (bold, bullets, [n] citations) without HTML injection. */
function RichText({ text, sources }: { text: string; sources?: AssistantSource[] }) {
  const inline = (line: string, key: string): ReactNode[] =>
    line.split(/(\*\*[^*]+\*\*|\[\d+\])/g).map((part, i) => {
      const k = `${key}-${i}`;
      if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={k}>{part.slice(2, -2)}</strong>;
      const cite = part.match(/^\[(\d+)\]$/);
      if (cite) {
        const src = sources?.find((s) => s.n === Number(cite[1]));
        return (
          <sup key={k} className="text-amber-700 font-medium" title={src?.title}>
            [{cite[1]}]
          </sup>
        );
      }
      return <Fragment key={k}>{part}</Fragment>;
    });

  const lines = text.split('\n');
  const out: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = (i: number) => {
    if (!bullets.length) return;
    out.push(
      <ul key={`ul-${i}`} className="list-disc pl-5 space-y-0.5 my-1">
        {bullets.map((b, j) => <li key={j}>{inline(b, `li-${i}-${j}`)}</li>)}
      </ul>
    );
    bullets = [];
  };
  lines.forEach((line, i) => {
    const m = line.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)$/);
    if (m) {
      bullets.push(m[1]);
      return;
    }
    flush(i);
    if (line.trim()) out.push(<p key={`p-${i}`} className="my-1">{inline(line.replace(/^#+\s*/, ''), `p-${i}`)}</p>);
  });
  flush(lines.length);
  return <>{out}</>;
}

function Sources({ sources }: { sources: AssistantSource[] }) {
  if (!sources.length) return null;
  // One row per place/listing (knowledge chunks share a place).
  const seen = new Set<string>();
  const rows = sources.filter((s) => {
    const key = s.id.split('#')[0];
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return (
    <div className="mt-2 border-t border-gray-200 pt-2 space-y-1.5">
      <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">Sources</p>
      {rows.map((s) => (
        <div key={s.id} className="text-xs flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-gray-500">[{s.n}]</span>
          {s.href ? (
            <Link to={s.href} className="font-medium text-amber-800 hover:underline">{s.title}</Link>
          ) : (
            <span className="font-medium text-gray-800">{s.title}</span>
          )}
          {s.href && <span className="text-[10px] bg-amber-100 text-amber-900 rounded px-1">Book</span>}
          {s.mapUrl && (
            <a href={s.mapUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-gray-600 hover:text-amber-700">
              <MapPin size={11} aria-hidden /> Map
            </a>
          )}
          {s.links?.[0] && (
            <a href={s.links[0]} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-0.5 text-gray-600 hover:text-amber-700">
              <ExternalLink size={11} aria-hidden /> Reference
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

export function TravelAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>(loadSaved);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-20)));
    } catch {
      /* storage unavailable: chat still works for this page view */
    }
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  // Other parts of the page can open the guide: window.dispatchEvent(new Event('open-assistant')).
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener('open-assistant', onOpen);
    return () => window.removeEventListener('open-assistant', onOpen);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const send = async (text: string) => {
    const q = text.trim().slice(0, 800);
    if (!q || busy) return;
    const history: ChatTurn[] = messages.filter((m) => !m.error).map(({ role, content }) => ({ role, content }));
    setMessages((m) => [...m, { role: 'user', content: q }]);
    setInput('');
    setBusy(true);
    try {
      const reply = await askAssistant(q, history);
      setMessages((m) => [...m, { role: 'assistant', content: reply.answer, sources: reply.sources, mode: reply.mode }]);
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', content: getErrorMessage(err, 'The assistant is unavailable right now. Please try again.'), error: true }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-[60] flex items-center gap-2 rounded-full bg-amber-700 text-white px-4 py-3 shadow-lg hover:bg-amber-800 focus:outline-none focus:ring-4 focus:ring-amber-300"
          aria-label="Open the travel assistant"
        >
          <MessageCircle size={20} aria-hidden />
          <span className="text-sm font-medium hidden sm:inline">Ask about Ethiopia</span>
        </button>
      )}

      {open && (
        <section
          className="fixed z-[60] bottom-0 right-0 sm:bottom-5 sm:right-5 w-full sm:w-[400px] h-[85vh] sm:h-[600px] max-h-screen flex flex-col bg-white sm:rounded-xl shadow-2xl border border-gray-200"
          role="dialog"
          aria-label="Travel assistant"
        >
          <header className="flex items-center justify-between px-4 py-3 bg-amber-800 text-white sm:rounded-t-xl">
            <div>
              <h2 className="font-semibold text-sm">Visit Ethiopia travel assistant</h2>
              <p className="text-[11px] text-amber-100">Places, new destinations, hotels &amp; restaurants</p>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button onClick={() => setMessages([])} className="text-[11px] text-amber-100 hover:text-white px-2 py-1">Clear</button>
              )}
              <button onClick={() => setOpen(false)} aria-label="Close assistant" className="p-1 rounded hover:bg-amber-700"><X size={18} /></button>
            </div>
          </header>

          <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3 text-sm" aria-live="polite">
            {!messages.length && (
              <div className="text-gray-600">
                <p className="mb-3">Selam! Ask me about more than 90 places and topics: historic sites like Lalibela and Gondar, lakes and national parks, Addis Ababa's museums, festivals like Timket and Meskel, Ethiopian food and coffee, new destinations like Entoto and Gorgora, and where to stay and eat.</p>
                <div className="flex flex-col gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => send(s)} className="text-left border border-amber-200 bg-amber-50/60 rounded-lg px-3 py-2 hover:bg-amber-100 text-amber-900">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div
                  className={
                    m.role === 'user'
                      ? 'max-w-[85%] rounded-2xl rounded-br-sm bg-amber-700 text-white px-3 py-2 whitespace-pre-wrap'
                      : `max-w-[92%] rounded-2xl rounded-bl-sm px-3 py-2 ${m.error ? 'bg-red-50 text-red-800' : 'bg-gray-100 text-gray-900'}`
                  }
                >
                  {m.role === 'user' ? m.content : <RichText text={m.content} sources={m.sources} />}
                  {m.sources && <Sources sources={m.sources} />}
                  {m.mode === 'retrieval' && m.sources && m.sources.length > 0 && (
                    <p className="mt-1 text-[10px] text-gray-500">Quick answer from the travel guide.</p>
                  )}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-gray-100 px-3 py-2 text-gray-500" aria-label="Assistant is typing">
                  <span className="inline-flex gap-1"><span className="animate-bounce">•</span><span className="animate-bounce [animation-delay:150ms]">•</span><span className="animate-bounce [animation-delay:300ms]">•</span></span>
                </div>
              </div>
            )}
          </div>

          <form
            className="border-t p-2 flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <textarea
              ref={inputRef}
              rows={1}
              maxLength={800}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Ask about a place, hotel or restaurant…"
              aria-label="Your question"
              className="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 text-sm max-h-28 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <button type="submit" disabled={busy || !input.trim()} aria-label="Send"
              className="rounded-lg bg-amber-700 text-white p-2.5 disabled:opacity-40 hover:bg-amber-800">
              <Send size={16} />
            </button>
          </form>
          <p className="px-3 pb-2 text-[10px] text-gray-400">AI answers can be wrong. Check travel advisories and confirm details with hotels before you go.</p>
        </section>
      )}
    </>
  );
}

export default TravelAssistant;
