'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FcGoogle } from 'react-icons/fc';
import { useRouter } from 'next/navigation';
import { useUser } from '@/context/UserContext';
import { setSessionStorage, STORAGE_KEYS } from '@/utils/storage';

// Declare Google Identity Services types
declare global {
  interface Window {
    google: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: any) => void }) => void;
          prompt: () => void;
        };
      };
    };
  }
}

export function GoogleLogin(props: { className?: string }) {
  const { className } = props;
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { login } = useUser();

  useEffect(() => {
    // Load Google Identity Services script
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    script.onload = () => {
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
          callback: handleCredentialResponse,
        });
      }
    };

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  const handleCredentialResponse = async (response: any) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ googleToken: response.credential }),
      });

      if (res.ok) {
        const data = await res.json();
        // Store session data
        setSessionStorage(STORAGE_KEYS.AUTH_SESSION, {
          jwt: data.jwt,
          user: data.user,
        });

        // Update user context
        login({
          ...data.user,
          jwt: data.jwt,
        });

        // Redirect to intended page or home
        const redirectUrl = sessionStorage.getItem('auth_redirect') || '/';
        sessionStorage.removeItem('auth_redirect');
        router.push(redirectUrl);
      } else {
        console.error('Login failed');
        alert('Login failed. Please try again.');
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    if (window.google) {
      window.google.accounts.id.prompt();
    } else {
      alert('Google login is not available. Please try again later.');
    }
  };

  return (
    <Button
      onClick={handleGoogleLogin}
      variant="default"
      className={className ?? 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center gap-2'}
      disabled={isLoading}
    >
      <FcGoogle className="w-5 h-5" />
      {isLoading ? 'Signing in...' : 'Continue with Google'}
    </Button>
  );
}
