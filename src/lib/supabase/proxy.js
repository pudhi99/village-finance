/**
 * Supabase session-refresh proxy for Next.js 16.
 * This module is used by middleware.js to refresh the user session
 * on each request so it stays valid across SSR navigation.
 *
 * Reference: https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs
 */
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

/**
 * Refresh the Supabase session and propagate updated cookies.
 * Call this from middleware.js.
 *
 * @param {import('next/server').NextRequest} request
 * @returns {Promise<import('next/server').NextResponse>}
 */
export async function updateSession(request) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: do not remove — refreshes the session token
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabaseResponse, user };
}
