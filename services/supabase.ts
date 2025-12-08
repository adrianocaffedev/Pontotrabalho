import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qcbvosnfmijfwjooppqe.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjYnZvc25mbWlqZndqb29wcHFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNzU4NzIsImV4cCI6MjA4MDc1MTg3Mn0._CMK-Bmr5sjs5VGVZaR5ZhGl3qH_H31E5obs7Hsjm58';

export const supabase = createClient(supabaseUrl, supabaseKey);