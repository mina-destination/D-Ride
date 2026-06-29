package com.dride.driver;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.dride.driver.plugins.backgroundlocation.BackgroundLocationPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(BackgroundLocationPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
