"use client";

import { createAuthClient } from "better-auth/react";

// Same-origin base URL — works in dev, Docker, and Vercel alike.
export const authClient = createAuthClient();
