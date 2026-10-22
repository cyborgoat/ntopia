#!/bin/sh
set -eu

binary=$1
shift
# Cargo also uses runners for tests and examples. Only wrap the desktop app.
if [ "$(basename "$binary")" != ntopia ]; then
    exec "$binary" "$@"
fi

output_dir=$(CDPATH= cd -- "$(dirname "$binary")" && pwd)
repo_dir=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
app="$output_dir/macos-dev/NTOPIA Dev.app"
macos="$app/Contents/MacOS"
resources="$app/Contents/Resources"
mkdir -p "$macos" "$resources"
# Replace atomically: a previous hot-reload instance may still be shutting down.
cp "$binary" "$macos/ntopia.next"
mv -f "$macos/ntopia.next" "$macos/ntopia"
cp "$repo_dir/src-tauri/icons/icon.icns" "$resources/icon.icns"
ln -sfn "$output_dir/node" "$macos/node"
ln -sfn "$output_dir/resources" "$resources/resources"

cat > "$app/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>app.ntopia.dev</string>
<key>CFBundleName</key><string>NTOPIA Dev</string>
<key>CFBundleDisplayName</key><string>NTOPIA Dev</string>
<key>CFBundleExecutable</key><string>ntopia</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleIconFile</key><string>icon.icns</string>
<key>NSHighResolutionCapable</key><true/>
</dict></plist>
PLIST
touch "$app"

# launchd opens these files before the app starts. Use the system temp directory:
# macOS privacy protection blocks launchd from opening logs inside Documents.
log=$(mktemp "${TMPDIR:-/tmp}/ntopia-dev.XXXXXX")
pid_file=$(mktemp "${TMPDIR:-/tmp}/ntopia-dev-pid.XXXXXX")
# The log follower must also stop if Cargo force-kills this runner.
(
    tail -n +1 -f "$log" &
    tail_pid=$!
    trap 'kill "$tail_pid" 2>/dev/null || true' EXIT
    trap 'exit' INT TERM
    while kill -0 $$ 2>/dev/null; do sleep 0.2; done
) &
log_follower=$!
cleanup() {
    kill "$log_follower" 2>/dev/null || true
    rm -f "$pid_file"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
printf 'Launching %s through macOS LaunchServices\n' "$app"
printf 'Development log: %s\n' "$log"
# The dev app watches this runner and exits when Cargo stops it on a rebuild.
/usr/bin/open -n --stdout "$log" --stderr "$log" \
    --env "NTOPIA_DEV_RUNNER_PID=$$" --env "NTOPIA_DEV_PID_FILE=$pid_file" \
    "$app" --args "$@"
# open -W cannot always resolve the GUI process from a terminal/agent session.
# Wait for the app's own PID handshake, then follow that specific instance.
attempt=0
while [ ! -s "$pid_file" ]; do
    attempt=$((attempt + 1))
    if [ "$attempt" -ge 150 ]; then
        printf 'NTOPIA did not finish launching; see %s\n' "$log" >&2
        exit 1
    fi
    sleep 0.2
done
app_pid=$(cat "$pid_file")
case "$app_pid" in
    ''|*[!0-9]*|0) printf 'Invalid NTOPIA process ID\n' >&2; exit 1 ;;
esac
while kill -0 "$app_pid" 2>/dev/null; do sleep 0.2; done
