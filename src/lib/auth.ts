'use client';

import { createAuthClient } from '@neondatabase/neon-js/auth/next';

export const authClient = createAuthClient();

// Export commonly used methods for convenience
export const { signIn, signUp, signOut, useSession } = authClient;
