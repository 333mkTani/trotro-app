'use strict';
require('dotenv/config');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data, error } = await supabase
    .from('bus_stops')
    .select('city')
    .limit(1);

  if (error) {
    console.log('❌  city column NOT found:', error.message);
    console.log('\n👉  Run this SQL in your Supabase SQL editor first:');
    console.log('    https://supabase.com/dashboard/project/oxifzpramvtbwcmjoswp/sql\n');
    console.log('ALTER TABLE public.bus_stops ADD COLUMN IF NOT EXISTS city text NOT NULL DEFAULT \'accra\';');
    console.log('ALTER TABLE public.routes    ADD COLUMN IF NOT EXISTS city text NOT NULL DEFAULT \'accra\';');
    console.log('CREATE INDEX IF NOT EXISTS bus_stops_city_idx ON public.bus_stops(city);');
    console.log('CREATE INDEX IF NOT EXISTS routes_city_idx    ON public.routes(city);');
  } else {
    console.log('✅  city column exists! Ready to import Kumasi data.');
    console.log('    Sample row city value:', data[0]?.city ?? '(no rows)');
  }
}

main().catch(err => { console.error(err.message); process.exit(1); });
