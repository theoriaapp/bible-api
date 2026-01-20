#!/bin/bash

# Configuration
PROJECT_NAME="bible-api"
BUCKET_NAME="bible-api-storage-v1"
KV_NAME="BIBLE_VOTD"

echo "🚀 Starting Cloudflare Infrastructure Setup..."

# 1. Check Login
if ! npx wrangler whoami > /dev/null 2>&1; then
    echo "❌ You are not logged in. Please run 'npx wrangler login' first."
    exit 1
fi

# 2. Create R2 Bucket
echo "📦 Creating R2 Bucket: $BUCKET_NAME..."
npx wrangler r2 bucket create $BUCKET_NAME || echo "   (Bucket might already exist, continuing...)"

# 3. Create KV Namespace and Capture ID
echo "🔑 Creating KV Namespace: $KV_NAME..."

# Try to create and capture output
CREATE_OUTPUT=$(npx wrangler kv:namespace create $KV_NAME 2>&1)

# Extract ID from creation output (matches "id: <id>")
KV_ID=$(echo "$CREATE_OUTPUT" | grep -o 'id: [^)]*' | cut -d' ' -f2)

# If creation failed (likely exists), try to list and find it
if [ -z "$KV_ID" ]; then
    echo "   Namespace likely exists. Fetching existing ID..."
    # List all namespaces and find the line with our KV_NAME
    KV_LIST=$(npx wrangler kv:namespace list)
    
    # Parse the output table (assumes standard wrangler list output)
    # This grabs the ID which is usually the first column or associated with the title
    KV_ID=$(echo "$KV_LIST" | grep "$KV_NAME" | awk '{print $1}')
fi

# Fallback: If automation failed, ask user
if [ -z "$KV_ID" ] || [ ${#KV_ID} -lt 10 ]; then
    echo "⚠️  Could not auto-detect KV ID."
    echo "   Please run 'npx wrangler kv:namespace list' manually."
    read -p "   Paste the ID for '$KV_NAME' here: " KV_ID
fi

echo "✅ KV ID Captured: $KV_ID"

# 4. Generate wrangler.toml
echo "📝 Generating wrangler.toml..."

cat > wrangler.toml <<EOL
name = "$PROJECT_NAME"
main = "src/index.ts"
compatibility_date = "2024-04-01"

# 1. R2 Bucket Binding
[[r2_buckets]]
binding = "BIBLE_BUCKET"
bucket_name = "$BUCKET_NAME"

# 2. KV Namespace Binding
[[kv_namespaces]]
binding = "BIBLE_KV"
id = "$KV_ID"

# 3. Scheduled Worker (Verse of the Day - Runs every day at 8am UTC)
[triggers]
crons = ["0 8 * * *"]

# 4. Observability
[observability]
enabled = true
EOL

echo "🎉 Infrastructure ready! 'wrangler.toml' has been created."
echo "👉 Next step: Run 'npx ts-node src/seed-r2.ts' to upload the data."