package io.zibloo.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ZiblooAlarmsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
