#!/usr/bin/env bash
# Gera ManualDoAssassino.apk a partir de livro.md, sem Gradle.
# Precisa de: Python 3 (markdown, Pillow), JDK 17+ e Android SDK com
# platforms;android-35 e build-tools;35.0.0. Aponte ANDROID_SDK para a pasta do SDK.
set -euo pipefail

cd "$(dirname "$0")"
SDK="${ANDROID_SDK:?defina ANDROID_SDK com a pasta do Android SDK}"
BT="$SDK/build-tools/35.0.0"
JAR="$SDK/platforms/android-35/android.jar"
KEYSTORE="${KEYSTORE:-assinatura.jks}"
KEYPASS="${KEYPASS:-manualdoassassino}"
OUT=ManualDoAssassino.apk
B=build

python3 build_html.py
python3 make_icon.py

rm -rf "$B" && mkdir -p "$B/res" "$B/gen" "$B/classes"

# 1. Recursos (textos, tema, ícones) + manifesto + o livro em assets
"$BT/aapt2" compile --dir android/res -o "$B/res/res.zip"
"$BT/aapt2" link -o "$B/base.apk" -I "$JAR" \
  --manifest android/AndroidManifest.xml -A android/assets \
  --java "$B/gen" "$B/res/res.zip"

# 2. Código Java -> bytecode -> formato do Android (dex)
javac --release 11 -nowarn -classpath "$JAR" -d "$B/classes" \
  $(find android/src "$B/gen" -name '*.java')
"$BT/d8" --release --min-api 24 --lib "$JAR" --output "$B" \
  $(find "$B/classes" -name '*.class')

# 3. Junta tudo, alinha e assina
cp "$B/base.apk" "$B/unsigned.apk"
(cd "$B" && zip -q -j unsigned.apk classes.dex)
"$BT/zipalign" -f -p 4 "$B/unsigned.apk" "$B/aligned.apk"

if [ ! -f "$KEYSTORE" ]; then
  keytool -genkeypair -keystore "$KEYSTORE" -alias manual -keyalg RSA -keysize 2048 \
    -validity 10000 -storepass "$KEYPASS" -keypass "$KEYPASS" \
    -dname "CN=Manual do Assassino, O=Pessoal, C=BR"
fi
"$BT/apksigner" sign --ks "$KEYSTORE" --ks-key-alias manual \
  --ks-pass "pass:$KEYPASS" --key-pass "pass:$KEYPASS" --out "$OUT" "$B/aligned.apk"
"$BT/apksigner" verify --verbose "$OUT" | head -5
ls -lh "$OUT"
