package com.nova.ai

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.webkit.JavascriptInterface

/**
 * NovaBridge allows the React Web App to communicate with the Native Android layer via Kotlin.
 */
class NovaBridge(private val context: Context) {

    /**
     * Call this from React: window.NovaNative.makeCall("+8801751167288")
     */
    @JavascriptInterface
    fun makeCall(phoneNumber: String) {
        val uri = Uri.fromParts("tel", phoneNumber, null)
        val intent = Intent(Intent.ACTION_CALL, uri).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        context.startActivity(intent)
    }

    /**
     * Call this from React: window.NovaNative.requestDefault()
     */
    @JavascriptInterface
    fun requestDefault() {
        NovaTelecomManagerHelper.requestDefaultDialer(context)
    }

    /**
     * Call this from React: window.NovaNative.getInstalledApps()
     */
    @JavascriptInterface
    fun getInstalledApps(): String {
        return "[{\"name\":\"WhatsApp\",\"pkg\":\"com.whatsapp\",\"enabled\":true},{\"name\":\"Facebook\",\"pkg\":\"com.facebook.katana\",\"enabled\":true}]"
    }

    /**
     * Call this from React: window.NovaNative.togglePermission("com.whatsapp", "camera", true)
     */
    @JavascriptInterface
    fun togglePermission(pkgName: String, permission: String, active: Boolean) {
        val intent = Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
            data = Uri.parse("package:$pkgName")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        context.startActivity(intent)
    }
}
