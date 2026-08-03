import { FormEvent, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';

type Auth = {
  token: string;
  organization: {
    id: string;
    name: string;
  };
};

type Citation = {
  number: number;
  filename: string;
  excerpt: string;
};

function App() {
  const [auth, setAuth] = useState<Auth | null>(() => {
    const storedAuth = localStorage.getItem('atlas-auth');
    return storedAuth ? JSON.parse(storedAuth) : null;
  });

  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [citations, setCitations] = useState<Citation[]>([]);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function authenticate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice('');

    try {
      const response = await fetch(`${API}/auth/${mode}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Could not authenticate');
      }

      localStorage.setItem('atlas-auth', JSON.stringify(data));
      setAuth(data);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  async function upload(e: FormEvent) {
    e.preventDefault();
    if (!file || !auth) return;

    setBusy(true);
    setNotice('');

    try {
      const body = new FormData();
      body.append('file', file);

      const response = await fetch(`${API}/organizations/${auth.organization.id}/documents`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${auth.token}`,
        },
        body,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Upload failed');
      }

      setNotice(`${data.filename} is ready to ask about.`);
      setFile(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  async function ask(e: FormEvent) {
    e.preventDefault();
    if (!question || !auth) return;

    setBusy(true);
    setAnswer('');

    try {
      const response = await fetch(`${API}/organizations/${auth.organization.id}/chat`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({ question }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Question failed');
      }

      setAnswer(data.answer);
      setCitations(data.citations);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Question failed');
    } finally {
      setBusy(false);
    }
  }

  function handleSignOut() {
    localStorage.removeItem('atlas-auth');
    setAuth(null);
  }

  function renderAuthView() {
    return (
      <main className="auth">
        <div className="auth-card">
          <a className="brand">
            <b>A</b> atlas
          </a>
          <p className="eyebrow">AI KNOWLEDGE BASE</p>
          <h1>{mode === 'register' ? 'Start your workspace.' : 'Welcome back.'}</h1>
          <p className="muted">Upload your team’s knowledge and get cited answers.</p>

          <form onSubmit={authenticate}>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>

            <label>
              Password
              <input
                type="password"
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>

            <button disabled={busy}>
              {busy ? 'Please wait…' : mode === 'register' ? 'Create workspace' : 'Sign in'}
            </button>
          </form>

          <p className="switch">
            {mode === 'register' ? 'Already have an account?' : 'New to Atlas?'}
            <button onClick={() => setMode(mode === 'register' ? 'login' : 'register')}>
              {mode === 'register' ? 'Sign in' : 'Create one'}
            </button>
          </p>

          {notice && <p className="notice">{notice}</p>}
        </div>
      </main>
    );
  }

  function renderAppView() {
    return (
      <main className="app">
        <header>
          <a className="brand">
            <b>A</b> atlas
          </a>

          <div className="workspace">
            <span className="dot" />
            {auth?.organization.name}
          </div>

          <button className="signout" onClick={handleSignOut}>
            Sign out
          </button>
        </header>

        <section className="hero">
          <p className="eyebrow">YOUR KNOWLEDGE, ANSWERED</p>
          <h1>Ask your workspace anything.</h1>
          <p>Atlas finds the relevant parts of your documents and cites every answer.</p>

          <form className="ask" onSubmit={ask}>
            <input
              placeholder="e.g. What is our refund policy?"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
            />
            <button disabled={busy}>Ask Atlas →</button>
          </form>
        </section>

        <section className="grid">
          <article className="panel">
            <h2>Add knowledge</h2>
            <p>PDF, DOCX, Markdown, or plain text. Up to 20MB.</p>

            <form className="upload" onSubmit={upload}>
              <input
                type="file"
                accept=".pdf,.docx,.md,.markdown,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/markdown,text/plain"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
              />
              <button disabled={!file || busy}>
                {busy ? 'Working…' : 'Upload document'}
              </button>
            </form>
          </article>

          <article className="panel answer">
            <h2>{answer ? 'Answer' : 'Ready when you are'}</h2>

            {answer ? (
              <>
                <p>{answer}</p>

                {citations.length > 0 && (
                  <div className="citations">
                    <strong>Sources</strong>
                    {citations.map((citation) => (
                      <div key={citation.number}>
                        <span>[{citation.number}]</span>
                        <b>{citation.filename}</b>
                        <small>{citation.excerpt}…</small>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p>Your answers will appear here with links back to the exact supporting source.</p>
            )}
          </article>
        </section>

        {notice && <div className="toast">{notice}</div>}
      </main>
    );
  }

  if (!auth) {
    return renderAuthView();
  }

  return renderAppView();
}

createRoot(document.getElementById('root')!).render(<App />);
