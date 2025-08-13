#!/bin/bash

# Build script for debunkr.org Dashboard
# Creates browser-specific packages without modifying the main manifest.json

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BUILD_DIR="build"
PACKAGES_DIR="packages"
CHROME_PACKAGE="debunkr-dashboard-chrome.zip"
FIREFOX_PACKAGE="debunkr-dashboard-firefox.xpi"

echo -e "${BLUE}🏗️  Building debunkr.org Dashboard Extension${NC}"
echo "=================================================="

# Clean previous builds
echo -e "${YELLOW}🧹 Cleaning previous builds...${NC}"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/chrome" "$BUILD_DIR/firefox"
mkdir -p "$PACKAGES_DIR"

# Common files to copy to both builds
COMMON_FILES=(
    "browser-polyfill.js"
    "chat.css"
    "chat.html"
    "popup.html"
    "README.md"
    "src/"
    "icons/"
    "assets/"
)

echo -e "${YELLOW}📁 Copying common files...${NC}"
for file in "${COMMON_FILES[@]}"; do
    if [ -e "$file" ]; then
        echo "  Copying $file"
        cp -r "$file" "$BUILD_DIR/chrome/"
        cp -r "$file" "$BUILD_DIR/firefox/"
    else
        echo -e "${RED}  Warning: $file not found${NC}"
    fi
done

# Chrome-specific build
echo -e "${YELLOW}🌐 Building Chrome package...${NC}"
cp manifest-chrome.json "$BUILD_DIR/chrome/manifest.json"

# Firefox-specific build  
echo -e "${YELLOW}🦊 Building Firefox package...${NC}"
cp manifest-firefox.json "$BUILD_DIR/firefox/manifest.json"

# Package Chrome extension
echo -e "${YELLOW}📦 Packaging Chrome extension...${NC}"
cd "$BUILD_DIR/chrome"
zip -r "../../$PACKAGES_DIR/$CHROME_PACKAGE" . -x "*.git*" "*.DS_Store*" > /dev/null
cd ../..

# Package Firefox extension
echo -e "${YELLOW}📦 Packaging Firefox extension...${NC}"
cd "$BUILD_DIR/firefox"
zip -r "../../$PACKAGES_DIR/$FIREFOX_PACKAGE" . -x "*.git*" "*.DS_Store*" > /dev/null
cd ../..

# Verify packages
echo -e "${YELLOW}🔍 Verifying packages...${NC}"

if [ -f "$PACKAGES_DIR/$CHROME_PACKAGE" ]; then
    CHROME_SIZE=$(du -h "$PACKAGES_DIR/$CHROME_PACKAGE" | cut -f1)
    echo -e "${GREEN}  ✅ Chrome package: $CHROME_PACKAGE ($CHROME_SIZE)${NC}"
    
    # Verify Chrome manifest
    CHROME_BACKGROUND=$(unzip -p "$PACKAGES_DIR/$CHROME_PACKAGE" manifest.json | grep -A2 '"background"' | grep '"service_worker"' || echo "")
    if [ -n "$CHROME_BACKGROUND" ]; then
        echo -e "${GREEN}    ✅ Chrome service_worker configuration verified${NC}"
    else
        echo -e "${RED}    ❌ Chrome service_worker configuration missing${NC}"
    fi
else
    echo -e "${RED}  ❌ Chrome package failed${NC}"
fi

if [ -f "$PACKAGES_DIR/$FIREFOX_PACKAGE" ]; then
    FIREFOX_SIZE=$(du -h "$PACKAGES_DIR/$FIREFOX_PACKAGE" | cut -f1)
    echo -e "${GREEN}  ✅ Firefox package: $FIREFOX_PACKAGE ($FIREFOX_SIZE)${NC}"
    
    # Verify Firefox manifest
    FIREFOX_BACKGROUND=$(unzip -p "$PACKAGES_DIR/$FIREFOX_PACKAGE" manifest.json | grep -A2 '"background"' | grep '"scripts"' || echo "")
    if [ -n "$FIREFOX_BACKGROUND" ]; then
        echo -e "${GREEN}    ✅ Firefox background.scripts configuration verified${NC}"
    else
        echo -e "${RED}    ❌ Firefox background.scripts configuration missing${NC}"
    fi
else
    echo -e "${RED}  ❌ Firefox package failed${NC}"
fi

# Clean up build directory
echo -e "${YELLOW}🧹 Cleaning up build directory...${NC}"
rm -rf "$BUILD_DIR"

echo ""
echo -e "${GREEN}🎉 Build complete!${NC}"
echo -e "${BLUE}📦 Packages created in $PACKAGES_DIR/:${NC}"
echo -e "   Chrome: $CHROME_PACKAGE"
echo -e "   Firefox: $FIREFOX_PACKAGE"
echo ""
echo -e "${BLUE}📋 Installation Instructions:${NC}"
echo -e "   Chrome: Load unpacked extension or drag $CHROME_PACKAGE to chrome://extensions/"
echo -e "   Firefox: Go to about:debugging → Load Temporary Add-on → Select $FIREFOX_PACKAGE"
echo ""
