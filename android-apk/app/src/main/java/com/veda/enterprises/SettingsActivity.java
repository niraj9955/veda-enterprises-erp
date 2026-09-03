package com.veda.enterprises;

import android.content.SharedPreferences;
import android.os.Bundle;
import android.text.TextUtils;
import android.widget.Button;
import android.widget.EditText;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

public class SettingsActivity extends AppCompatActivity {

    private static final String PREFS_NAME = "veda_prefs";
    private static final String KEY_URL = "server_url";

    private EditText etUrl;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_settings);

        etUrl = findViewById(R.id.etUrl);
        Button btnSave = findViewById(R.id.btnSave);
        Button btnCancel = findViewById(R.id.btnCancel);

        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        String currentUrl = prefs.getString(KEY_URL, getString(R.string.defaultUrl));
        etUrl.setText(currentUrl);

        btnSave.setOnClickListener(v -> {
            String url = etUrl.getText().toString().trim();
            if (TextUtils.isEmpty(url)) {
                Toast.makeText(this, "कृपया URL दर्ज करें", Toast.LENGTH_SHORT).show();
                return;
            }
            if (!url.startsWith("http://") && !url.startsWith("https://")) {
                url = "http://" + url;
            }
            SharedPreferences.Editor editor = prefs.edit();
            editor.putString(KEY_URL, url);
            editor.apply();
            Toast.makeText(this, "URL सहेजा गया। ऐप रीस्टार्ट हो रहा है...", Toast.LENGTH_SHORT).show();
            // Restart MainActivity to apply new URL
            android.os.Process.killProcess(android.os.Process.myPid());
        });

        btnCancel.setOnClickListener(v -> finish());
    }
}
