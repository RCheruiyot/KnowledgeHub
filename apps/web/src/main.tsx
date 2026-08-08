import { FormEvent, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@radix-ui/themes/styles.css';
import {
  Box,
  Button,
  Card,
  Container,
  Flex,
  Heading,
  Link,
  Text,
  TextField,
  Theme,
} from '@radix-ui/themes';

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
      <Box
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: '24px',
          background: 'radial-gradient(circle at 83% 12%, #eeeaff 0, transparent 25%), #fbfaf7',
        }}
      >
        <Card size="3" style={{ width: 'min(420px, 100%)', padding: '32px' }}>
          <Flex direction="column" gap="3">
            <Link href="#" style={{ textDecoration: 'none', color: 'inherit', fontSize: '21px', fontWeight: 800 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', borderRadius: '8px', background: '#f37c67', color: '#fff', marginRight: '8px' }}>
                K
              </span>
              KnowledgeHub
            </Link>

            <Text size="1" weight="bold" style={{ letterSpacing: '0.2em', color: '#817b89' }}>
              AI KNOWLEDGE BASE
            </Text>

            <Heading as="h1" size="7">
              {mode === 'register' ? 'Start your workspace.' : 'Welcome back.'}
            </Heading>

            <Text color="gray">
              Upload your team’s knowledge and get cited answers.
            </Text>

            <form onSubmit={authenticate}>
              <Flex direction="column" gap="3">
                <label>
                  <Text as="div" size="2" weight="bold" style={{ marginBottom: '6px' }}>
                    Email
                  </Text>
                  <TextField.Root>
                    <TextField.Input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                    />
                  </TextField.Root>
                </label>

                <label>
                  <Text as="div" size="2" weight="bold" style={{ marginBottom: '6px' }}>
                    Password
                  </Text>
                  <TextField.Root>
                    <TextField.Input
                      type="password"
                      minLength={8}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                    />
                  </TextField.Root>
                </label>

                <Button size="3" type="submit" disabled={busy}>
                  {busy ? 'Please wait…' : mode === 'register' ? 'Create workspace' : 'Sign in'}
                </Button>
              </Flex>
            </form>

            <Text size="2" color="gray">
              {mode === 'register' ? 'Already have an account?' : 'New to KnowledgeHub?'}{' '}
              <Button variant="ghost" size="2" type="button" onClick={() => setMode(mode === 'register' ? 'login' : 'register')}>
                {mode === 'register' ? 'Sign in' : 'Create one'}
              </Button>
            </Text>

            {notice && (
              <Text size="2" color="red">
                {notice}
              </Text>
            )}
          </Flex>
        </Card>
      </Box>
    );
  }

  function renderAppView() {
    return (
      <Container size="4" style={{ padding: '24px 24px 72px' }}>
        <Flex align="center" gap="4" wrap="wrap">
          <Link href="#" style={{ textDecoration: 'none', color: 'inherit', fontSize: '21px', fontWeight: 800 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', borderRadius: '8px', background: '#f37c67', color: '#fff', marginRight: '8px' }}>
              K
            </span>
            {auth?.organization.name || 'KnowledgeHub'}
          </Link>

          <Flex align="center" gap="2" ml="auto">
            <Box style={{ width: '8px', height: '8px', borderRadius: '999px', background: '#60b48c' }} />
            <Text size="2" color="gray">
              {auth?.organization.name || 'KnowledgeHub'}
            </Text>
          </Flex>

          <Button variant="ghost" size="2" type="button" onClick={handleSignOut}>
            Sign out
          </Button>
        </Flex>

        <Box style={{ padding: '80px 0 56px', maxWidth: '740px' }}>
          <Text size="1" weight="bold" style={{ letterSpacing: '0.2em', color: '#6954b9' }}>
            YOUR KNOWLEDGE, ANSWERED
          </Text>
          <Heading as="h1" size="8" style={{ marginTop: '12px' }}>
            Ask your workspace anything.
          </Heading>
          <Text size="4" color="gray" style={{ marginTop: '12px' }}>
            KnowledgeHub finds the relevant parts of your documents and cites every answer.
          </Text>

          <form onSubmit={ask} style={{ marginTop: '24px' }}>
            <Flex gap="3" wrap="wrap">
              <TextField.Root style={{ flex: 1, minWidth: '260px' }}>
                <TextField.Input
                  placeholder="e.g. What is our refund policy?"
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                />
              </TextField.Root>
              <Button size="3" type="submit" disabled={busy}>
                Ask KnowledgeHub →
              </Button>
            </Flex>
          </form>
        </Box>

        <Flex gap="4" wrap="wrap">
          <Card size="3" style={{ flex: '1 1 280px' }}>
            <Heading as="h2" size="4">
              Add knowledge
            </Heading>
            <Text color="gray" style={{ marginTop: '8px' }}>
              PDF, DOCX, Markdown, or plain text. Up to 20MB.
            </Text>

            <form onSubmit={upload} style={{ marginTop: '16px' }}>
              <Flex direction="column" gap="3">
                <input
                  type="file"
                  accept=".pdf,.docx,.md,.markdown,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/markdown,text/plain"
                  onChange={(event) => setFile(event.target.files?.[0] || null)}
                />
                <Button type="submit" disabled={!file || busy}>
                  {busy ? 'Working…' : 'Upload document'}
                </Button>
              </Flex>
            </form>
          </Card>

          <Card size="3" style={{ flex: '1 1 320px' }}>
            <Heading as="h2" size="4">
              {answer ? 'Answer' : 'Ready when you are'}
            </Heading>

            {answer ? (
              <Box style={{ marginTop: '12px' }}>
                <Text>{answer}</Text>

                {citations.length > 0 && (
                  <Box style={{ marginTop: '16px' }}>
                    <Text weight="bold">Sources</Text>
                    <Flex direction="column" gap="2" style={{ marginTop: '8px' }}>
                      {citations.map((citation) => (
                        <Box key={citation.number}>
                          <Text size="2" weight="bold">[{citation.number}]</Text>{' '}
                          <Text size="2" weight="bold">{citation.filename}</Text>
                          <Text size="2" color="gray" as="div">
                            {citation.excerpt}…
                          </Text>
                        </Box>
                      ))}
                    </Flex>
                  </Box>
                )}
              </Box>
            ) : (
              <Text color="gray" style={{ marginTop: '12px' }}>
                Your answers will appear here with links back to the exact supporting source.
              </Text>
            )}
          </Card>
        </Flex>

        {notice && (
          <Box style={{ marginTop: '20px' }}>
            <Text color="red">{notice}</Text>
          </Box>
        )}
      </Container>
    );
  }

  return (
    <Theme appearance="light" accentColor="violet" grayColor="slate">
      {auth ? renderAppView() : renderAuthView()}
    </Theme>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
