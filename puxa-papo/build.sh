#!/usr/bin/env bash
# Compila o Puxa Papo do zero: android/ (Java + manifesto + ícones) + app/index.html.
# Uso: ./build.sh <versionCode> <versionName>     Ex.: ./build.sh 6 1.5
# Assina com a mesma chave "Android Debug" do uber-apk-signer usada desde a v1.0,
# para instalar por cima sem perder os dados do app.
set -euo pipefail
CODE=${1:?versionCode}; NAME=${2:?versionName}
HERE=$(cd "$(dirname "$0")" && pwd); A="$HERE/android"
T=${TOOLS:-$HERE/.tools}; mkdir -p "$T"
BT="$T/android-16"; JAR="$T/android-11/android.jar"
[ -d "$BT" ] || { curl -sSL -o "$T/bt.zip" https://dl.google.com/android/repository/build-tools_r36_linux.zip && unzip -q -o "$T/bt.zip" -d "$T"; }
[ -f "$JAR" ] || { curl -sSL -o "$T/p30.zip" https://dl.google.com/android/repository/platform-30_r03.zip && unzip -q -o "$T/p30.zip" -d "$T"; }
[ -f "$T/debug.keystore" ] || { curl -sSL -o "$T/uber.jar" https://github.com/patrickfav/uber-apk-signer/releases/download/v1.3.0/uber-apk-signer-1.3.0.jar && (cd "$T" && unzip -q -o uber.jar debug.keystore); }
W=$(mktemp -d); trap 'rm -rf "$W"' EXIT
# 1. recursos + manifesto
"$BT/aapt2" compile --dir "$A/res" -o "$W/res.zip"
"$BT/aapt2" link -I "$JAR" --manifest "$A/AndroidManifest.xml" --version-code "$CODE" --version-name "$NAME" \
  --min-sdk-version 23 --target-sdk-version 30 -o "$W/base.apk" "$W/res.zip"
# 2. Java -> dex
mkdir -p "$W/cls" "$W/dex"
javac -nowarn -Xlint:-options -source 8 -target 8 -bootclasspath "$JAR" -classpath "$BT/core-lambda-stubs.jar" -d "$W/cls" $(find "$A/src" -name '*.java')
"$BT/d8" --min-api 23 --release --lib "$JAR" --output "$W/dex" $(find "$W/cls" -name '*.class')
# 3. juntar tudo
mkdir -p "$W/z/assets" && cp "$HERE/app/index.html" "$W/z/assets/index.html" && cp "$W/dex/classes.dex" "$W/z/"
cp "$W/base.apk" "$W/u.apk"
(cd "$W/z" && zip -q -9 ../u.apk classes.dex assets/index.html)
"$BT/zipalign" -p -f 4 "$W/u.apk" "$W/a.apk"
mkdir -p "$HERE/dist"; OUT="$HERE/dist/PuxaPapo-v$NAME.apk"
"$BT/apksigner" sign --v4-signing-enabled false --ks "$T/debug.keystore" --ks-pass pass:android --ks-key-alias androiddebugkey --key-pass pass:android --out "$OUT" "$W/a.apk"
"$BT/apksigner" verify "$OUT" && echo "OK: $OUT"
