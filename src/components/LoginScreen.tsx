/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { signInWithPopup, googleProvider, auth, GoogleAuthProvider } from '../firebase';
import { AlertCircle } from 'lucide-react';
import AnimatedHourglass from './AnimatedHourglass';

interface LoginScreenProps {
  onSuccess?: () => void;
}

export default function LoginScreen({ onSuccess }: LoginScreenProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        localStorage.setItem('google_access_token', credential.accessToken);
      }
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      // Give context about the iframe or blockages if they occur
      if (err.code === 'auth/popup-blocked') {
        setError('Sign-in popup was blocked by your browser. Please allow popups or try opening the app in a new tab.');
      } else if (err.code === 'auth/popup-closed-by-user') {
        setError('The Google sign-in window was closed before completing the authentication. If this persists, please try opening the application in a new tab (using the button in the top-right corner).');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('Google sign-in is not yet enabled in Firebase Console, or check your authDomain settings.');
      } else if (err.code === 'auth/unauthorized-domain') {
        const currentDomain = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
        setError(
          `This domain (${currentDomain}) is not authorized for Google Sign-In in your Firebase project.\n\n` +
          `To resolve this:\n` +
          `1. Go to your Firebase Console.\n` +
          `2. Navigate to Authentication > Settings > Authorized Domains.\n` +
          `3. Click "Add domain" and enter:\n   ${currentDomain}\n` +
          `4. Click "Add" to save, then refresh and try again!`
        );
      } else if (err.code === 'auth/configuration-not-found') {
        setError('Google Sign-In is not enabled on this Firebase project yet. Please enable the Google sign-in provider under the Authentication Sign-in Method tab in your Firebase Console.');
      } else {
        setError(err.message || 'Failed to sign in with Google. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-ledger-dark text-ledger-paper p-6 font-sans">
      <div className="w-full max-w-[430px] border border-ledger-line bg-ledger-slate rounded-2xl p-8 shadow-2xl text-center flex flex-col items-center">
        {/* App Logo Emblem */}
        <div className="w-16 h-16 flex items-center justify-center mb-6">
          <AnimatedHourglass size={56} />
        </div>

        {/* Title */}
        <h1 className="font-serif text-4xl font-bold tracking-tight text-ledger-paper mb-2">
          Hourglass
        </h1>
        <p className="font-mono text-xs text-ledger-paper-dim tracking-widest uppercase mb-8">
          Hourly Daily Planner
        </p>

        {/* Description card */}
        <div className="border-t border-b border-ledger-line py-4 px-2 mb-8 text-left text-sm text-ledger-paper-dim font-sans leading-relaxed">
          Hourglass is an hour-focused daily scheduler designed to turn your vertical timeline into a clean, physical-feeling log. Schedule repeat sessions, toggle reminders, and log your hours smoothly.
        </div>

        {/* Error box */}
        {error && (
          <div className="w-full mb-6 p-4 rounded-lg bg-ledger-coral/10 border border-ledger-coral/30 text-ledger-coral text-xs flex items-start gap-3 text-left">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold mb-1">Google Sign-in failed:</p>
              <p className="mb-2 whitespace-pre-wrap leading-relaxed">{error}</p>
            </div>
          </div>
        )}

        {/* Google sign-in button */}
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          id="google-sign-in-button"
          className="w-full h-12 flex items-center justify-center gap-3 bg-ledger-coral hover:bg-ledger-coral/95 active:scale-[0.98] transition-all text-ledger-dark font-sans font-bold rounded-xl shadow-lg cursor-pointer disabled:opacity-50"
        >
          {loading ? (
            <span className="w-5 h-5 border-2 border-ledger-dark border-t-transparent rounded-full animate-spin"></span>
          ) : (
            <>
              {/* Google G Logo vector */}
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.81-.63-1.41-1.52-1.66-2.63z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </>
          )}
        </button>

        <div className="mt-8 text-center text-[10px] text-ledger-paper-dim/60 font-mono">
          SECURED BY FIREBASE AUTH & FIRESTORE
        </div>
      </div>
    </div>
  );
}
