import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@radix-ui/themes/styles.css';
import { Theme } from '@radix-ui/themes';
import { Auth } from './api';
import { AuthScreen } from './AuthScreen';
import { Dashboard } from './Dashboard';

function App() {
  const [auth, setAuth] = useState<Auth | null>(() => {
    const storedAuth = localStorage.getItem('atlas-auth');
    return storedAuth ? JSON.parse(storedAuth) : null;
  });

  function handleSignOut() {
    localStorage.removeItem('atlas-auth');
    setAuth(null);
  }

  return (
    <Theme appearance="light" accentColor="violet" grayColor="slate">
      {auth ? (
        <Dashboard auth={auth} onSignOut={handleSignOut} />
      ) : (
        <AuthScreen onAuthenticated={setAuth} />
      )}
    </Theme>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
