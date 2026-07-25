import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://gaaellcbazxoydivejrh.supabase.co";
const supabaseKey = "sb_publishable_iXVNkdy7rUvMYLqZF2lekw_ab2x3atA";

export const supabase = createClient(supabaseUrl, supabaseKey);
