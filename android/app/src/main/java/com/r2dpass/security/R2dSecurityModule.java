package com.r2dpass.security;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Base64;
import androidx.annotation.NonNull;
import com.facebook.react.bridge.*;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.security.SecureRandom;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;

public class R2dSecurityModule extends ReactContextBaseJavaModule {
    private static final String PREFS = "r2dpass_secure_store";
    private static final String DATA = "vault_blob";
    private static final String KEY_ALIAS = "r2dpass_wrapping_key";
    private static final int ITERATIONS = 600000;
    private static final int KEY_BITS = 256;
    private final SharedPreferences prefs;

    public R2dSecurityModule(ReactApplicationContext context) {
        super(context);
        prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
    @NonNull @Override public String getName() { return "R2dSecurity"; }

    private byte[] derive(String password, byte[] salt) throws Exception {
        PBEKeySpec spec = new PBEKeySpec(password.toCharArray(), salt, ITERATIONS, KEY_BITS);
        try { return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded(); }
        finally { spec.clearPassword(); }
    }
    private String enc(byte[] b) { return Base64.encodeToString(b, Base64.NO_WRAP); }
    private byte[] dec(String s) { return Base64.decode(s, Base64.NO_WRAP); }

    private SecretKey wrappingKey() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore"); ks.load(null);
        if (ks.containsAlias(KEY_ALIAS)) return ((KeyStore.SecretKeyEntry) ks.getEntry(KEY_ALIAS, null)).getSecretKey();
        KeyGenerator kg = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        kg.init(new KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
        return kg.generateKey();
    }

    private String wrap(String raw) throws Exception {
        SecretKey key = wrappingKey(); byte[] iv = new byte[12]; new SecureRandom().nextBytes(iv);
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding"); c.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(128, iv));
        return enc(iv) + "." + enc(c.doFinal(raw.getBytes(StandardCharsets.UTF_8)));
    }
    private String unwrap(String blob) throws Exception {
        String[] p = blob.split("\\.", 2); if (p.length != 2) throw new SecurityException("Invalid vault storage");
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding"); c.init(Cipher.DECRYPT_MODE, wrappingKey(), new GCMParameterSpec(128, dec(p[0])));
        return new String(c.doFinal(dec(p[1])), StandardCharsets.UTF_8);
    }

    @ReactMethod public void hasVault(Promise promise) { promise.resolve(prefs.contains(DATA)); }

    @ReactMethod public void createVault(String password, String payload, Promise promise) {
        try {
            if (password == null || password.length() < 8) { promise.reject("WEAK_PASSWORD", "Master password is too short"); return; }
            SecureRandom random = new SecureRandom(); byte[] salt = new byte[16], iv = new byte[12]; random.nextBytes(salt); random.nextBytes(iv);
            byte[] key = derive(password, salt);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(128, iv));
            byte[] ciphertext = cipher.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            String record = enc(salt) + ":" + enc(key) + ":" + enc(iv) + ":" + enc(ciphertext);
            prefs.edit().putString(DATA, wrap(record)).apply(); promise.resolve(true);
        } catch (Exception e) { promise.reject("CREATE_VAULT_ERROR", e.getMessage(), e); }
    }

    @ReactMethod public void saveVault(String payload, Promise promise) {
        try {
            String existing = unwrap(prefs.getString(DATA, "")); String[] parts = existing.split(":", 4);
            if (parts.length != 4) throw new SecurityException("Invalid vault");
            byte[] salt = dec(parts[0]), key = dec(parts[1]), iv = new byte[12]; new SecureRandom().nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(128, iv));
            byte[] ciphertext = cipher.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            prefs.edit().putString(DATA, wrap(enc(salt)+":"+enc(key)+":"+enc(iv)+":"+enc(ciphertext))).apply(); promise.resolve(true);
        } catch (Exception e) { promise.reject("SAVE_VAULT_ERROR", e.getMessage(), e); }
    }

    @ReactMethod public void unlockVault(String password, Promise promise) {
        try {
            String raw = unwrap(prefs.getString(DATA, "")); String[] parts = raw.split(":", 4);
            if (parts.length != 4) throw new SecurityException("Invalid vault");
            byte[] salt = dec(parts[0]), expectedKey = dec(parts[1]);
            byte[] key = derive(password, salt);
            if (!MessageDigest.isEqual(key, expectedKey)) { promise.reject("INVALID_PASSWORD", "Incorrect master password"); return; }
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(128, dec(parts[2])));
            promise.resolve(new String(cipher.doFinal(dec(parts[3])), StandardCharsets.UTF_8));
        } catch (Exception e) { promise.reject("UNLOCK_ERROR", "Unable to unlock vault"); }
    }
}
