package com.pixelduck.androidboycamera;

import android.Manifest;
import android.app.Activity;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.MimeTypeMap;

import com.hoho.android.usbserial.driver.UsbSerialDriver;
import com.hoho.android.usbserial.driver.UsbSerialPort;
import com.hoho.android.usbserial.driver.UsbSerialProber;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public class MainActivity extends Activity {
    private static final int CAMERA_PERMISSION = 10;
    private static final int FILE_CHOOSER = 11;
    private static final String USB_PERMISSION = "com.pixelduck.androidboycamera.USB_PERMISSION";

    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    private UsbManager usbManager;
    private UsbDevice usbDevice;
    private UsbDeviceConnection usbConnection;
    private UsbSerialPort usbPort;

    private final BroadcastReceiver usbReceiver = new BroadcastReceiver() {
        @Override public void onReceive(Context context, Intent intent) {
            if (USB_PERMISSION.equals(intent.getAction())) {
                String result;
                if (intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)) {
                    usbDevice = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
                    result = openUsb();
                } else {
                    result = "Доступ к USB не разрешён";
                }
                String escaped = result.replace("\\", "\\\\").replace("\"", "\\\"");
                webView.evaluateJavascript("window.__androidUsbResult && window.__androidUsbResult(\"" + escaped + "\")", null);
            } else if (UsbManager.ACTION_USB_DEVICE_DETACHED.equals(intent.getAction())) {
                UsbDevice detached = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
                if (usbDevice != null && detached != null && detached.getDeviceId() == usbDevice.getDeviceId()) {
                    disconnectUsb();
                    webView.evaluateJavascript(
                            "window.__androidUsbDetached && window.__androidUsbDetached()", null);
                }
            }
        }
    };

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        usbManager = (UsbManager) getSystemService(Context.USB_SERVICE);
        IntentFilter filter = new IntentFilter(USB_PERMISSION);
        filter.addAction(UsbManager.ACTION_USB_DEVICE_DETACHED);
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(usbReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        else registerReceiver(usbReceiver, filter);

        webView = new WebView(this);
        setContentView(webView);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        webView.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");
        webView.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!"app.local".equals(uri.getHost())) return null;
                String path = uri.getPath();
                if (path == null || path.equals("/")) path = "/index.html";
                path = Uri.decode(path.substring(1));
                try {
                    InputStream input = getAssets().open(path);
                    String extension = MimeTypeMap.getFileExtensionFromUrl(path);
                    String mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension);
                    if (mime == null) {
                        if ("js".equals(extension)) mime = "application/javascript";
                        else if ("svg".equals(extension)) mime = "image/svg+xml";
                        else mime = "application/octet-stream";
                    }
                    return new WebResourceResponse(mime, "UTF-8", input);
                } catch (Exception ignored) {
                    return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", Collections.emptyMap(), null);
                }
            }

            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("app.local".equals(uri.getHost())) return false;
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
                return true;
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> {
                    if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                        request.grant(request.getResources());
                    } else {
                        request.deny();
                        requestPermissions(new String[]{Manifest.permission.CAMERA}, CAMERA_PERMISSION);
                    }
                });
            }

            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("image/*");
                startActivityForResult(intent, FILE_CHOOSER);
                return true;
            }
        });

        if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.CAMERA}, CAMERA_PERMISSION);
        }
        webView.loadUrl("https://app.local/index.html");
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER && fileCallback != null) {
            Uri[] result = resultCode == RESULT_OK && data != null && data.getData() != null
                    ? new Uri[]{data.getData()} : null;
            fileCallback.onReceiveValue(result);
            fileCallback = null;
        }
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (UsbManager.ACTION_USB_DEVICE_ATTACHED.equals(intent.getAction()) && webView != null) {
            webView.evaluateJavascript(
                    "window.__androidUsbAttached && window.__androidUsbAttached()", null);
        }
    }

    @Override public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override protected void onPause() {
        if (webView != null) {
            webView.evaluateJavascript(
                    "window.__androidAppPaused && window.__androidAppPaused()", null);
            webView.onPause();
        }
        super.onPause();
    }

    @Override protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.onResume();
            webView.evaluateJavascript(
                    "window.__androidAppResumed && window.__androidAppResumed()", null);
        }
    }

    @Override protected void onDestroy() {
        disconnectUsb();
        unregisterReceiver(usbReceiver);
        webView.destroy();
        super.onDestroy();
    }

    private String openUsb() {
        List<UsbSerialDriver> drivers = UsbSerialProber.getDefaultProber().findAllDrivers(usbManager);
        if (drivers.isEmpty()) return "USB Serial-адаптер или Arduino не найдены";
        UsbSerialDriver driver = drivers.get(0);
        UsbDevice device = driver.getDevice();
        if (!usbManager.hasPermission(device)) {
            PendingIntent permission = PendingIntent.getBroadcast(this, 0, new Intent(USB_PERMISSION).setPackage(getPackageName()),
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            usbManager.requestPermission(device, permission);
            return "PENDING";
        }
        disconnectUsb();
        usbDevice = device;
        usbConnection = usbManager.openDevice(device);
        if (usbConnection == null) return "Не удалось открыть USB-адаптер";
        try {
            usbPort = driver.getPorts().get(0);
            usbPort.open(usbConnection);
            usbPort.setParameters(9600, 8, UsbSerialPort.STOPBITS_1, UsbSerialPort.PARITY_NONE);
            try { usbPort.setDTR(true); } catch (Exception ignored) {}
            try { usbPort.setRTS(true); } catch (Exception ignored) {}
            // Opening many Arduino boards resets them. Give the printer bridge
            // enough time to finish booting and detect the physical printer.
            try { Thread.sleep(1500); } catch (InterruptedException ignored) {
                Thread.currentThread().interrupt();
            }
            try { usbPort.purgeHwBuffers(false, true); } catch (Exception ignored) {}
        } catch (Exception error) {
            disconnectUsb();
            return "Ошибка открытия USB Serial: " + error.getMessage();
        }
        return "READY";
    }

    private void disconnectUsb() {
        if (usbPort != null) {
            try { usbPort.close(); } catch (Exception ignored) {}
        }
        if (usbConnection != null) usbConnection.close();
        usbPort = null;
        usbConnection = null;
        usbDevice = null;
    }

    public class AndroidBridge {
        @JavascriptInterface public String connectUsb() {
            return openUsb();
        }

        @JavascriptInterface public String restartUsb() {
            return openUsb();
        }

        @JavascriptInterface public boolean isUsbConnected() {
            if (usbPort == null || !usbPort.isOpen() || usbDevice == null) return false;
            for (UsbDevice connected : usbManager.getDeviceList().values()) {
                if (connected.getDeviceId() == usbDevice.getDeviceId()) return true;
            }
            return false;
        }

        @JavascriptInterface public String writeUsb(String encoded) {
            if (usbPort == null || !usbPort.isOpen()) return "Arduino не подключена";
            byte[] bytes = Base64.decode(encoded, Base64.DEFAULT);
            try {
                usbPort.write(bytes, 5000);
                return "OK";
            } catch (Exception error) {
                return "Ошибка передачи USB: " + error.getMessage();
            }
        }

        @JavascriptInterface public synchronized String exchangeUsb(String encoded, int timeoutMs) {
            if (usbPort == null || !usbPort.isOpen()) return "ERROR:Arduino не подключена";
            byte[] request = Base64.decode(encoded, Base64.DEFAULT);
            ByteArrayOutputStream response = new ByteArrayOutputStream(request.length);
            try {
                try { usbPort.purgeHwBuffers(false, true); } catch (Exception ignored) {}
                usbPort.write(request, Math.max(5000, timeoutMs));
                long deadline = System.currentTimeMillis() + Math.max(100, timeoutMs);
                byte[] chunk = new byte[Math.min(1024, request.length)];
                while (response.size() < request.length && System.currentTimeMillis() < deadline) {
                    int remaining = (int) Math.max(1, deadline - System.currentTimeMillis());
                    int count = usbPort.read(chunk, remaining);
                    if (count > 0) response.write(chunk, 0, Math.min(count, request.length - response.size()));
                }
                if (response.size() != request.length) {
                    return "ERROR:Принтер не ответил вовремя";
                }
                return Base64.encodeToString(response.toByteArray(), Base64.NO_WRAP);
            } catch (Exception error) {
                return "ERROR:Ошибка обмена USB: " + error.getMessage();
            }
        }

        @JavascriptInterface public void disconnectUsb() {
            MainActivity.this.disconnectUsb();
        }

        @JavascriptInterface public String savePng(String dataUrl) {
            try {
                int comma = dataUrl.indexOf(',');
                byte[] png = Base64.decode(dataUrl.substring(comma + 1), Base64.DEFAULT);
                String name = "android-boy-camera-" + new SimpleDateFormat("yyyyMMdd-HHmmss", Locale.US).format(new Date()) + ".png";
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.Images.Media.DISPLAY_NAME, name);
                    values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
                    values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/Android Boy Camera");
                    Uri uri = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
                    if (uri == null) return "Не удалось создать файл";
                    try (OutputStream output = getContentResolver().openOutputStream(uri)) {
                        output.write(png);
                    }
                } else {
                    File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), "Android Boy Camera");
                    if (!dir.exists() && !dir.mkdirs()) return "Не удалось создать папку";
                    File file = new File(dir, name);
                    try (OutputStream output = new FileOutputStream(file)) {
                        output.write(png);
                    }
                    sendBroadcast(new Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE, Uri.fromFile(file)));
                }
                return "OK";
            } catch (Exception error) {
                return "Ошибка сохранения: " + error.getMessage();
            }
        }

        @JavascriptInterface public String sharePng(String dataUrl) {
            try {
                int comma = dataUrl.indexOf(',');
                byte[] png = Base64.decode(dataUrl.substring(comma + 1), Base64.DEFAULT);
                File dir = new File(getCacheDir(), "share");
                if (!dir.exists() && !dir.mkdirs()) return "Could not create share cache";
                File file = new File(dir, "android-boy-camera.png");
                try (OutputStream output = new FileOutputStream(file)) {
                    output.write(png);
                }
                Uri uri = Uri.parse("content://" + getPackageName() + ".share/image.png");
                Intent send = new Intent(Intent.ACTION_SEND);
                send.setType("image/png");
                send.putExtra(Intent.EXTRA_STREAM, uri);
                send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                runOnUiThread(() -> startActivity(Intent.createChooser(send, "Android Boy Camera")));
                return "OK";
            } catch (Exception error) {
                return "Share error: " + error.getMessage();
            }
        }
    }
}
