import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { LanguageProvider } from './i18n/index.tsx';
import { ThemeProvider } from './theme/index.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './utils/chartSetup.ts';
import './index.css';

const container = document.getElementById('root') || (() => {
  const el = document.createElement('div');
  el.id = 'root';
  document.body.appendChild(el);
  return el;
})();

const root = (container as any)._reactRoot || createRoot(container);
(container as any)._reactRoot = root;

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <LanguageProvider>
          <App />
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
