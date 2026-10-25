package com.mikael.puxapapo;

import android.Manifest;
import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.MediaRecorder;
import android.net.Uri;
import android.os.Bundle;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.Iterator;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Casca Android do Puxa Papo: uma WebView com assets/index.html e uma ponte "Android"
 * para rede, galeria, áudio, microfone, área de transferência e compartilhamento.
 */
public class MainActivity extends Activity {
    private static final int REQ_PICK = 4711;
    private static final int REQ_MIC = 4712;
    private static final int BG = 0xFF0F0C17;
    /** Limite por arquivo de áudio (bytes). Acima disso a IA recusa o pedido inline. */
    private static final int MAX_AUDIO = 12 * 1024 * 1024;

    private WebView web;
    private String pickCallback = null;
    private boolean pickAudio = false;
    private String pendingShared = "[]";
    private String pendingSharedAudio = "[]";
    private String micCallback = null;
    private MediaRecorder recorder = null;
    private File recFile = null;

    @Override
    protected void onCreate(Bundle bundle) {
        super.onCreate(bundle);
        Window window = getWindow();
        window.setStatusBarColor(BG);
        window.setNavigationBarColor(BG);
        web = new WebView(this);
        web.setBackgroundColor(BG);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setTextZoom(100);
        web.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
        web.addJavascriptInterface(new Bridge(), "Android");
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (!url.startsWith("http://") && !url.startsWith("https://")) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (Exception e) { }
                return true;
            }
        });
        setContentView(web);
        handleShareIntent(getIntent());
        web.loadUrl("file:///android_asset/index.html");
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleShareIntent(intent);
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("(window.handleBack && window.handleBack()) ? 'ok' : 'exit'", v -> {
            if (v == null || v.contains("exit")) MainActivity.super.onBackPressed();
        });
    }

    @Override
    protected void onDestroy() {
        stopRecorder(false);
        super.onDestroy();
    }

    private void js(final String code) {
        runOnUiThread(() -> web.evaluateJavascript(code, null));
    }

    private boolean isAudio(Uri uri) {
        String t = getContentResolver().getType(uri);
        if (t != null) return t.startsWith("audio/") || t.contains("ogg") || t.contains("opus");
        String p = uri.toString().toLowerCase();
        return p.endsWith(".opus") || p.endsWith(".ogg") || p.endsWith(".mp3") || p.endsWith(".m4a")
                || p.endsWith(".aac") || p.endsWith(".wav") || p.endsWith(".amr");
    }

    private void handleShareIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        final ArrayList<Uri> uris = new ArrayList<>();
        try {
            if (Intent.ACTION_SEND.equals(action)) {
                Uri u = intent.getParcelableExtra(Intent.EXTRA_STREAM);
                if (u != null) uris.add(u);
            } else if (Intent.ACTION_SEND_MULTIPLE.equals(action)) {
                ArrayList<Uri> list = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
                if (list != null) uris.addAll(list);
            }
        } catch (Exception e) { }
        if (uris.isEmpty()) return;
        new Thread(() -> {
            ArrayList<Uri> imgs = new ArrayList<>(), auds = new ArrayList<>();
            for (Uri u : uris) (isAudio(u) ? auds : imgs).add(u);
            final String i = encodeImages(imgs), a = encodeAudios(auds);
            runOnUiThread(() -> {
                pendingShared = i;
                pendingSharedAudio = a;
                web.evaluateJavascript("window.onSharedReady && window.onSharedReady()", null);
            });
        }).start();
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req != REQ_PICK) return;
        final String cb = pickCallback;
        final boolean audio = pickAudio;
        pickCallback = null;
        final ArrayList<Uri> uris = new ArrayList<>();
        if (res == RESULT_OK && data != null) {
            ClipData clip = data.getClipData();
            if (clip != null) {
                for (int i = 0; i < clip.getItemCount(); i++) uris.add(clip.getItemAt(i).getUri());
            } else if (data.getData() != null) {
                uris.add(data.getData());
            }
        }
        new Thread(() -> {
            String json = audio ? encodeAudios(uris) : encodeImages(uris);
            js("window.__picked(" + JSONObject.quote(cb == null ? "" : cb) + "," + json + ")");
        }).start();
    }

    /** Imagens: reduz para no máximo 1080x2400 e devolve JPEG em base64 (lista de strings). */
    private String encodeImages(ArrayList<Uri> uris) {
        JSONArray out = new JSONArray();
        for (Uri uri : uris) {
            try {
                BitmapFactory.Options o = new BitmapFactory.Options();
                o.inJustDecodeBounds = true;
                InputStream in = getContentResolver().openInputStream(uri);
                BitmapFactory.decodeStream(in, null, o);
                if (in != null) in.close();
                int sample = 1;
                while (o.outWidth / (sample * 2) >= 1080 || o.outHeight / (sample * 2) >= 2400) sample *= 2;
                BitmapFactory.Options o2 = new BitmapFactory.Options();
                o2.inSampleSize = sample;
                InputStream in2 = getContentResolver().openInputStream(uri);
                Bitmap bmp = BitmapFactory.decodeStream(in2, null, o2);
                if (in2 != null) in2.close();
                if (bmp == null) continue;
                float sc = Math.min(1f, Math.min(1080f / bmp.getWidth(), 2400f / bmp.getHeight()));
                if (sc < 1f) {
                    Bitmap scaled = Bitmap.createScaledBitmap(bmp, Math.round(bmp.getWidth() * sc), Math.round(bmp.getHeight() * sc), true);
                    if (scaled != bmp) bmp.recycle();
                    bmp = scaled;
                }
                ByteArrayOutputStream bos = new ByteArrayOutputStream();
                bmp.compress(Bitmap.CompressFormat.JPEG, 82, bos);
                bmp.recycle();
                out.put(Base64.encodeToString(bos.toByteArray(), Base64.NO_WRAP));
            } catch (Throwable t) { }
        }
        return out.toString();
    }

    private String fileName(Uri uri) {
        try (Cursor c = getContentResolver().query(uri, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
            if (c != null && c.moveToFirst()) return c.getString(0);
        } catch (Exception e) { }
        String p = uri.getLastPathSegment();
        return p == null ? "audio" : p;
    }

    /** Converte o tipo do arquivo para um que a IA (Gemini) aceita. */
    private static String audioMime(String type, String name) {
        String t = (type == null ? "" : type.toLowerCase()) + " " + (name == null ? "" : name.toLowerCase());
        if (t.contains("ogg") || t.contains("opus")) return "audio/ogg";
        if (t.contains("mpeg") || t.contains("mp3")) return "audio/mp3";
        if (t.contains("wav")) return "audio/wav";
        if (t.contains("flac")) return "audio/flac";
        if (t.contains("aiff")) return "audio/aiff";
        if (t.contains("amr")) return "audio/amr";
        if (t.contains("aac") && !t.contains("mp4") && !t.contains("m4a")) return "audio/aac";
        if (t.contains("mp4") || t.contains("m4a")) return "audio/mp4";
        return type != null && type.startsWith("audio/") ? type : "audio/ogg";
    }

    private static byte[] readAll(InputStream in, int max) throws Exception {
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        byte[] buf = new byte[16384];
        int n, total = 0;
        while ((n = in.read(buf)) > 0) {
            total += n;
            if (total > max) return null;
            bos.write(buf, 0, n);
        }
        return bos.toByteArray();
    }

    /** Áudios: devolve [{mime, name, data(base64), big}] sem converter o arquivo. */
    private String encodeAudios(ArrayList<Uri> uris) {
        JSONArray out = new JSONArray();
        for (Uri uri : uris) {
            try {
                String name = fileName(uri);
                JSONObject o = new JSONObject();
                o.put("name", name);
                o.put("mime", audioMime(getContentResolver().getType(uri), name));
                try (InputStream in = getContentResolver().openInputStream(uri)) {
                    byte[] b = in == null ? null : readAll(in, MAX_AUDIO);
                    if (b == null) o.put("big", true);
                    else o.put("data", Base64.encodeToString(b, Base64.NO_WRAP));
                }
                out.put(o);
            } catch (Throwable t) { }
        }
        return out.toString();
    }

    // ---------------- Microfone ----------------

    private void startRecorder() {
        try {
            recFile = new File(getCacheDir(), "gravacao.aac");
            recorder = new MediaRecorder();
            recorder.setAudioSource(MediaRecorder.AudioSource.MIC);
            recorder.setOutputFormat(MediaRecorder.OutputFormat.AAC_ADTS);
            recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
            recorder.setAudioSamplingRate(44100);
            recorder.setAudioEncodingBitRate(64000);
            recorder.setMaxDuration(5 * 60 * 1000);
            recorder.setOutputFile(recFile.getAbsolutePath());
            recorder.prepare();
            recorder.start();
            js("window.__recState && window.__recState('on','')");
        } catch (Exception e) {
            stopRecorder(false);
            js("window.__recState && window.__recState('erro'," + JSONObject.quote("Não consegui usar o microfone: " + e.getMessage()) + ")");
        }
    }

    /** Para a gravação; se send, devolve o áudio para o callback do JS. */
    private void stopRecorder(boolean send) {
        final String cb = micCallback;
        micCallback = null;
        boolean ok = false;
        if (recorder != null) {
            try { recorder.stop(); ok = true; } catch (Exception e) { }
            try { recorder.release(); } catch (Exception e) { }
            recorder = null;
        }
        if (!send || cb == null) return;
        final boolean recorded = ok;
        new Thread(() -> {
            String json = "null";
            try {
                if (recorded && recFile != null && recFile.length() > 0) {
                    byte[] b;
                    try (FileInputStream in = new FileInputStream(recFile)) { b = readAll(in, MAX_AUDIO); }
                    if (b != null) {
                        JSONObject o = new JSONObject();
                        o.put("name", "gravacao.aac");
                        o.put("mime", "audio/aac");
                        o.put("data", Base64.encodeToString(b, Base64.NO_WRAP));
                        json = o.toString();
                    }
                }
            } catch (Exception e) { }
            if (recFile != null) recFile.delete();
            js("window.__recDone(" + JSONObject.quote(cb) + "," + json + ")");
        }).start();
    }

    @Override
    public void onRequestPermissionsResult(int req, String[] perms, int[] res) {
        super.onRequestPermissionsResult(req, perms, res);
        if (req != REQ_MIC) return;
        if (res.length > 0 && res[0] == PackageManager.PERMISSION_GRANTED) startRecorder();
        else {
            micCallback = null;
            js("window.__recState && window.__recState('negado','Sem permissão do microfone. Libere em Configurações > Apps > Puxa Papo > Permissões.')");
        }
    }

    public class Bridge {
        @JavascriptInterface
        public void pickImages(String id) { pick(id, "image/*", "Escolha os prints", false); }

        @JavascriptInterface
        public void pickAudios(String id) { pick(id, "audio/*", "Escolha os áudios", true); }

        private void pick(String id, String type, String title, boolean audio) {
            pickCallback = id;
            pickAudio = audio;
            Intent i = new Intent(Intent.ACTION_GET_CONTENT);
            i.setType(type);
            i.addCategory(Intent.CATEGORY_OPENABLE);
            i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
            if (audio) i.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"audio/*", "application/ogg"});
            try {
                startActivityForResult(Intent.createChooser(i, title), REQ_PICK);
            } catch (Exception e) {
                toast(audio ? "Não achei os arquivos de áudio" : "Não achei a galeria");
            }
        }

        @JavascriptInterface
        public String getShared() {
            String s = pendingShared;
            pendingShared = "[]";
            return s;
        }

        @JavascriptInterface
        public String getSharedAudio() {
            String s = pendingSharedAudio;
            pendingSharedAudio = "[]";
            return s;
        }

        @JavascriptInterface
        public void recStart(final String id) {
            runOnUiThread(() -> {
                if (recorder != null) return;
                micCallback = id;
                if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) startRecorder();
                else requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQ_MIC);
            });
        }

        @JavascriptInterface
        public void recStop() { runOnUiThread(() -> stopRecorder(true)); }

        @JavascriptInterface
        public void recCancel() { runOnUiThread(() -> stopRecorder(false)); }

        @JavascriptInterface
        public void copy(String text) {
            ClipboardManager cm = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
            if (cm != null) cm.setPrimaryClip(ClipData.newPlainText("mensagem", text));
        }

        @JavascriptInterface
        public void share(String text) {
            Intent i = new Intent(Intent.ACTION_SEND);
            i.setType("text/plain");
            i.putExtra(Intent.EXTRA_TEXT, text);
            Intent c = Intent.createChooser(i, "Enviar por...");
            c.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(c);
        }

        @JavascriptInterface
        public void toast(final String msg) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, msg, Toast.LENGTH_SHORT).show());
        }

        @JavascriptInterface
        public void openUrl(String url) {
            try {
                Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(i);
            } catch (Exception e) {
                toast("Não consegui abrir o link");
            }
        }

        /** Requisição HTTP fora da WebView (sem CORS). Responde em window.__httpCb(id, status, texto). */
        @JavascriptInterface
        public void http(final String id, final String method, final String url, final String headersJson, final String body) {
            new Thread(() -> {
                int status;
                String text;
                HttpURLConnection con = null;
                try {
                    con = (HttpURLConnection) new URL(url).openConnection();
                    con.setRequestMethod(method);
                    con.setConnectTimeout(30000);
                    con.setReadTimeout(180000);
                    JSONObject h = new JSONObject(headersJson == null || headersJson.isEmpty() ? "{}" : headersJson);
                    Iterator<String> keys = h.keys();
                    while (keys.hasNext()) {
                        String k = keys.next();
                        con.setRequestProperty(k, h.getString(k));
                    }
                    if (body != null && !body.isEmpty() && !"GET".equals(method)) {
                        byte[] b = body.getBytes("UTF-8");
                        con.setDoOutput(true);
                        con.setFixedLengthStreamingMode(b.length);
                        try (OutputStream os = con.getOutputStream()) { os.write(b); }
                    }
                    status = con.getResponseCode();
                    InputStream in = status >= 400 ? con.getErrorStream() : con.getInputStream();
                    byte[] r = in == null ? new byte[0] : readAll(in, Integer.MAX_VALUE);
                    if (in != null) in.close();
                    text = new String(r, "UTF-8");
                } catch (Exception e) {
                    status = -1;
                    text = "Sem conexão ou erro de rede: " + e.getMessage();
                } finally {
                    if (con != null) con.disconnect();
                }
                js("window.__httpCb(" + JSONObject.quote(id) + "," + status + "," + JSONObject.quote(text) + ")");
            }).start();
        }
    }
}
