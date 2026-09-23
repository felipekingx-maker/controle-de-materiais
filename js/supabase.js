import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

if (SUPABASE_URL === 'https://SEU-PROJETO.supabase.co' || SUPABASE_ANON_KEY === 'SUA_CHAVE_PUBLICAVEL_OU_ANON') {
  console.warn("Supabase credentials not configured. Please set them in js/config.js.");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
