#!/bin/bash
# ============================================
# PopBlock Release Builder
# Creates a clean .zip for GitHub Releases
# Usage: ./release.sh
# ============================================

set -e

# Get version from manifest.json
VERSION=$(grep -o '"version": "[^"]*"' manifest.json | cut -d'"' -f4)
ZIP_NAME="popblock-v${VERSION}.zip"

echo "🛡️  Building PopBlock v${VERSION}..."
echo ""

# Remove old builds
rm -f "$ZIP_NAME"

# Create zip with only the necessary files
zip -r "$ZIP_NAME" \
  manifest.json \
  service-worker.js \
  icons/ \
  content/ \
  popup/ \
  rules/ \
  -x "*.DS_Store" \
  -x "__MACOSX/*"

echo ""
echo "✅ Built: $ZIP_NAME"
echo "📦 Size: $(du -h "$ZIP_NAME" | cut -f1)"
echo ""
echo "Next steps:"
echo "  1. Go to https://github.com/sarthak-SyntaxSamurai/popblock/releases/new"
echo "  2. Create tag: v${VERSION}"
echo "  3. Upload: ${ZIP_NAME}"
echo "  4. Publish release!"
