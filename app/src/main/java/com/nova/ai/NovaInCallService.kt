package com.nova.ai

import android.telecom.Call
import android.telecom.InCallService
import android.util.Log

/**
 * NovaInCallService allows the app to handle active phone calls natively in Kotlin.
 * This service is registered as the Default Dialer.
 */
class NovaInCallService : InCallService() {

    companion object {
        private const val TAG = "NovaInCallService"
    }

    override fun onCallAdded(call: Call) {
        super.onCallAdded(call)
        Log.d(TAG, "New Call Added: ${call.details?.handle}")

        // Listen for state changes (Ringing, Connected, Disconnected)
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
