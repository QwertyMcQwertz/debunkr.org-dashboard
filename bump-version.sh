#!/bin/bash

# Version bump script for debunkr.org Dashboard
# Updates version in all manifest files and package.json

set -e

if [ $# -eq 0 ]; then
    echo "Usage: $0 <version>"
    echo "Example: $0 2.2.0"
    exit 1
fi

NEW_VERSION="$1"

# Validate version format (basic check)
if ! echo "$NEW_VERSION" | grep -E '^[0-9]+\.[0-9]+\.[0-9]+$' > /dev/null; then
    echo "Error: Version must be in format X.Y.Z (e.g., 2.2.0)"
    exit 1
fi

echo "🔢 Updating version to $NEW_VERSION..."

# Update manifest.json
if [ -f manifest.json ]; then
    sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$NEW_VERSION\"/" manifest.json
    echo "  ✅ Updated manifest.json"
fi

# Update manifest-chrome.json
if [ -f manifest-chrome.json ]; then
    sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$NEW_VERSION\"/" manifest-chrome.json
    echo "  ✅ Updated manifest-chrome.json"
fi

# Update manifest-firefox.json
if [ -f manifest-firefox.json ]; then
    sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$NEW_VERSION\"/" manifest-firefox.json
    echo "  ✅ Updated manifest-firefox.json"
fi

# Update package.json
if [ -f package.json ]; then
    sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$NEW_VERSION\"/" package.json
    echo "  ✅ Updated package.json"
fi

echo ""
echo "🎉 Version bump complete!"
echo ""
echo "📋 Next steps:"
echo "  1. Review changes: git diff"
echo "  2. Commit: git commit -am 'Bump version to $NEW_VERSION'"
echo "  3. Tag: git tag v$NEW_VERSION"
echo "  4. Push: git push origin main && git push origin v$NEW_VERSION"
echo ""
echo "🚀 GitHub Actions will automatically build and release!"
