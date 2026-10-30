package io.github.lieen111.suisui

import android.Manifest
import android.annotation.SuppressLint
import android.app.KeyguardManager
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewAssetLoader
import org.json.JSONObject

/**
 * Hosts the bundled web app (../app) in a WebView and connects it to native features through the
 * `SuiSuiAndroid` JavaScript bridge. MainActivity is the normal app; LockActivity shows the same page
 * in lock mode on top of the system lock screen.
 */
open class WebHostActivity : ComponentActivity() {
    protected lateinit var web: WebView
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var pendingExport: String? = null

    /** Lock mode: full-screen lock view over the keyguard, no system-bar padding. */
    protected open val lockMode = false
    protected open val startPath = "index.html"

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

    private val askNotifications = registerForActivityResult(ActivityResultContracts.RequestPermission()) {
        LockCard.update(this)
        js("window.suisuiAndroidPermission && window.suisuiAndroidPermission(${LockCard.notificationsAllowed(this)})")
    }

    protected open fun configureWindow() {}

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        configureWindow()
        WindowCompat.setDecorFitsSystemWindows(window, false)
        // The phone's own wallpaper shows through (themes.xml: windowShowWallpaper), so everything here is
        // transparent; the page paints its own background and leaves holes where the wallpaper should show.
        val root = FrameLayout(this)
        web = WebView(this)
        web.setBackgroundColor(Color.TRANSPARENT)
        root.addView(web, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
        setContentView(root)
        if (!lockMode) {
            // Opaque strips behind the status and navigation bars; the web view sits between them.
            val canvas = 0xFFFAFBFA.toInt()
            val top = View(this).apply { setBackgroundColor(canvas) }
            val bottom = View(this).apply { setBackgroundColor(canvas) }
            root.addView(top, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, 0, Gravity.TOP))
            root.addView(bottom, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, 0, Gravity.BOTTOM))
            ViewCompat.setOnApplyWindowInsetsListener(root) { _, insets ->
                val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
                val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
                val below = maxOf(bars.bottom, ime.bottom)
                top.layoutParams = (top.layoutParams as FrameLayout.LayoutParams).apply { height = bars.top }
                bottom.layoutParams = (bottom.layoutParams as FrameLayout.LayoutParams).apply { height = below }
                web.layoutParams = (web.layoutParams as FrameLayout.LayoutParams).apply { setMargins(bars.left, bars.top, bars.right, below) }
                insets
            }
            // Back closes the open sheet / settings page first (handled by the page), then leaves the app.
            onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    web.evaluateJavascript("(window.suisuiBack && window.suisuiBack()) ? 1 : 0") { handled ->
                        if (handled != "1") { isEnabled = false; onBackPressedDispatcher.onBackPressed(); isEnabled = true }
                    }
                }
            })
        }
        WindowCompat.getInsetsController(window, root).apply {
            isAppearanceLightStatusBars = !lockMode
            isAppearanceLightNavigationBars = !lockMode
        }

        val assets = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = true
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
        web.loadUrl("https://appassets.androidplatform.net/assets/$startPath")
    }

    override fun onResume() {
        super.onResume()
        TodoStore.onChange = { js("window.suisuiNativeChanged && window.suisuiNativeChanged()") }
        LockCard.update(this)
        js("window.suisuiNativeChanged && window.suisuiNativeChanged(); window.suisuiAndroidResume && window.suisuiAndroidResume()")
    }

    override fun onPause() {
        TodoStore.onChange = null
        super.onPause()
    }

    protected fun js(code: String) {
        if (::web.isInitialized) web.post { web.evaluateJavascript(code, null) }
    }

    protected fun requestNotificationsIfNeeded() {
        if (Build.VERSION.SDK_INT >= 33 && !LockCard.permissionGranted(this)) {
            askNotifications.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    /** Leave the lock view: ask the system to dismiss the keyguard (PIN / fingerprint / face), then close. */
    protected fun leaveLock(openApp: Boolean) {
        val done = {
            if (openApp) startActivity(Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            finish()
        }
        val km = getSystemService(KeyguardManager::class.java)
        if (km != null && km.isKeyguardLocked) {
            km.requestDismissKeyguard(this, object : KeyguardManager.KeyguardDismissCallback() {
                override fun onDismissSucceeded() { done() }
                override fun onDismissCancelled() { /* stay on the lock view */ }
                override fun onDismissError() { finish() }
            })
        } else done()
    }

    /** Methods called from app.js. They run on a background thread; UI work is posted to the main thread. */
    inner class Bridge {
        private val ctx get() = this@WebHostActivity

        @JavascriptInterface
        fun load(): String = TodoStore.read(ctx) ?: ""

        @JavascriptInterface
        fun save(json: String) {
            if (runCatching { JSONObject(json) }.isFailure) return
            TodoStore.write(ctx, json)
            LockCard.update(ctx)
        }

        @JavascriptInterface
        fun isLockMode(): Boolean = lockMode

        @JavascriptInterface
        fun notificationsAllowed(): Boolean = LockCard.notificationsAllowed(ctx)

        @JavascriptInterface
        fun permissions(): String = JSONObject()
            .put("notifications", LockCard.notificationsAllowed(ctx))
            .put("overlay", Settings.canDrawOverlays(ctx))
            .put("lockScreenRunning", ScreenService.running)
            .put("brand", (Build.MANUFACTURER ?: "").lowercase())
            .toString()

        @JavascriptInterface
        fun requestNotificationPermission() {
            runOnUiThread {
                if (Build.VERSION.SDK_INT >= 33 && !LockCard.permissionGranted(ctx)) {
                    askNotifications.launch(Manifest.permission.POST_NOTIFICATIONS)
                } else {
                    if (!LockCard.notificationsAllowed(ctx)) openNotificationSettings()
                    js("window.suisuiAndroidPermission && window.suisuiAndroidPermission(${LockCard.notificationsAllowed(ctx)})")
                }
            }
        }

        @JavascriptInterface
        fun openNotificationSettings() {
            runOnUiThread {
                runCatching { startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, packageName)) }
            }
        }

        /** "显示在其他应用上层": lets the app put its lock view in front when the screen turns off. */
        @JavascriptInterface
        fun openOverlaySettings() {
            runOnUiThread {
                runCatching { startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName"))) }
            }
        }

        /** Brand permission pages ("锁屏显示", "后台弹出界面"), falling back to the app details page. */
        @JavascriptInterface
        fun openAppPermissions() {
            runOnUiThread {
                val miui = Intent("miui.intent.action.APP_PERM_EDITOR").putExtra("extra_pkgname", packageName)
                val details = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$packageName"))
                if (runCatching { startActivity(miui) }.isFailure) runCatching { startActivity(details) }
            }
        }

        @JavascriptInterface
        fun unlock(openApp: Boolean) {
            runOnUiThread { if (lockMode) leaveLock(openApp) }
        }

        @JavascriptInterface
        fun exportBackup(json: String, fileName: String) {
            pendingExport = json
            runOnUiThread { createDocument.launch(fileName) }
        }

        /** The window shows the phone's wallpaper behind the page (themes.xml). */
        @JavascriptInterface
        fun hasSystemWallpaper(): Boolean = true

        @JavascriptInterface
        fun version(): String = runCatching { packageManager.getPackageInfo(packageName, 0).versionName ?: "" }.getOrDefault("")
    }
}

class MainActivity : WebHostActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // The lock-screen card needs notification permission; ask on first launch (Android 13+).
        requestNotificationsIfNeeded()
    }
}

/** Shown over the system lock screen when the screen turns off, so waking the phone shows 碎碎清单. */
class LockActivity : WebHostActivity() {
    override val lockMode = true
    override val startPath = "index.html?mode=lock"

    override fun configureWindow() {
        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED)
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        js("window.suisuiNativeChanged && window.suisuiNativeChanged(); window.suisuiLockShown && window.suisuiLockShown()")
    }
}
