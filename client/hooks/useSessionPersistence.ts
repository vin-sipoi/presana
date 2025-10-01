'use client';

import { useEffect } from 'react';

export function useSessionPersistence() {
 

  const clearSession = () => {
    // No-op
  };

  return {
    clearSession,
  };
}
