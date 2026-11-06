package studio.pricop.pricopbum;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        attachStore();
    }

    @Override
    public void onStart() {
        super.onStart();
        attachStore();
    }

    private void attachStore() {
        if (getBridge() == null || getBridge().getWebView() == null) return;
        WebView webView = getBridge().getWebView();
        webView.addJavascriptInterface(new PbStore(this), "pbStore");
    }

    public static class PbStore {
        private final SharedPreferences prefs;
        PbStore(Context context) {
            prefs = context.getSharedPreferences("pricopbum", Context.MODE_PRIVATE);
        }
        @JavascriptInterface
        public void set(String key, String value) {
            if (key == null) return;
            if (value == null || value.isEmpty()) prefs.edit().remove(key).commit();
            else prefs.edit().putString(key, value).commit();
        }
        @JavascriptInterface
        public String get(String key) {
            if (key == null) return "";
            String v = prefs.getString(key, "");
            return v == null ? "" : v;
        }
    }
}
