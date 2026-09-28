import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

/**
 * Install-app prompt for SendJet PWA.
 *
 * - On Android Chrome / Edge / Brave: listens for the native `beforeinstallprompt` event,
 *   suppresses Chrome's default mini-bar, and shows our branded prompt instead.
 * - On iOS Safari: shows a small "Tap Share → Add to Home Screen" hint, since iOS
 *   does not expose the install API.
 * - Dismissed prompts are remembered for 14 days via localStorage.
 *
 * Renders nothing when:
 *   - The app is already running standalone (installed)
 *   - The user dismissed the prompt within the snooze window
 *   - The browser hasn't fired beforeinstallprompt and we're not on iOS
 */
const SNOOZE_KEY = 'sendjet_install_snoozed_until';
const SNOOZE_DAYS = 14;

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  window.navigator.standalone === true;

const isSnoozed = () => {
  const until = Number(localStorage.getItem(SNOOZE_KEY) || 0);
  return Date.now() < until;
};

const snooze = () => {
  localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_DAYS * 86400000));
};

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

export const InstallPrompt = () => {
  const [deferred, setDeferred] = useState(null);
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone() || isSnoozed()) return;

    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferred(e);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    const onInstalled = () => {
      setVisible(false);
      setDeferred(null);
    };
    window.addEventListener('appinstalled', onInstalled);

    // iOS doesn't fire beforeinstallprompt; show our own hint after a short delay
    if (isIos() && !isStandalone()) {
      const t = setTimeout(() => setIosHint(true), 5000);
      return () => {
        clearTimeout(t);
        window.removeEventListener('beforeinstallprompt', onBeforeInstall);
        window.removeEventListener('appinstalled', onInstalled);
      };
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferred) return;
    deferred.prompt();
    try {
      await deferred.userChoice;
    } finally {
      setVisible(false);
      setDeferred(null);
    }
  };

  const handleDismiss = () => {
    snooze();
    setVisible(false);
    setIosHint(false);
  };

  if (visible) {
    return (
      <div
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md bg-white shadow-strong border border-gray-200 rounded-2xl p-3 flex items-center gap-3 slide-in"
        data-testid="install-prompt"
        role="dialog"
        aria-live="polite"
      >
        <img src="/icons/icon-96.png" alt="" className="h-12 w-12 rounded-xl flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">Install SendJet</p>
          <p className="text-xs text-gray-500 truncate">Faster access, works offline-friendly.</p>
        </div>
        <button
          onClick={handleInstall}
          className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-3 py-2 rounded-lg flex items-center gap-1.5"
          data-testid="install-prompt-install"
        >
          <Download className="h-4 w-4" />
          Install
        </button>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="text-gray-400 hover:text-gray-600 p-1"
          data-testid="install-prompt-dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  if (iosHint) {
    return (
      <div
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[94%] max-w-md bg-white shadow-strong border border-gray-200 rounded-2xl p-4 slide-in"
        data-testid="ios-install-hint"
        role="dialog"
        aria-live="polite"
      >
        <div className="flex items-start gap-3">
          <img src="/icons/icon-96.png" alt="" className="h-11 w-11 rounded-xl flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">Install SendJet on your iPhone</p>
            <p className="text-xs text-gray-500 mt-0.5">Use Safari, then follow these two steps:</p>
          </div>
          <button
            onClick={handleDismiss}
            aria-label="Dismiss"
            className="text-gray-400 hover:text-gray-600 p-1 -mt-1 -mr-1"
            data-testid="ios-install-hint-dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <ol className="mt-3 space-y-2 text-sm text-gray-700">
          <li className="flex items-center gap-2">
            <span className="flex-shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full bg-orange-100 text-orange-600 text-xs font-bold">1</span>
            <span>Tap the</span>
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-gray-100 text-gray-700">
              {/* iOS Share glyph */}
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v12" />
                <polyline points="8 7 12 3 16 7" />
                <path d="M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8" />
              </svg>
            </span>
            <span>Share button</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="flex-shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full bg-orange-100 text-orange-600 text-xs font-bold">2</span>
            <span>Choose</span>
            <span className="font-semibold text-gray-900">"Add to Home Screen"</span>
          </li>
        </ol>
      </div>
    );
  }

  return null;
};

export default InstallPrompt;
