import { FormEvent, useState } from 'react';
import {
  Box,
  Button,
  Card,
  Flex,
  Heading,
  Link,
  Text,
  TextField,
} from '@radix-ui/themes';
import { Auth, authenticate } from './api';

type Props = {
  onAuthenticated: (auth: Auth) => void;
};

export function AuthScreen({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice('');

    try {
      const auth = await authenticate(mode, email, password);
      localStorage.setItem('atlas-auth', JSON.stringify(auth));
      onAuthenticated(auth);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background: '#fbfaf7',
      }}
    >
      <Card size="3" style={{ width: 'min(420px, 100%)', padding: 32 }}>
        <Flex direction="column" gap="3">
          <Link
            href="#"
            style={{
              textDecoration: 'none',
              color: 'inherit',
              fontSize: 21,
              fontWeight: 800,
            }}
          >
            KnowledgeHub
          </Link>

          <Text size="1" weight="bold" color="gray">
            AI KNOWLEDGE BASE
          </Text>

          <Heading as="h1" size="7">
            {mode === 'register' ? 'Start your workspace.' : 'Welcome back.'}
          </Heading>

          <Text color="gray">Upload your team&apos;s knowledge and get cited answers.</Text>

          <form onSubmit={handleSubmit}>
            <Flex direction="column" gap="3">
              <label>
                <Text as="div" size="2" weight="bold" style={{ marginBottom: 6 }}>
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
                <Text as="div" size="2" weight="bold" style={{ marginBottom: 6 }}>
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
                {busy ? 'Please wait...' : mode === 'register' ? 'Create workspace' : 'Sign in'}
              </Button>
            </Flex>
          </form>

          <Text size="2" color="gray">
            {mode === 'register' ? 'Already have an account?' : 'New to KnowledgeHub?'}{' '}
            <Button
              variant="ghost"
              size="2"
              type="button"
              onClick={() => setMode(mode === 'register' ? 'login' : 'register')}
            >
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
