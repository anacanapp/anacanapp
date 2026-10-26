import React from 'react';
import ReactDOM from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import '@fontsource/nunito/latin-ext-400.css';
import '@fontsource/nunito/latin-ext-600.css';
import '@fontsource/nunito/latin-ext-700.css';
import '@fontsource/nunito/latin-ext-800.css';
import '@fontsource/nunito/latin-ext-900.css';
import '@fontsource/nunito/latin-400.css';
import '@fontsource/nunito/latin-600.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/latin-800.css';
import '@fontsource/nunito/latin-900.css';
import '@fontsource/manrope/latin-ext-400.css';
import '@fontsource/manrope/latin-ext-500.css';
import '@fontsource/manrope/latin-ext-600.css';
import '@fontsource/manrope/latin-ext-700.css';
import '@fontsource/manrope/latin-ext-800.css';
import '@fontsource/manrope/latin-400.css';
import '@fontsource/manrope/latin-500.css';
import '@fontsource/manrope/latin-600.css';
import '@fontsource/manrope/latin-700.css';
import '@fontsource/manrope/latin-800.css';
import '@fontsource/dm-serif-display/latin-ext-400.css';
import '@fontsource/dm-serif-display/latin-400.css';
import './styles.css';
import './simulator.css';
import './luzern.css';
import App from './App';
import { loadSave } from './game/persistence';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <div className="error-screen"><img src="/assets/mark.svg" alt="" /><h1>Mommy Simulator</h1><p>Kiçik dünyanı yenidən açaq.</p><button className="button primary" onClick={() => location.reload()}>Yenidən aç</button></div> : this.props.children;
  }
}

void loadSave().then(({ state }) => {
  ReactDOM.createRoot(document.getElementById('root')!).render(<ErrorBoundary><App initialState={state} /></ErrorBoundary>);
  if (Capacitor.isNativePlatform()) {
    document.documentElement.classList.add('native-app');
    void StatusBar.setStyle({ style: Style.Light }).catch(() => {});
    void SplashScreen.hide({ fadeOutDuration: 350 }).catch(() => {});
  } else if ('serviceWorker' in navigator && import.meta.env.PROD) {
    void navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
});
