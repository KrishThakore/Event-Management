import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase-server';

export async function POST() {
  const supabase = getSupabaseServerClient();
  await supabase.auth.signOut();
  const res = NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'));
  return res;
}
