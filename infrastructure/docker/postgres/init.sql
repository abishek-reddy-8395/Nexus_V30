-- Nexus V30 — PostgreSQL Initialization
-- This runs once when the postgres container is first created.
-- Prisma migrations handle the actual schema; this just ensures extensions.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- for text search

-- Grant schema permissions
GRANT ALL PRIVILEGES ON DATABASE nexus_v30_dev TO nexus;
