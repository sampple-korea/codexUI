package com.codex.mobile;

import android.app.Activity;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public final class MainActivity extends Activity {
    private static final String LOCALHOST_URL = "http://127.0.0.1:18923";
    private static final String FALLBACK_URL = "file:///android_asset/fallback/index.html";

    private boolean fallbackLoaded;
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        webView.setLayoutParams(new ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ));
        webView.setBackgroundColor(Color.BLACK);
        configure(webView);

        setContentView(webView);
        webView.loadUrl(LOCALHOST_URL);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    private void configure(WebView view) {
        WebSettings settings = view.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setDatabaseEnabled(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        }

        view.setWebViewClient(new WebViewClient() {
            @Override
            public void onReceivedError(
                WebView webView,
                WebResourceRequest request,
                WebResourceError error
            ) {
                if (request == null || request.isForMainFrame()) {
                    loadFallback(webView);
                }
            }
        });
    }

    private void loadFallback(WebView view) {
        if (fallbackLoaded) {
            return;
        }
        fallbackLoaded = true;
        view.loadUrl(FALLBACK_URL);
    }
}
