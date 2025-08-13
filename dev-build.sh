#!/bin/bash

# Development build script for debunkr.org Dashboard
# Supports building specific browsers or development modes

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
BUILD_DIR="build"
PACKAGES_DIR="packages"

show_help() {
    echo -e "${BLUE}debunkr.org Dashboard Build Tool${NC}"
    echo ""
    echo "Usage: $0 [OPTIONS] [BROWSER]"
    echo ""
    echo "BROWSER:"
    echo "  chrome    Build Chrome extension only"
    echo "  firefox   Build Firefox extension only"
    echo "  both      Build both extensions (default)"
    echo ""
    echo "OPTIONS:"
    echo "  -d, --dev     Development mode (keep build directory)"
    echo "  -c, --clean   Clean packages directory before building"
    echo "  -h, --help    Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                    # Build both browsers"
    echo "  $0 chrome             # Build Chrome only"
    echo "  $0 firefox --dev      # Build Firefox in dev mode"
    echo "  $0 both --clean       # Clean and build both"
}

# Parse arguments
BROWSER="both"
DEV_MODE=false
CLEAN=false

while [[ $# -gt 0 ]]; do
    case $1 in
        chrome|firefox|both)
            BROWSER="$1"
            shift
            ;;
        -d|--dev)
            DEV_MODE=true
            shift
            ;;
        -c|--clean)
            CLEAN=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            show_help
            exit 1
            ;;
    esac
done

echo -e "${BLUE}🏗️  Building debunkr.org Dashboard Extension${NC}"
echo -e "${BLUE}Target: $BROWSER${NC}"
if [ "$DEV_MODE" = true ]; then
    echo -e "${YELLOW}Development mode enabled${NC}"
fi
echo "=================================================="

# Clean packages if requested
if [ "$CLEAN" = true ]; then
    echo -e "${YELLOW}🧹 Cleaning packages directory...${NC}"
    rm -rf "$PACKAGES_DIR"
fi

# Clean and create build directories
echo -e "${YELLOW}🧹 Preparing build directories...${NC}"
rm -rf "$BUILD_DIR"
mkdir -p "$PACKAGES_DIR"

# Common files
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

build_chrome() {
    echo -e "${YELLOW}🌐 Building Chrome package...${NC}"
    mkdir -p "$BUILD_DIR/chrome"
    
    # Copy common files
    for file in "${COMMON_FILES[@]}"; do
        if [ -e "$file" ]; then
            cp -r "$file" "$BUILD_DIR/chrome/"
        fi
    done
    
    # Chrome-specific manifest
    cp manifest-chrome.json "$BUILD_DIR/chrome/manifest.json"
    
    # Package
    cd "$BUILD_DIR/chrome"
    zip -r "../../$PACKAGES_DIR/debunkr-dashboard-chrome.zip" . -x "*.git*" "*.DS_Store*" > /dev/null
    cd ../..
    
    # Verify
    if [ -f "$PACKAGES_DIR/debunkr-dashboard-chrome.zip" ]; then
        SIZE=$(du -h "$PACKAGES_DIR/debunkr-dashboard-chrome.zip" | cut -f1)
        echo -e "${GREEN}  ✅ Chrome package created ($SIZE)${NC}"
    fi
}

build_firefox() {
    echo -e "${YELLOW}🦊 Building Firefox package...${NC}"
    mkdir -p "$BUILD_DIR/firefox"
    
    # Copy common files
    for file in "${COMMON_FILES[@]}"; do
        if [ -e "$file" ]; then
            cp -r "$file" "$BUILD_DIR/firefox/"
        fi
    done
    
    # Firefox-specific manifest
    cp manifest-firefox.json "$BUILD_DIR/firefox/manifest.json"
    
    # Package
    cd "$BUILD_DIR/firefox"
    zip -r "../../$PACKAGES_DIR/debunkr-dashboard-firefox.xpi" . -x "*.git*" "*.DS_Store*" > /dev/null
    cd ../..
    
    # Verify
    if [ -f "$PACKAGES_DIR/debunkr-dashboard-firefox.xpi" ]; then
        SIZE=$(du -h "$PACKAGES_DIR/debunkr-dashboard-firefox.xpi" | cut -f1)
        echo -e "${GREEN}  ✅ Firefox package created ($SIZE)${NC}"
    fi
}

# Build based on target
case $BROWSER in
    chrome)
        build_chrome
        ;;
    firefox)
        build_firefox
        ;;
    both)
        build_chrome
        build_firefox
        ;;
esac

# Clean up unless in dev mode
if [ "$DEV_MODE" = false ]; then
    echo -e "${YELLOW}🧹 Cleaning up build directory...${NC}"
    rm -rf "$BUILD_DIR"
else
    echo -e "${BLUE}📁 Build directory preserved at: $BUILD_DIR${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Build complete!${NC}"
echo -e "${BLUE}📦 Packages in $PACKAGES_DIR/:${NC}"
ls -la "$PACKAGES_DIR/" | grep -E '\.(zip|xpi)$' | while read -r line; do
    echo -e "   $line"
done
