package com.nova.ai;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.telecom.TelecomManager;
import android.webkit.JavascriptInterface;
import static android.content.Context.TELECOM_SERVICE;

/**
 * NovaBridge allows the React Web App to communicate with the Native Android layer.
 */
public class NovaBridge {
    private Context mContext;

    public NovaBridge(Context context) {
        this.mContext = context;
    }

    /**
     * Call this from React: window.NovaNative.makeCall("+8801751167288")
     */
    @JavascriptInterface
    public void makeCall(String phoneNumber) {
        TelecomManager telecomManager = (TelecomManager) mContext.getSystemService(TELECOM_SERVICE);
        Uri uri = Uri.fromParts("tel", phoneNumber, null);
        
        // Since Nova is the default dialer, this will use Nova's InCallService
        Intent intent = new Intent(Intent.ACTION_CALL, uri);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        mContext.startActivity(intent);
    }

    /**
     * Call this from React: window.NovaNative.requestDefault()
     */
    @JavascriptInterface
    public void requestDefault() {
        NovaTelecomManagerHelper.requestDefaultDialer(mContext);
    }
}
