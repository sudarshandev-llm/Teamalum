import { supabase } from '../supabase-config.js';

async function loadCount(type) {
  const { count, error } = await supabase
    .from('content_views')
    .select('*', { count: 'exact', head: true })
    .eq('content_type', type);
  if (error) return 0;
  return count;
}

export async function showContent() {
  const [portfolio, ebook, pdf] = await Promise.all([
    loadCount('portfolio'),
    loadCount('ebook'),
    loadCount('study-pdf')
  ]);
  document.getElementById('content-portfolio').textContent = portfolio.toLocaleString();
  document.getElementById('content-ebook').textContent = ebook.toLocaleString();
  document.getElementById('content-pdf').textContent = pdf.toLocaleString();
}
