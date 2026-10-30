package com.tareeq.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.os.Bundle;
import android.provider.MediaStore;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;

import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;

import java.io.File;
import java.io.IOException;
import java.util.Arrays;
import java.util.List;

/**
 * Tareeq — a thin Android "container" around the Tareeq website.
 * Everything the user sees comes from the URL in res/values/strings.xml (start_url).
 */
public class MainActivity extends AppCompatActivity {

    // Links to these hosts open in their own apps / the browser instead of inside Tareeq.
    private static final List<String> EXTERNAL_HOSTS = Arrays.asList(
            "wa.me", "api.whatsapp.com", "play.google.com",
            "maps.google.com", "maps.app.goo.gl", "goo.gl");

    private WebView webView;
    private ProgressBar progressBar;
    private View offlineView;
    private String startUrl;
    private boolean mainFrameError = false;

    // File upload (photo of the street problem)
    private ValueCallback<Uri[]> filePathCallback;
    private WebChromeClient.FileChooserParams pendingChooserParams;
    private Uri cameraImageUri;
    private File cameraImageFile;

    // GPS
    private GeolocationPermissions.Callback geoCallback;
    private String geoOrigin;

    // In-page camera (getUserMedia)
    private PermissionRequest pendingWebPermission;

    private ActivityResultLauncher<Intent> fileChooserLauncher;
    private ActivityResultLauncher<String> uploadCameraPermissionLauncher;
    private ActivityResultLauncher<String> webCameraPermissionLauncher;
    private ActivityResultLauncher<String[]> locationPermissionLauncher;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webview);
        progressBar = findViewById(R.id.progress);
        offlineView = findViewById(R.id.offline);
        startUrl = getString(R.string.start_url);

        registerLaunchers();
        setupWebView();

        findViewById(R.id.retry).setOnClickListener(v -> retry());

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack();
                } else {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                }
            }
        });

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            webView.loadUrl(startUrl);
        }
    }

    // ------------------------------------------------------------------ setup

    private void registerLaunchers() {
        fileChooserLauncher = registerForActivityResult(
                new ActivityResultContracts.StartActivityForResult(), result -> {
                    Uri[] uris = null;
                    if (result.getResultCode() == RESULT_OK) {
                        Intent data = result.getData();
                        if (data != null && data.getClipData() != null) {
                            int n = data.getClipData().getItemCount();
                            uris = new Uri[n];
                            for (int i = 0; i < n; i++) {
                                uris[i] = data.getClipData().getItemAt(i).getUri();
                            }
                        } else if (data != null && data.getData() != null) {
                            uris = new Uri[]{data.getData()};
                        } else if (cameraImageUri != null && cameraImageFile != null
                                && cameraImageFile.length() > 0) {
                            uris = new Uri[]{cameraImageUri};
                        }
                    }
                    deliverFiles(uris);
                });

        uploadCameraPermissionLauncher = registerForActivityResult(
                new ActivityResultContracts.RequestPermission(),
                granted -> launchFileChooser(granted));

        webCameraPermissionLauncher = registerForActivityResult(
                new ActivityResultContracts.RequestPermission(), granted -> {
                    if (pendingWebPermission != null) {
                        if (granted) {
                            pendingWebPermission.grant(
                                    new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
                        } else {
                            pendingWebPermission.deny();
                        }
                        pendingWebPermission = null;
                    }
                });

        locationPermissionLauncher = registerForActivityResult(
                new ActivityResultContracts.RequestMultiplePermissions(), results -> {
                    if (geoCallback != null) {
                        geoCallback.invoke(geoOrigin, hasLocationPermission(), false);
                    }
                    geoCallback = null;
                    geoOrigin = null;
                });
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void setupWebView() {
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setGeolocationEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setAllowFileAccess(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        // Lets the website detect it is running inside the app, if it ever needs to.
        s.setUserAgentString(s.getUserAgentString() + " TareeqApp/1.0");

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(webView, true);

        webView.setWebViewClient(new TareeqWebViewClient());
        webView.setWebChromeClient(new TareeqChromeClient());
    }

    // ------------------------------------------------------------------ web clients

    private class TareeqWebViewClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();

            if (scheme.equals("http") || scheme.equals("https")) {
                String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase();
                boolean isMapsPath = host.endsWith("google.com") && uri.getPath() != null
                        && uri.getPath().startsWith("/maps");
                if (EXTERNAL_HOSTS.contains(host) || isMapsPath) {
                    openExternally(uri);
                    return true;
                }
                return false; // keep the website inside the app
            }

            if (scheme.equals("intent")) {
                try {
                    Intent intent = Intent.parseUri(uri.toString(), Intent.URI_INTENT_SCHEME);
                    startActivity(intent);
                } catch (Exception e) {
                    String fallback = null;
                    try {
                        fallback = Intent.parseUri(uri.toString(), Intent.URI_INTENT_SCHEME)
                                .getStringExtra("browser_fallback_url");
                    } catch (Exception ignored) { }
                    if (fallback != null) view.loadUrl(fallback);
                }
                return true;
            }

            // tel:, mailto:, sms:, geo:, whatsapp: ...
            openExternally(uri);
            return true;
        }

        @Override
        public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
            mainFrameError = false;
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            progressBar.setVisibility(View.GONE);
            if (!mainFrameError) offlineView.setVisibility(View.GONE);
            CookieManager.getInstance().flush();
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (request.isForMainFrame()) {
                mainFrameError = true;
                offlineView.setVisibility(View.VISIBLE);
            }
        }
    }

    private class TareeqChromeClient extends WebChromeClient {
        @Override
        public void onProgressChanged(WebView view, int newProgress) {
            progressBar.setProgress(newProgress);
            progressBar.setVisibility(newProgress < 100 ? View.VISIBLE : View.GONE);
        }

        @Override
        public void onGeolocationPermissionsShowPrompt(String origin,
                                                       GeolocationPermissions.Callback callback) {
            if (hasLocationPermission()) {
                callback.invoke(origin, true, false);
            } else {
                geoOrigin = origin;
                geoCallback = callback;
                locationPermissionLauncher.launch(new String[]{
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION});
            }
        }

        @Override
        public void onPermissionRequest(PermissionRequest request) {
            boolean wantsCamera = Arrays.asList(request.getResources())
                    .contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE);
            if (!wantsCamera) {
                request.deny();
                return;
            }
            if (hasCameraPermission()) {
                request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
            } else {
                pendingWebPermission = request;
                webCameraPermissionLauncher.launch(Manifest.permission.CAMERA);
            }
        }

        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                         FileChooserParams params) {
            if (filePathCallback != null) filePathCallback.onReceiveValue(null);
            filePathCallback = callback;
            pendingChooserParams = params;

            if (hasCameraPermission()) {
                launchFileChooser(true);
            } else {
                uploadCameraPermissionLauncher.launch(Manifest.permission.CAMERA);
            }
            return true;
        }
    }

    // ------------------------------------------------------------------ file upload

    private void launchFileChooser(boolean allowCamera) {
        if (pendingChooserParams == null) {
            deliverFiles(null);
            return;
        }
        WebChromeClient.FileChooserParams params = pendingChooserParams;

        Intent pickIntent;
        try {
            pickIntent = params.createIntent();
        } catch (Exception e) {
            pickIntent = new Intent(Intent.ACTION_GET_CONTENT);
            pickIntent.addCategory(Intent.CATEGORY_OPENABLE);
            pickIntent.setType("image/*");
        }
        if (params.getMode() == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE) {
            pickIntent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        }

        Intent cameraIntent = (allowCamera && acceptsImages(params)) ? buildCameraIntent() : null;

        try {
            if (cameraIntent != null && params.isCaptureEnabled()) {
                // <input capture> — go straight to the camera
                fileChooserLauncher.launch(cameraIntent);
            } else {
                Intent chooser = Intent.createChooser(pickIntent, getString(R.string.choose_photo));
                if (cameraIntent != null) {
                    chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{cameraIntent});
                }
                fileChooserLauncher.launch(chooser);
            }
        } catch (ActivityNotFoundException e) {
            deliverFiles(null);
        }
    }

    private Intent buildCameraIntent() {
        try {
            File dir = new File(getCacheDir(), "images");
            if (!dir.exists() && !dir.mkdirs()) return null;
            cameraImageFile = File.createTempFile("tareeq_", ".jpg", dir);
            cameraImageUri = FileProvider.getUriForFile(
                    this, getPackageName() + ".fileprovider", cameraImageFile);

            Intent cam = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            cam.putExtra(MediaStore.EXTRA_OUTPUT, cameraImageUri);
            int flags = Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION;
            cam.addFlags(flags);

            List<ResolveInfo> cameraApps = getPackageManager()
                    .queryIntentActivities(cam, PackageManager.MATCH_DEFAULT_ONLY);
            if (cameraApps.isEmpty()) return null;
            for (ResolveInfo app : cameraApps) {
                grantUriPermission(app.activityInfo.packageName, cameraImageUri, flags);
            }
            return cam;
        } catch (IOException | IllegalArgumentException e) {
            cameraImageUri = null;
            cameraImageFile = null;
            return null;
        }
    }

    private boolean acceptsImages(WebChromeClient.FileChooserParams params) {
        String[] types = params.getAcceptTypes();
        if (types == null || types.length == 0) return true;
        for (String t : types) {
            if (t == null || t.trim().isEmpty() || t.contains("image") || t.equals("*/*")) {
                return true;
            }
        }
        return false;
    }

    private void deliverFiles(Uri[] uris) {
        if (filePathCallback != null) filePathCallback.onReceiveValue(uris);
        filePathCallback = null;
        pendingChooserParams = null;
    }

    // ------------------------------------------------------------------ helpers

    private void retry() {
        offlineView.setVisibility(View.GONE);
        String current = webView.getUrl();
        if (current == null || current.startsWith("about:") || current.startsWith("data:")) {
            webView.loadUrl(startUrl);
        } else {
            webView.reload();
        }
    }

    private void openExternally(Uri uri) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException ignored) { }
    }

    private boolean hasCameraPermission() {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                == PackageManager.PERMISSION_GRANTED;
    }

    private boolean hasLocationPermission() {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                == PackageManager.PERMISSION_GRANTED
                || ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION)
                == PackageManager.PERMISSION_GRANTED;
    }

    // ------------------------------------------------------------------ lifecycle

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
    }

    @Override
    protected void onPause() {
        webView.onPause();
        CookieManager.getInstance().flush();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        webView.destroy();
        super.onDestroy();
    }
}
