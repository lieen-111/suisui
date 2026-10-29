package io.github.lieen111.suisui

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewAssetLoader
import org.json.JSONObject

/**
 * Hosts the existing web app (bundled from ../app) in a WebView and connects it to the native
 * lock-screen card through the `SuiSuiAndroid` JavaScript bridge.
 */
class MainActivity : ComponentActivity() {
    private lateinit var web: WebView
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var pendingExport: String? = null

    private val pickFiles = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        fileCallback?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data))
        fileCallback = null
    }

    private val createDocument = registerForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri ->
        val data = pendingExport
        var ok = false
        if (uri != null && data != null) {
            ok = runCatching { contentResolver.openOutputStream(uri)?.use { it.write(data.toByteArray()) } != null }.getOrDefault(false)
        }
        pendingExport = null
        js("window.suisuiExportDone && window.suisuiExportDone($ok)")
    }

    private val askNotifications = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        LockCard.update(this)
        js("window.suisuiAndroidPermission && window.suisuiAndroidPermission(${granted && LockCard.notificationsAllowed(this)})")
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        val root = FrameLayout(this)
        root.setBackgroundColor(0xFFFAFBFA.toInt())
        web = WebView(this)
        root.addView(web, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
        setContentView(root)
        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime())
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            insets
        }
        WindowCompat.getInsetsController(window, root).apply {
            isAppearanceLightStatusBars = true
            isAppearanceLightNavigationBars = true
        }

        val assets = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = true
            mediaPlaybackRequiresUserGesture = true
        }
        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                assets.shouldInterceptRequest(request.url)

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                if (request.url.host == "appassets.androidplatform.net") return false
                runCatching { startActivity(Intent(Intent.ACTION_VIEW, request.url)) }
                return true
            }
        }
        web.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(view: WebView, callback: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean {
                fileCallback?.onReceiveValue(null)
                fileCallback = callback
                return runCatching { pickFiles.launch(params.createIntent()); true }.getOrElse {
                    fileCallback = null
                    false
                }
            }
        }
        web.addJavascriptInterface(Bridge(), "SuiSuiAndroid")
        if (savedInstanceState == null) web.loadUrl("https://appassets.androidplatform.net/assets/index.html")
        else web.restoreState(savedInstanceState)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    override fun onResume() {
        super.onResume()
        TodoStore.onChange = { js("window.suisuiNativeChanged && window.suisuiNativeChanged()") }
        LockCard.update(this)
        js("window.suisuiNativeChanged && window.suisuiNativeChanged()")
    }

    override fun onPause() {
        TodoStore.onChange = null
        super.onPause()
    }

    private fun js(code: String) {
        if (::web.isInitialized) web.post { web.evaluateJavascript(code, null) }
    }

    /** Methods called from app.js. They run on a background thread; UI work is posted to the main thread. */
    inner class Bridge {
        @JavascriptInterface
        fun load(): String = TodoStore.read(this@MainActivity) ?: ""

        @JavascriptInterface
        fun save(json: String) {
            // Validate before overwriting what the lock-screen card reads.
            if (runCatching { JSONObject(json) }.isFailure) return
            TodoStore.write(this@MainActivity, json)
            LockCard.update(this@MainActivity)
        }

        @JavascriptInterface
        fun notificationsAllowed(): Boolean = LockCard.notificationsAllowed(this@MainActivity)

        @JavascriptInterface
        fun requestNotificationPermission() {
            runOnUiThread {
                if (Build.VERSION.SDK_INT >= 33 && !LockCard.permissionGranted(this@MainActivity)) {
                    askNotifications.launch(Manifest.permission.POST_NOTIFICATIONS)
                } else {
                    if (!LockCard.notificationsAllowed(this@MainActivity)) openNotificationSettings()
                    js("window.suisuiAndroidPermission && window.suisuiAndroidPermission(${LockCard.notificationsAllowed(this@MainActivity)})")
                }
            }
        }

        @JavascriptInterface
        fun openNotificationSettings() {
            runOnUiThread {
                runCatching {
                    startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, packageName))
                }
            }
        }

        @JavascriptInterface
        fun exportBackup(json: String, fileName: String) {
            pendingExport = json
            runOnUiThread { createDocument.launch(fileName) }
        }

        @JavascriptInterface
        fun version(): String = runCatching { packageManager.getPackageInfo(packageName, 0).versionName ?: "" }.getOrDefault("")
    }
}
