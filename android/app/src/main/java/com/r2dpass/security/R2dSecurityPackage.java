package com.r2dpass.security;
import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
public class R2dSecurityPackage implements ReactPackage {
    @Override public List<NativeModule> createNativeModules(ReactApplicationContext c) { return Collections.<NativeModule>singletonList(new R2dSecurityModule(c)); }
    @Override public List<ViewManager> createViewManagers(ReactApplicationContext c) { return new ArrayList<>(); }
}
