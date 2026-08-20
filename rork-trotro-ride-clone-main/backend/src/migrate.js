// Compatibility entrypoint. The canonical migration runner lives at
// database/migrate.js so local Compose, Render pre-deploy, and npm scripts all
// track the same public.schema_migrations table.
require('../database/migrate');
