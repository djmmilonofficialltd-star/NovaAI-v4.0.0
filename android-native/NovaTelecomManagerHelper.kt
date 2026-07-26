package com.nova.ai

import android.content.Context
import android.content.Intent
import android.telecom.TelecomManager
import android.util.Log

/**
 * Helper class written in Kotlin to request Nova to become the Default Dialer.
 */
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
