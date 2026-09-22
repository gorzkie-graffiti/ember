package com.ember.legacy;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.UnsupportedEncodingException;
import java.net.URI;
import java.net.URLEncoder;
import java.util.ArrayList;
import java.util.List;

import org.apache.http.HttpResponse;
import org.apache.http.HttpStatus;
import org.apache.http.client.HttpClient;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.impl.client.DefaultHttpClient;
import org.apache.http.params.BasicHttpParams;
import org.apache.http.params.HttpConnectionParams;
import org.apache.http.params.HttpParams;

import android.app.Activity;
import android.graphics.Typeface;
import android.os.AsyncTask;
import android.os.Bundle;
import android.text.TextUtils;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.EditorInfo;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

/**
 * Ember — legacy client for Android 2.3 (Gingerbread).
 *
 * Target device: Sony Ericsson Xperia X10 Mini Pro (j20i), 240x320.
 *
 * A faithful port of Ember's web UI, reduced to what 2.3 can do:
 *   · Ember's exact palette (see res/values/colors.xml, from globals.css)
 *   · user bubbles right / Ember replies left, rounded like the web cards
 *   · composer pinned to the bottom with a clay Send button
 *   · serif wordmark header on Ember's surface-2 bar
 *
 * Talks to the plain-text GET /v endpoint — no JSON, no SSE.
 *
 * *** SET YOUR SERVER HERE ***
 */
public final class ChatActivity extends Activity {

    /** Ember server base URL, no trailing slash. e.g. "http://192.168.1.10:3000" */
    static final String EMBER_HOST = "https://assurance-formats-values-terminal.trycloudflare.com";

    /** Reply length cap sent to the server (matches /v's default). */
    static final int MAXLEN = 1500;

    /* UI */
    private LinearLayout messageList;
    private ScrollView scroller;
    private EditText input;
    private Button sendButton;
    private TextView status;

    /* Transcript model — bubbles are rebuilt from this on each append. */
    private static final class Msg {
        final String text;
        final boolean fromUser;
        final boolean isError;
        Msg(String text, boolean fromUser, boolean isError) {
            this.text = text;
            this.fromUser = fromUser;
            this.isError = isError;
        }
    }

    private final List<Msg> transcript = new ArrayList<Msg>();
    private AsyncTask<String, Void, String> inFlight;

    /* HttpClient with Ember-appropriate timeouts (2.3 radios are slow). */
    private final HttpClient httpClient = newHttpClient();

    private static HttpClient newHttpClient() {
        HttpParams params = new BasicHttpParams();
        HttpConnectionParams.setConnectionTimeout(params, 15_000);
        HttpConnectionParams.setSoTimeout(params, 60_000);
        HttpConnectionParams.setSocketBufferSize(params, 8192);
        return new DefaultHttpClient(params);
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.main);

        messageList = (LinearLayout) findViewById(R.id.messages);
        scroller = (ScrollView) findViewById(R.id.scroll);
        input = (EditText) findViewById(R.id.input);
        sendButton = (Button) findViewById(R.id.send);
        status = (TextView) findViewById(R.id.status);

        sendButton.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                submit();
            }
        });

        input.setOnEditorActionListener(new TextView.OnEditorActionListener() {
            public boolean onEditorAction(TextView v, int actionId, KeyEvent event) {
                if (actionId == EditorInfo.IME_ACTION_SEND) {
                    submit();
                    return true;
                }
                return false;
            }
        });

        if (savedInstanceState == null) {
            appendBubble(getString(R.string.welcome), false, false);
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (inFlight != null) inFlight.cancel(true);
    }

    /* ────────────────────────── sending ────────────────────────── */

    private void submit() {
        String text = input.getText().toString().trim();
        if (text.length() == 0) return;
        if (inFlight != null) {
            Toast.makeText(this, R.string.thinking, Toast.LENGTH_SHORT).show();
            return;
        }

        input.setText("");
        appendBubble(text, true, false);
        setStatus(getString(R.string.thinking));
        sendButton.setEnabled(false);

        inFlight = new AskEmberTask().execute(text);
    }

    private final class AskEmberTask extends AsyncTask<String, Void, String> {
        @Override
        protected String doInBackground(String... params) {
            return ask(params[0]);
        }

        @Override
        protected void onPostExecute(String result) {
            inFlight = null;
            sendButton.setEnabled(true);
            setStatus("");
            appendBubble(result, false, result.startsWith("Ember error:"));
        }

        @Override
        protected void onCancelled() {
            inFlight = null;
            sendButton.setEnabled(true);
        }
    }

    /** GET {EMBER_HOST}/v?msg=...&maxlen=...  → plain UTF-8 text reply. */
    private String ask(String message) {
        try {
            String url = EMBER_HOST + "/v?msg="
                    + enc(message) + "&maxlen=" + MAXLEN;
            HttpGet get = new HttpGet();
            get.setURI(new URI(url));
            get.setHeader("Accept", "text/plain");
            get.setHeader("Accept-Charset", "utf-8");

            HttpResponse response = httpClient.execute(get);
            try {
                int code = response.getStatusLine().getStatusCode();
                String body = readAll(response.getEntity().getContent());
                if (code != HttpStatus.SC_OK) {
                    return "Ember error: HTTP " + code
                            + (body.length() > 0 ? " — " + body : "");
                }
                return body.length() > 0 ? body : "Ember error: empty reply.";
            } finally {
                get.abort();
            }
        } catch (Exception e) {
            String detail = e.getMessage();
            return "Ember error: " + (detail != null ? detail : "network failure");
        }
    }

    private static String enc(String s) {
        try {
            return URLEncoder.encode(s, "UTF-8");
        } catch (UnsupportedEncodingException e) {
            return s; // UTF-8 is always present in practice
        }
    }

    private static String readAll(InputStream in) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[2048];
        try {
            int n;
            while ((n = in.read(buf)) != -1) out.write(buf, 0, n);
        } finally {
            try { in.close(); } catch (Exception ignore) {}
        }
        return new String(out.toByteArray(), "UTF-8");
    }

    /* ────────────────────── transcript rendering ───────────────── */

    private void appendBubble(String text, boolean fromUser, boolean isError) {
        transcript.add(new Msg(text, fromUser, isError));
        messageList.addView(makeBubble(text, fromUser, isError));
        messageList.post(new Runnable() {
            public void run() {
                scroller.smoothScrollTo(0, messageList.getHeight());
            }
        });
    }

    private TextView makeBubble(String text, boolean fromUser, boolean isError) {
        TextView bubble = new TextView(this);

        if (isError) {
            // Errors: plain canvas, clay-dark text, thin clay border —
            // Ember renders destructive content without a bubble.
            bubble.setBackgroundResource(android.R.color.transparent);
            bubble.setTextColor(getResources().getColor(R.color.error));
        } else if (fromUser) {
            bubble.setBackgroundResource(R.drawable.bubble_user);
            bubble.setTextColor(getResources().getColor(R.color.text_primary));
        } else {
            bubble.setBackgroundResource(R.drawable.bubble_assistant);
            bubble.setTextColor(getResources().getColor(R.color.text_primary));
        }

        bubble.setText(text);
        bubble.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        bubble.setLineSpacing(dp(1), 1.15f);

        int pxPadH = dp(fromUser ? 10 : 9);
        int pxPadV = dp(7);
        bubble.setPadding(pxPadH, pxPadV, pxPadH, pxPadV);

        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.gravity = fromUser ? Gravity.RIGHT : Gravity.LEFT;
        // Keep bubbles from spanning the full 240px width.
        lp.setMargins(dp(18), dp(3), dp(18), dp(3));
        bubble.setLayoutParams(lp);

        return bubble;
    }

    private void setStatus(String s) {
        status.setVisibility(TextUtils.isEmpty(s) ? View.GONE : View.VISIBLE);
        status.setText(s);
    }

    private int dp(int v) {
        // X10 Mini Pro is hdpi (160dpi bucket at 1.5x); TypedValue handles it.
        return (int) TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics());
    }
}
