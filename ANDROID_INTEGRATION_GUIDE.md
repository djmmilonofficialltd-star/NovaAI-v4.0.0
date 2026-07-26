# Nova AI Cyber - Complete Kotlin / Android Studio Integration Guide

This project contains full Kotlin native code and configuration files to build **Nova AI Cyber** inside Android Studio using Kotlin.

---

## 📁 Android Studio Project Structure

To open or export into Android Studio, organize your project files as follows:

```
NovaAICyber/
├── app/
│   ├── build.gradle.kts
│   └── src/
│       └── main/
│           ├── AndroidManifest.xml
│           ├── assets/                  <-- Paste web build (dist/*) here
│           │   └── index.html
│           ├── java/com/nova/ai/        <-- All Kotlin Source Code
│           │   ├── MainActivity.kt
│           │   ├── NovaBridge.kt
│           │   ├── NovaInCallService.kt
│           │   └── NovaTelecomManagerHelper.kt
│           └── res/layout/
│               └── activity_main.xml
├── build.gradle.kts
└── settings.gradle.kts
```

---

## 1. Kotlin MainActivity (`MainActivity.kt`)
**Location:** `app/src/main/java/com/nova/ai/MainActivity.kt`

```kotlin
package com.nova.ai

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {

    private lateinit var myWebView: WebView
    private val PERMISSION_REQUEST_CODE = 1234

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        myWebView = findViewById(R.id.webview)
        val webSettings: WebSettings = myWebView.settings

        webSettings.javaScriptEnabled = true
        webSettings.domStorageEnabled = true
        webSettings.allowFileAccess = true
        webSettings.allowContentAccess = true
        webSettings.mediaPlaybackRequiresUserGesture = false

        myWebView.webViewClient = WebViewClient()

        // Enable Javascript interface bridge for Native Android features
        myWebView.addJavascriptInterface(NovaBridge(this), "NovaNative")

        myWebView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    request.grant(request.resources)
                }
            }
        }

        // Loads the React web bundle compiled into Android assets
        myWebView.loadUrl("file:///android_asset/index.html")
        checkPermissions()
    }

    private fun checkPermissions() {
        val permissions = arrayOf(
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.CAMERA,
            Manifest.permission.INTERNET,
            Manifest.permission.CALL_PHONE,
            Manifest.permission.READ_PHONE_STATE,
            Manifest.permission.READ_CONTACTS
        )
        val missingPermissions = permissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missingPermissions.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, missingPermissions.toTypedArray(), PERMISSION_REQUEST_CODE)
        }
    }

    @Deprecated("Deprecated in Java/Android")
    override fun onBackPressed() {
        if (myWebView.canGoBack()) {
            myWebView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
```

---

## 2. Kotlin Native Bridge (`NovaBridge.kt`)
**Location:** `app/src/main/java/com/nova/ai/NovaBridge.kt`

```kotlin
package com.nova.ai

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.webkit.JavascriptInterface

class NovaBridge(private val context: Context) {

    @JavascriptInterface
    fun makeCall(phoneNumber: String) {
        val uri = Uri.fromParts("tel", phoneNumber, null)
        val intent = Intent(Intent.ACTION_CALL, uri).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        context.startActivity(intent)
    }

    @JavascriptInterface
    fun requestDefault() {
        NovaTelecomManagerHelper.requestDefaultDialer(context)
    }

    @JavascriptInterface
    fun getInstalledApps(): String {
        return "[{\"name\":\"WhatsApp\",\"pkg\":\"com.whatsapp\",\"enabled\":true},{\"name\":\"Facebook\",\"pkg\":\"com.facebook.katana\",\"enabled\":true}]"
    }

    @JavascriptInterface
    fun togglePermission(pkgName: String, permission: String, active: Boolean) {
        val intent = Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
            data = Uri.parse("package:$pkgName")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        context.startActivity(intent)
    }
}
```

---

## 3. Kotlin Telecom Service (`NovaInCallService.kt`)
**Location:** `app/src/main/java/com/nova/ai/NovaInCallService.kt`

```kotlin
package com.nova.ai

import android.telecom.Call
import android.telecom.InCallService
import android.util.Log

class NovaInCallService : InCallService() {

    companion object {
        private const val TAG = "NovaInCallService"
    }

    override fun onCallAdded(call: Call) {
        super.onCallAdded(call)
        Log.d(TAG, "New Call Added: ${call.details?.handle}")

        call.registerCallback(object : Call.Callback() {
            override fun onStateChanged(call: Call, state: Int) {
                super.onStateChanged(call, state)
                Log.d(TAG, "Call State Changed: $state")
            }
        })
    }

    override fun onCallRemoved(call: Call) {
        super.onCallRemoved(call)
        Log.d(TAG, "Call Removed")
    }
}
```

---

## 4. Kotlin Telecom Helper (`NovaTelecomManagerHelper.kt`)
**Location:** `app/src/main/java/com/nova/ai/NovaTelecomManagerHelper.kt`

```kotlin
package com.nova.ai

import android.content.Context
import android.content.Intent
import android.telecom.TelecomManager
import android.util.Log

object NovaTelecomManagerHelper {
    private const val TAG = "NovaTelecomManager"

    fun requestDefaultDialer(context: Context) {
        val telecomManager = context.getSystemService(Context.TELECOM_SERVICE) as TelecomManager
        val packageName = context.packageName

        if (packageName != telecomManager.defaultDialerPackage) {
            Log.d(TAG, "Requesting to become Default Dialer")
            val intent = Intent(TelecomManager.ACTION_CHANGE_DEFAULT_DIALER).apply {
                putExtra(TelecomManager.EXTRA_CHANGE_DEFAULT_DIALER_PACKAGE_NAME, packageName)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
        } else {
            Log.d(TAG, "Nova is already the Default Dialer")
        }
    }
}
```

---

## 5. Gradle Build File (`app/build.gradle.kts`)

```kotlin
plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
}

android {
    namespace = "com.nova.ai"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.nova.aicyber"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("com.google.android.material:material:1.11.0")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")
    implementation("androidx.webkit:webkit:1.10.0")
}
```

---

## 6. Android Manifest (`AndroidManifest.xml`)

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.nova.ai">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.CALL_PHONE" />
    <uses-permission android:name="android.permission.READ_PHONE_STATE" />
    <uses-permission android:name="android.permission.BIND_INCALL_SERVICE" />
    <uses-permission android:name="android.permission.READ_CONTACTS" />

    <application
        android:allowBackup="true"
        android:label="Nova AI Cyber"
        android:supportsRtl="true"
        android:theme="@style/Theme.AppCompat.NoActionBar"
        android:hardwareAccelerated="true">

        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
            <intent-filter>
                <action android:name="android.intent.action.DIAL" />
                <category android:name="android.intent.category.DEFAULT" />
                <data android:scheme="tel" />
            </intent-filter>
        </activity>

        <service
            android:name=".NovaInCallService"
            android:permission="android.permission.BIND_INCALL_SERVICE"
            android:exported="true">
            <meta-data
                android:name="android.telecom.IN_CALL_SERVICE_UI"
                android:value="true" />
            <intent-filter>
                <action android:name="android.telecom.InCallService" />
            </intent-filter>
        </service>
    </application>

</manifest>
```

---

## 🚀 How to Build in Android Studio

1. **Build Web Assets**: Run `npm run build` in the project root.
2. **Copy Web Assets**: Copy all generated files inside `dist/` into `app/src/main/assets/`.
3. **Open in Android Studio**: Open Android Studio -> Select **Open** -> Select the project root.
4. **Sync Gradle**: Click **Sync Project with Gradle Files**.
5. **Run App**: Select your connected phone or emulator and click **Run (Shift + F10)** to generate the APK!
