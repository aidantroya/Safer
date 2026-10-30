import '@fontsource-variable/inter';
import 'material-symbols/outlined.css';
import 'leaflet/dist/leaflet.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import './index.css';
import { App } from './ui/App';
import { SessionProvider } from './ui/session/SessionContext';
import { ThemeProvider } from './ui/theme/ThemeContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <ThemeProvider>
        <SessionProvider>
          <App />
        </SessionProvider>
      </ThemeProvider>
    </HashRouter>
  </StrictMode>,
);
