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

/**
 * Record a lightweight page view. Safe to call on public page loads; never
 * throws (failures are swallowed so tracking can't break the page).
 * @param {string} page - path or page id, e.g. 'home'
 */
export async function trackPageView(page) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const visitor_id = user?.id || undefined;
    await supabase.from('page_views').insert([
      { page, visitor_id, referrer: document.referrer || null }
    ]);
  } catch (err) {
    console.warn('page view tracking failed:', err);
  }
}

/**
 * Record a content engagement view (portfolio / e-book / study-PDF).
 * @param {string} contentId
 * @param {string} contentType - 'portfolio' | 'ebook' | 'study-pdf'
 */
export async function trackContentView(contentId, contentType) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const visitor_id = user?.id || undefined;
    await supabase.from('content_views').insert([
      { content_id: contentId, content_type: contentType, visitor_id }
    ]);
  } catch (err) {
    console.warn('content view tracking failed:', err);
  }
}
