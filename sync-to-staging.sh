#!/bin/bash
# Sync tunecraft staging → useful-tools for local testing at :5006/tune
# Usage: ./sync-to-staging.sh

SRC="$HOME/clawd/projects/tunecraft"
DST="$HOME/clawd/projects/useful-tools"

cp "$SRC/css/tune.css" "$DST/static/css/tune.css"
cp "$SRC/js/tune.js" "$DST/static/js/tune.js"

# Transform index.html → tune.html (fix paths for Flask static serving)
sed -e 's|css/style.css|/static/css/style.css|g' \
    -e 's|css/tune.css|/static/css/tune.css|g' \
    -e 's|js/tune.js|/static/js/tune.js|g' \
    "$SRC/index.html" > "$DST/templates/tune.html"

echo "✅ Synced tunecraft → useful-tools/tune"
echo "   Test at: http://192.168.31.120:5006/tune"
