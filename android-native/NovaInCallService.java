package com.nova.ai;

import android.telecom.Call;
import android.telecom.InCallService;
import android.util.Log;

/**
 * NovaInCallService allows the app to handle active calls.
 * This service is required to be the Default Dialer.
 */
public class NovaInCallService extends InCallService {
    private static final String TAG = "NovaInCallService";

    @Override
    public void onCallAdded(Call call) {
        super.onCallAdded(call);
        Log.d(TAG, "New Call Added: " + call.getDetails().getHandle());
        
        // Listen for state changes (Ringing, Connected, etc.)
        call.registerCallback(new Call.Callback() {
            @Override
            public void onStateChanged(Call call, int state) {
                super.onStateChanged(call, state);
                Log.d(TAG, "Call State Changed: " + state);
            }
        });

        // To answer a call:
        // call.answer(android.telecom.VideoProfile.STATE_AUDIO_ONLY);
        
        // To reject/end a call:
        // call.disconnect();
    }

    @Override
    public void onCallRemoved(Call call) {
        super.onCallRemoved(call);
        Log.d(TAG, "Call Removed");
    }
}
