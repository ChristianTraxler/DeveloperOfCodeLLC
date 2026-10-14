#!/bin/bash
# Builds "DOC Admin.app" and installs it in /Applications.
set -euo pipefail
cd "$(dirname "$0")"
NAME="DOC Admin"
OUT="$(pwd)/build/$NAME.app"
DEST="/Applications/$NAME.app"

rm -rf "$OUT"
mkdir -p "$OUT/Contents/MacOS" "$OUT/Contents/Resources" build/icon.iconset
swiftc -O -target arm64-apple-macos13 -o "$OUT/Contents/MacOS/DOCAdmin" main.swift

# Icon from the site's 512px favicon
SRC="../public/img/favicons/icon-512.png"
for s in 16 32 128 256 512; do
  sips -z $s $s "$SRC" --out build/icon.iconset/icon_${s}x${s}.png >/dev/null
  sips -z $((s*2)) $((s*2)) "$SRC" --out build/icon.iconset/icon_${s}x${s}@2x.png >/dev/null
done
iconutil -c icns build/icon.iconset -o "$OUT/Contents/Resources/AppIcon.icns"

cat > "$OUT/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>DOC Admin</string>
  <key>CFBundleDisplayName</key><string>DOC Admin</string>
  <key>CFBundleIdentifier</key><string>com.developerofcode.admin</string>
  <key>CFBundleExecutable</key><string>DOCAdmin</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSHumanReadableCopyright</key><string>Developer of Code, LLC</string>
  <key>NSAppTransportSecurity</key>
  <dict><key>NSAllowsLocalNetworking</key><true/></dict>
</dict>
</plist>
PLIST
codesign --force --deep -s - "$OUT" 2>/dev/null

rm -rf "$DEST"
cp -R "$OUT" "$DEST"
touch "$DEST"
echo "Installed $DEST"
