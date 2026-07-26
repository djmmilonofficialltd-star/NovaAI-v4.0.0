package com.nova.ai;

import android.content.Context;
import android.content.Intent;
import android.telecom.TelecomManager;
import android.util.Log;
import static android.content.Context.TELECOM_SERVICE;

/**
 * Helper class to request Nova to become the Default Dialer.
 */
public class NovaTelecomManagerHelper {
    private static final String TAG = "NovaTelecomManager";

    public static void requestDefaultDialer(Context context) {
        TelecomManager telecomManager = (TelecomManager) context.getSystemService(TELECOM_SERVICE);
        String packageName = context.getPackageName();

        // Check if Nova is already the default dialer
        if (!packageName.equals(telecomManager.getDefaultDialerPackage())) {
            Log.d(TAG, "Requesting to become Default Dialer");
            Intent intent = new Intent(TelecomManager.ACTION_CHANGE_DEFAULT_DIALER);
            intent.putExtra(TelecomManager.EXTRA_CHANGE_DEFAULT_DIALER_PACKAGE_NAME, packageName);
            context.startActivity(intent);
        } else {
            Log.d(TAG, "Nova is already the Default Dialer");
        }
    }
}
