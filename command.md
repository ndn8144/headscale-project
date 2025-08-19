docker exec -it headscale headscale apikeys create

# 1. Connect to database
docker exec -it postgres psql -U headscale -d headscale

# 2. Check table structure
\d api_keys

# 3. Enable pgcrypto if needed
CREATE EXTENSION IF NOT EXISTS pgcrypto;

# 4. Create API key
INSERT INTO api_keys (prefix, hash, created_at, expiration, last_seen) 
VALUES (
    'hskey_' || substr(md5(random()::text), 1, 32),
    crypt('test123', gen_salt('bf'))::bytea,
    NOW(),
    NULL,  -- No expiration (NULL means never expires)
    NOW()
);

# Verify it was created
SELECT id, prefix, created_at, expiration FROM api_keys;

# 5. Get the generated key
SELECT prefix FROM api_keys ORDER BY created_at DESC LIMIT 1;