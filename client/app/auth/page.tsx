'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSessionStorage, removeSessionStorage, STORAGE_KEYS } from '@/utils/storage';

export default function AuthPage() {
  const router = useRouter();

  useEffect(() => {
 
    const redirectUrl = getSessionStorage<string>(STORAGE_KEYS.AUTH_REDIRECT);

    if (redirectUrl) {
      removeSessionStorage(STORAGE_KEYS.AUTH_REDIRECT);

      // Check if it's a checkin URL and extract parameters
      const checkinMatch = redirectUrl.match(/\/checkin\/([^\/]+)\/([^\/]+)\/([^\/]+)/);
      if (checkinMatch) {
        const eventId = checkinMatch[1];
        const verificationCode = checkinMatch[2];
        const timestamp = checkinMatch[3];
        console.log('Redirecting to check-in confirmation page:', eventId);
        // Redirect to check-in confirmation page
        setTimeout(() => {
          router.push(`/checkin-confirm/${eventId}/${verificationCode}/${timestamp}`);
        }, 500);
      } else {
        console.log('Redirecting to stored URL:', redirectUrl);
        setTimeout(() => {
          router.push(redirectUrl);
        }, 500);
      }
    } else {
      // Fallback to landing page if no redirect URL is stored
      console.log('No redirect URL found, redirecting to landing');
      setTimeout(() => {
        router.push('/landing');
      }, 500);
    }
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Authenticating...</h2>
        <p className="text-gray-600">Please wait while we sign you in with Google.</p>
      </div>
    </div>
  );
}