#!/bin/sh
# Copy the full-page screenshots taken in the iOS Simulator (developer menu > Capture full page)
# to ~/Desktop/studently-screens.
set -e
DATA=$(xcrun simctl get_app_container booted ly.istudent.app data 2>/dev/null) || { echo "Studently is not installed on the booted simulator."; exit 1; }
SRC="$DATA/Documents/screenshots"
DEST="$HOME/Desktop/studently-screens"
mkdir -p "$DEST"
if ls "$SRC"/*.png >/dev/null 2>&1; then
  cp "$SRC"/*.png "$DEST"/
  echo "Copied $(ls "$SRC"/*.png | wc -l | tr -d ' ') screenshot(s) to $DEST"
else
  echo "No screenshots yet. In the simulator press Cmd+D and choose \"Capture full page\"."
fi
