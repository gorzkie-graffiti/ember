#!/usr/bin/env bash
# EmberVeer — build + deploy in one shot.
set -euo pipefail

EMBER_DIR="/home/krystian/Pobrane/ember"
J2ME_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVE_DIR="$J2ME_DIR/serve"
WTK=${WTK:-/opt/sun-wtk}
JAVAC=${JAVAC:-/usr/lib/jvm/java-8-openjdk/bin/javac}
CP="$WTK/lib/cldcapi11.jar:$WTK/lib/midpapi20.jar"
CF_LOG=$(mktemp)
CF_FILES_LOG=$(mktemp)
CF_PID=""
CF_FILES_PID=""
EMBER_PID=""
FILES_PID=""

cleanup() {
    echo ""
    echo "[cleanup] killing everything..."
    [ -n "$CF_PID" ]       && kill "$CF_PID"       2>/dev/null || true
    [ -n "$CF_FILES_PID" ] && kill "$CF_FILES_PID" 2>/dev/null || true
    [ -n "$EMBER_PID" ]    && kill "$EMBER_PID"    2>/dev/null || true
    [ -n "$FILES_PID" ]    && kill "$FILES_PID"    2>/dev/null || true
    rm -f "$CF_LOG" "$CF_FILES_LOG"
    echo "[cleanup] done"
}
trap cleanup EXIT INT TERM

# ── 0. prep serve dirs ────────────────────────────────────────────
mkdir -p "$SERVE_DIR/jar" "$SERVE_DIR/apk"

# ── 1. start Ember ────────────────────────────────────────────────
echo "[1] starting Ember (bun run dev)..."
cd "$EMBER_DIR"
bun run dev >/tmp/ember.log 2>&1 &
EMBER_PID=$!

echo "[1] waiting for Ember on port 3000..."
for i in $(seq 1 20); do
    if curl -sf http://localhost:3000 >/dev/null 2>&1; then
        echo "[1] Ember up (PID $EMBER_PID)"
        break
    fi
    sleep 1
    if [ "$i" -eq 20 ]; then
        echo "ERROR: Ember didn't come up in 20s, check /tmp/ember.log"
        cat /tmp/ember.log
        exit 1
    fi
done

# ── 2. start file server ──────────────────────────────────────────
echo "[2] starting file server on port 8080..."
cd "$SERVE_DIR"
python3 -m http.server 8080 >/tmp/files.log 2>&1 &
FILES_PID=$!
cd "$J2ME_DIR"
echo "[2] file server up (PID $FILES_PID)"

# ── 3. start Ember tunnel ─────────────────────────────────────────
echo "[3] starting Ember tunnel..."
cloudflared tunnel --url http://localhost:3000 >"$CF_LOG" 2>&1 &
CF_PID=$!

EMBER_URL=""
for i in $(seq 1 30); do
    EMBER_URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$CF_LOG" 2>/dev/null | head -1 || true)
    [ -n "$EMBER_URL" ] && break
    sleep 1
done

if [ -z "$EMBER_URL" ]; then
    echo "ERROR: Ember tunnel didn't give a URL in 30s"
    cat "$CF_LOG"; exit 1
fi
echo "[3] Ember tunnel: $EMBER_URL"

# ── 4. start file server tunnel ───────────────────────────────────
echo "[4] starting file server tunnel..."
cloudflared tunnel --url http://localhost:8080 >"$CF_FILES_LOG" 2>&1 &
CF_FILES_PID=$!

FILES_URL=""
for i in $(seq 1 30); do
    FILES_URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$CF_FILES_LOG" 2>/dev/null | head -1 || true)
    [ -n "$FILES_URL" ] && break
    sleep 1
done

if [ -z "$FILES_URL" ]; then
    echo "ERROR: file server tunnel didn't give a URL in 30s"
    cat "$CF_FILES_LOG"; exit 1
fi
echo "[4] file server tunnel: $FILES_URL"

# ── 5. patch EMBER_HOST ───────────────────────────────────────────
echo "[5] patching EMBER_HOST..."
sed -i "s|private static final String EMBER_HOST = \".*\"|private static final String EMBER_HOST = \"$EMBER_URL\"|" EmberVeer.java

# ── 6. build ─────────────────────────────────────────────────────
echo "[6] building..."
rm -rf build build_pre
mkdir -p build build_pre

echo "  [1/4] compiling (CLDC-1.1 compatible: -source/-target 1.3)"
"$JAVAC" -source 1.3 -target 1.3 -bootclasspath "$CP" -d build EmberVeer.java 2>&1 \
    | grep -v -e obsolete -e "suppress warnings" || true

echo "  [2/4] preverifying"
"$WTK/bin/preverify" -classpath "$CP" -d build_pre build

echo "  [3/4] packaging JAR"
rm -f EmberVeer.jar
jar cfm EmberVeer.jar manifest.mf -C build_pre .

echo "  [4/4] syncing JAD size"
SIZE=$(stat -c %s EmberVeer.jar)
sed -i "s/^MIDlet-Jar-Size:.*/MIDlet-Jar-Size: $SIZE/" EmberVeer.jad
echo "[6] done: EmberVeer.jar ($SIZE bytes)"

# ── 7. copy to serve/jar ─────────────────────────────────────────
echo "[7] syncing to serve/jar..."
cp EmberVeer.jar EmberVeer.jad "$SERVE_DIR/jar/"

# ── 8. QR code ───────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " scan to download JAR:"
echo ""
qrencode -t ansiutf8 "$FILES_URL/jar/"
echo ""
echo " $FILES_URL/jar/"
echo " ember: $EMBER_URL"
echo " Ctrl-C to kill everything"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

wait "$CF_PID"
