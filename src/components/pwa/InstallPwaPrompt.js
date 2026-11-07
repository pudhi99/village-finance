'use client';

/**
 * PWA Install Prompt Banner — Village Finance
 * Handles beforeinstallprompt on Chromium/Android and provides iOS Add-to-Home-Screen guidance.
 */
import { useState, useEffect, useSyncExternalStore } from 'react';
import { Download, X, Share } from 'lucide-react';

function subscribeStandalone(callback) {
  if (typeof window === 'undefined') return () => {};
  const media = window.matchMedia('(display-mode: standalone)');
  media.addEventListener?.('change', callback);
  return () => media.removeEventListener?.('change', callback);
}

function getStandaloneSnapshot() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

function getStandaloneServerSnapshot() {
  return false;
}

export default function InstallPwaPrompt() {
  const isStandalone = useSyncExternalStore(
    subscribeStandalone,
    getStandaloneSnapshot,
    getStandaloneServerSnapshot
  );

  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (isStandalone) return;

    const dismissed = sessionStorage.getItem('vf_pwa_prompt_dismissed');
    if (dismissed) return;

    // Detect iOS Safari
    const ua = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(ua);
    const isSafari = isAppleDevice && !/crios|fxios|opios/.test(ua);

    if (isAppleDevice && isSafari) {
      const timer = setTimeout(() => {
        setIsIOS(true);
        setShowPrompt(true);
      }, 3000);
      return () => clearTimeout(timer);
    }

    // Chromium / Android beforeinstallprompt event
    function handleBeforeInstallPrompt(e) {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setShowPrompt(true), 2500);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [isStandalone]);

  async function handleInstallClick() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowPrompt(false);
      setDeferredPrompt(null);
    }
  }

  function handleDismiss() {
    setShowPrompt(false);
    sessionStorage.setItem('vf_pwa_prompt_dismissed', 'true');
  }

  if (isStandalone || !showPrompt) {
    return null;
  }

  return (
    <div className="fixed top-3 inset-x-3 sm:inset-x-auto sm:right-4 sm:max-w-md z-50 animate-in slide-in-from-top-4 duration-300">
      <div className="bg-slate-900/95 backdrop-blur-md border border-blue-500/40 rounded-2xl p-4 shadow-2xl shadow-black/80 flex items-start gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-500 flex items-center justify-center font-bold text-white text-sm shadow-md shrink-0">
          VF
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-white tracking-tight">
              Install Village Finance
            </h4>
            <button
              onClick={handleDismiss}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
            {isIOS
              ? 'Install as a fullscreen phone app for offline collections & quick thumb access.'
              : 'Add to your home screen for fast offline collections, full screen, and zero address bar.'}
          </p>

          {isIOS ? (
            <div className="mt-2.5 flex items-center gap-1.5 text-[11px] font-medium text-blue-300 bg-blue-950/60 border border-blue-800/60 px-2.5 py-1.5 rounded-lg">
              <span>Tap</span>
              <Share className="w-3.5 h-3.5 text-blue-400" />
              <span>in Safari, then select</span>
              <span className="font-semibold text-white">&quot;Add to Home Screen&quot;</span>
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={handleInstallClick}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-lg text-xs font-semibold shadow-md shadow-blue-900/40 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Install App</span>
              </button>
              <button
                onClick={handleDismiss}
                className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition"
              >
                Not Now
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
