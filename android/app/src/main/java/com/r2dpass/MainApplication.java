package com.r2dpass;

import android.app.Application;

import com.facebook.react.PackageList;
import com.facebook.react.ReactApplication;
import com.facebook.react.ReactNativeHost;
import com.facebook.react.ReactPackage;
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint;
import com.facebook.react.defaults.DefaultReactNativeHost;
import com.facebook.react.soloader.OpenSourceMergedSoMapping;
import com.facebook.soloader.SoLoader;

import com.r2dpass.security.R2dSecurityPackage;

import java.util.List;

public class MainApplication extends Application implements ReactApplication {

    private final ReactNativeHost mReactNativeHost = new DefaultReactNativeHost(this) {

        @Override
        public boolean getUseDeveloperSupport() {
            return BuildConfig.DEBUG;
        }

        @Override
        protected List<ReactPackage> getPackages() {
            List<ReactPackage> packages =
                    new PackageList(this).getPackages();

            // Keep the existing custom native security module.
            packages.add(new R2dSecurityPackage());

            return packages;
        }

        @Override
        protected String getJSMainModuleName() {
            return "index";
        }

        @Override
        protected boolean isNewArchEnabled() {
            return BuildConfig.IS_NEW_ARCHITECTURE_ENABLED;
        }

        @Override
        protected Boolean isHermesEnabled() {
            return BuildConfig.IS_HERMES_ENABLED;
        }
    };

    @Override
    public ReactNativeHost getReactNativeHost() {
        return mReactNativeHost;
    }

    @Override
    public void onCreate() {
        super.onCreate();

        // React Native 0.79 merges libreact_featureflagsjni (and most other RN
        // native libs) into libreactnative.so. SoLoader must be initialised with
        // OpenSourceMergedSoMapping so these libs are resolved from the merged
        // library. From Java the Kotlin object must be referenced via INSTANCE.
        try {
            SoLoader.init(this, OpenSourceMergedSoMapping.INSTANCE);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }

        if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
            DefaultNewArchitectureEntryPoint.load();
        }
    }
}
