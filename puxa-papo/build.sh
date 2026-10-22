#!/usr/bin/env bash
# Reconstrói o APK do Puxa Papo a partir do APK original + app/index.html.
# Uso: ./build.sh <PuxaPapo-original.apk> <versionCode> <versionName>
# Ex.: ./build.sh PuxaPapo.apk 2 1.1
# Assina com a mesma chave "Android Debug" do uber-apk-signer usada no APK original,
# para instalar por cima sem perder os dados do app.
set -euo pipefail
IN=$(realpath "$1"); CODE=${2:-2}; NAME=${3:-1.1}
HERE=$(cd "$(dirname "$0")" && pwd)
T=${TOOLS:-$HERE/.tools}; mkdir -p "$T"
[ -d "$T/android-14" ] || { curl -sSL -o "$T/bt.zip" https://dl.google.com/android/repository/build-tools_r34-linux.zip && unzip -q -o "$T/bt.zip" -d "$T"; }
[ -f "$T/debug.keystore" ] || { curl -sSL -o "$T/uber.jar" https://github.com/patrickfav/uber-apk-signer/releases/download/v1.3.0/uber-apk-signer-1.3.0.jar && (cd "$T" && unzip -q -o uber.jar debug.keystore); }
W=$(mktemp -d); trap 'rm -rf "$W"' EXIT
mkdir "$W/s" && (cd "$W/s" && unzip -q "$IN" && rm -rf META-INF)
cp "$HERE/app/index.html" "$W/s/assets/index.html"
python3 -I "$HERE/patch_manifest.py" "$W/s/AndroidManifest.xml" "$W/s/AndroidManifest.xml" "$CODE" "$NAME"
(cd "$W/s" && zip -q -0 ../u.apk resources.arsc && zip -q -9 -r ../u.apk AndroidManifest.xml classes.dex assets res)
"$T/android-14/zipalign" -p -f 4 "$W/u.apk" "$W/a.apk"
mkdir -p "$HERE/dist"; OUT="$HERE/dist/PuxaPapo-v$NAME.apk"
"$T/android-14/apksigner" sign --ks "$T/debug.keystore" --ks-pass pass:android --ks-key-alias androiddebugkey --key-pass pass:android --out "$OUT" "$W/a.apk"
"$T/android-14/apksigner" verify "$OUT" && echo "OK: $OUT"
