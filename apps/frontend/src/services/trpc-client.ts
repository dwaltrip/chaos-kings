import { createTRPCClient, httpLink } from '@trpc/client';

import type { AppRouter } from '@protocol/trpc/router';

function getBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL ?? '';
}

// NOTE: Using httpLink which makes one HTTP request per tRPC call.
// TODO: Investigate httpBatchLink for batching concurrent requests into a single HTTP call.
const trpc = createTRPCClient<AppRouter>({
  links: [
    httpLink({
      url: `${getBaseUrl()}/trpc`,
      fetch: (url: URL | RequestInfo, options: RequestInit | undefined) =>
        fetch(url, { ...options, credentials: 'include' }),
    }),
  ],
});

export { trpc };
