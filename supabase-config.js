let createClient;

try {
  ({ createClient } = await import('https://esm.sh/@supabase/supabase-js@2'));
} catch (primaryErr) {
  console.warn('Primary CDN failed, trying fallback:', primaryErr);
  ({ createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'));
}

export const supabase = createClient(
  'https://ziwinletlvzulddqnbno.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inppd2lubGV0bHZ6dWxkZHFuYm5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyNDE3NjcsImV4cCI6MjEwMjgxNzc2N30.mJh-Z8C__7XjE9PAhmd5OCxVw2l2jXLYJuvrsVacKEo'
);
