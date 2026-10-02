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

    @NonNull
    @Override
    public String getName() { return "R2dSecurity"; }

    private byte[] derive(String password, byte[] salt) throws Exception {
        if (password == null) throw new IllegalArgumentException("Password is null");
        if (salt == null || salt.length == 0) throw new SecurityException("Invalid salt");
        PBEKeySpec spec = new PBEKeySpec(password.toCharArray(), salt, ITERATIONS, KEY_BITS);
        try {
            return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
                    .generateSecret(spec).getEncoded();
        } finally {
            spec.clearPassword();
        }
    }

    private String enc(byte[] b) { return Base64.encodeToString(b, Base64.NO_WRAP); }

    private byte[] dec(String s) {
        if (s == null || s.isEmpty()) throw new IllegalArgumentException("Invalid encoded data");
        return Base64.decode(s, Base64.NO_WRAP);
    }

    private SecretKey wrappingKey() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);

        if (ks.containsAlias(KEY_ALIAS)) {
            KeyStore.Entry entry = ks.getEntry(KEY_ALIAS, null);
            if (!(entry instanceof KeyStore.SecretKeyEntry)) {
                ks.deleteEntry(KEY_ALIAS);
            } else {
                return ((KeyStore.SecretKeyEntry) entry).getSecretKey();
            }
        }

        KeyGenerator kg = KeyGenerator.getInstance(
                KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        kg.init(new KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .build());

        return kg.generateKey();
    }

    private String wrap(String raw) throws Exception {
        if (raw == null) throw new IllegalArgumentException("Empty vault data");
        SecretKey key = wrappingKey();
        byte[] iv = new byte[12];
        new SecureRandom().nextBytes(iv);
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(128, iv));
        return enc(iv) + "." + enc(c.doFinal(raw.getBytes(StandardCharsets.UTF_8)));
    }

    private String unwrap(String blob) throws Exception {
        if (blob == null || blob.trim().isEmpty()) throw new SecurityException("Vault storage is empty");
        String[] p = blob.split("\\.", 2);
        if (p.length != 2) throw new SecurityException("Invalid vault storage");
        byte[] iv = dec(p[0]);
        if (iv.length != 12) throw new SecurityException("Invalid vault IV");
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.DECRYPT_MODE, wrappingKey(), new GCMParameterSpec(128, iv));
        return new String(c.doFinal(dec(p[1])), StandardCharsets.UTF_8);
    }

    @ReactMethod
    public void hasVault(Promise promise) {
        try {
            promise.resolve(prefs.contains(DATA) &&
                    prefs.getString(DATA, "").trim().length() > 0);
        } catch (Exception e) {
            promise.reject("HAS_VAULT_ERROR", "Unable to inspect vault", e);
        }
    }

    @ReactMethod
    public void randomPassword(int length, boolean upper, boolean lower, boolean numbers, boolean symbols, Promise promise) {
        try {
            if (length < 4 || length > 128) throw new IllegalArgumentException("Invalid password length");
            StringBuilder pool = new StringBuilder();
            if (upper) pool.append("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
            if (lower) pool.append("abcdefghijklmnopqrstuvwxyz");
            if (numbers) pool.append("0123456789");
            if (symbols) pool.append("!@#$%^&*()-_=+[]{}?");
            if (pool.length() == 0) throw new IllegalArgumentException("Select at least one character set");
            SecureRandom random = new SecureRandom();
            StringBuilder out = new StringBuilder(length);
            for (int i = 0; i < length; i++) out.append(pool.charAt(random.nextInt(pool.length())));
            promise.resolve(out.toString());
        } catch (Exception e) {
            promise.reject("PASSWORD_GENERATION_ERROR",
                    e.getMessage() == null ? "Unable to generate password" : e.getMessage(), e);
        }
    }

    @ReactMethod
    public void createVault(String password, String payload, Promise promise) {
        try {
            if (password == null || password.length() < 8) {
                promise.reject("WEAK_PASSWORD", "Master password is too short");
                return;
            }
            if (payload == null) {
                promise.reject("INVALID_PAYLOAD", "Vault payload is empty");
                return;
            }
            SecureRandom random = new SecureRandom();
            byte[] salt = new byte[16], iv = new byte[12];
            random.nextBytes(salt); random.nextBytes(iv);
            byte[] key = derive(password, salt);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(128, iv));
            byte[] ciphertext = cipher.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            String record = enc(salt) + ":" + enc(key) + ":" + enc(iv) + ":" + enc(ciphertext);
            prefs.edit().putString(DATA, wrap(record)).apply();
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("CREATE_VAULT_ERROR",
                    e.getMessage() == null ? "Unable to create vault" : e.getMessage(), e);
        }
    }

    @ReactMethod
    public void saveVault(String payload, Promise promise) {
        try {
            if (payload == null) {
                promise.reject("INVALID_PAYLOAD", "Vault payload is empty");
                return;
            }
            String existing = unwrap(prefs.getString(DATA, ""));
            String[] parts = existing.split(":", 4);
            if (parts.length != 4) throw new SecurityException("Invalid vault");
            byte[] salt = dec(parts[0]), key = dec(parts[1]);
            if (salt.length == 0 || key.length != KEY_BITS / 8) throw new SecurityException("Invalid vault key data");
            byte[] iv = new byte[12];
            new SecureRandom().nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(128, iv));
            byte[] ciphertext = cipher.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            String record = enc(salt) + ":" + enc(key) + ":" + enc(iv) + ":" + enc(ciphertext);
            prefs.edit().putString(DATA, wrap(record)).apply();
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("SAVE_VAULT_ERROR",
                    e.getMessage() == null ? "Unable to save vault" : e.getMessage(), e);
        }
    }

    @ReactMethod
    public void unlockVault(String password, Promise promise) {
        try {
            if (password == null || password.isEmpty()) {
                promise.reject("INVALID_PASSWORD", "Password is empty");
                return;
            }
            String raw = unwrap(prefs.getString(DATA, ""));
            String[] parts = raw.split(":", 4);
            if (parts.length != 4) throw new SecurityException("Invalid vault");
            byte[] salt = dec(parts[0]), expectedKey = dec(parts[1]);
            if (salt.length == 0 || expectedKey.length != KEY_BITS / 8) throw new SecurityException("Invalid vault key data");
            byte[] key = derive(password, salt);
            if (!MessageDigest.isEqual(key, expectedKey)) {
                promise.reject("INVALID_PASSWORD", "Incorrect master password");
                return;
            }
            byte[] iv = dec(parts[2]);
            if (iv.length != 12) throw new SecurityException("Invalid vault IV");
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(128, iv));
            String payload = new String(cipher.doFinal(dec(parts[3])), StandardCharsets.UTF_8);
            if (payload.trim().isEmpty()) throw new SecurityException("Empty vault payload");
            promise.resolve(payload);
        } catch (Exception e) {
            promise.reject("UNLOCK_ERROR", "Unable to unlock vault", e);
        }
    }
}
