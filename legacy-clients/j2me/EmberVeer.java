/*
 * EmberVeer — Ember for J2ME (MIDP 2.0 / CLDC 1.1)
 * ================================================
 *
 * A faithful port of Ember's web aesthetic to a 176x220 Sony Ericsson
 * screen: oat-white canvas, ink text, clay accent send button, hairline
 * borders, rounded bubbles. Custom Canvas rendering throughout — no
 * LCDUI Forms/Lists — for pixel control over the look.
 *
 * Networking: HttpConnection over plain HTTP to Ember's legacy
 * plain-text endpoint:  GET {EMBER_HOST}/v?msg=<text>&maxlen=1500
 * The reply body IS the assistant's message. No JSON, no parsing.
 *
 * Keys:  Left softkey / -6     → open Menu
 *        Fire / 0 / Send pill  → open composer
 *        Up / Down / drag      → scroll transcript
 *        5                     → clear transcript
 *
 * ─── JAD / MANIFEST (EmberVeer.jad) ─────────────────────────────
 * MIDlet-Name: EmberVeer
 * MIDlet-Version: 1.0.0
 * MIDlet-Vendor: Ember
 * MIDlet-1: EmberVeer, , EmberVeer
 * MicroEdition-Profile: MIDP-2.0
 * MicroEdition-Configuration: CLDC-1.1
 * MIDlet-Jar-URL: EmberVeer.jar
 * MIDlet-Jar-Size: <size of EmberVeer.jar in bytes>
 *
 * Build:
 *   javac -bootclasspath <midp2.0+cldc1.1 classes> EmberVeer.java
 *   preverify -classpath <midp classes> .
 *   jar cfe EmberVeer.jar EmberVeer EmberVeer*.class
 * ────────────────────────────────────────────────────────────────
 */
import java.io.ByteArrayOutputStream;
import java.io.InputStream;

import javax.microedition.io.Connector;
import javax.microedition.io.HttpConnection;
import javax.microedition.lcdui.Canvas;
import javax.microedition.lcdui.Command;
import javax.microedition.lcdui.CommandListener;
import javax.microedition.lcdui.Display;
import javax.microedition.lcdui.Displayable;
import javax.microedition.lcdui.Font;
import javax.microedition.lcdui.Graphics;
import javax.microedition.lcdui.TextBox;
import javax.microedition.lcdui.TextField;
import javax.microedition.midlet.MIDlet;
import javax.microedition.rms.RecordStore;

public class EmberVeer extends MIDlet implements CommandListener, Runnable {

    /* ─── EMBER SERVER ────────────────────────────────────────────── */

    /** Ember server base URL, no trailing slash. e.g. "http://192.168.1.10:3000" */
    private static final String EMBER_HOST = "https://gdp-segments-bus-consumers.trycloudflare.com";

    /** Reply length cap sent to the server (matches /v's default). */
    private static final int MAXLEN = 1500;

    /* ─── EMBER PALETTE (from src/app/globals.css, light theme) ───── */

    private static final int CANVAS_BG     = 0xFCFCFB; // --surface-1
    private static final int INK           = 0x1A1A19; // --foreground (gray-830)
    private static final int INK_MUTED     = 0x6D6B67; // --muted-foreground (gray-500)
    private static final int CLAY          = 0xD97757; // --primary / --clay
    private static final int CLAY_DARK     = 0xB85537; // --clay-dark
    private static final int CARD_BG       = 0xFFFFFF; // --card
    private static final int BORDER        = 0xEDEDEC; // --border (black 8% pre-composited)
    private static final int BORDER_STRONG = 0xDCDCDB; // --border-strong
    private static final int USER_BUBBLE   = 0xF0EFEB; // --user-bubble (ink 5% over canvas)
    private static final int HEADER_BG     = 0xF0EFEC; // --surface-2
    private static final int ERROR_RED     = 0xCD2054; // --destructive

    /* ─── LAYOUT CONSTANTS (176x220 target) ───────────────────────── */

    private static final int HEADER_H  = 18;
    private static final int INPUT_H   = 26;
    private static final int MARGIN    = 4;
    private static final int PAD       = 4;   // bubble inner padding
    private static final int GAP       = 4;   // vertical gap between bubbles
    private static final int ARC       = 6;   // rounded-corner radius (≈ web 12px radius)
    private static final int SEND_W    = 30;  // send pill width
    private static final int MENU_W    = 126;
    private static final int MENU_ROW_H = 20;

    /* ─── STATE ───────────────────────────────────────────────────── */

    private static final String RMS_NAME = "EmberVeer";

    private Display display;
    private EmberCanvas canvas;
    private TextBox composer;
    private final Command cmdSend = new Command("Send", Command.OK, 1);
    private final Command cmdExit = new Command("Exit", Command.EXIT, 10);

    /* Logical messages (full text + role) — the source of truth. */
    private String[] msgText = new String[0];
    private boolean[] msgUser = new boolean[0];
    private boolean[] msgError = new boolean[0];

    /* Wrapped transcript lines, rebuilt from msgText on every change. */
    private String[] lines = new String[0];
    private boolean[] lineUser = new boolean[0];
    private boolean[] lineError = new boolean[0];

    private int scrollY = 0;          // offset of viewport from content top
    private boolean followBottom = true;

    private String draft = "";        // last composed text, echoed in the bar
    private boolean busy = false;
    private String status = "";

    private int dragLastY = -1;
    private boolean menuOpen = false;
    private int menuSelection = 0;

    private static final String[] MENU_ITEMS = {
        "Write message", "Clear chat", "Go to latest", "Exit"
    };

    /* ─── MIDlet lifecycle ────────────────────────────────────────── */

    public void startApp() {
        if (display == null) {
            display = Display.getDisplay(this);
            canvas = new EmberCanvas();

            composer = new TextBox("Ember", "", 500, TextField.ANY);
            composer.addCommand(cmdSend);
            composer.addCommand(cmdExit);
            composer.setCommandListener(this);

            loadTranscript();
        }
        display.setCurrent(canvas);
    }

    public void pauseApp() {
        saveTranscript();
    }

    public void destroyApp(boolean unconditional) {
        saveTranscript();
    }

    public void commandAction(Command c, Displayable d) {
        if (c == cmdSend) {
            String text = composer.getString().trim();
            composer.setString("");
            if (text.length() > 0) {
                draft = text;
                send(text);
            }
            display.setCurrent(canvas);
        } else if (c == cmdExit) {
            destroyApp(false);
            notifyDestroyed();
        }
    }

    /* ─── Sending ─────────────────────────────────────────────────── */

    private void send(String text) {
        appendMessage(text, true, false);
        status = "thinking…";
        busy = true;
        canvas.repaint();
        new Thread(this).start();
    }

    public void run() {
        String reply = askEmber(lastUserMessage());
        busy = false;
        status = "";
        appendMessage(reply, false, reply.startsWith("Ember error:"));
    }

    /** The most recent user message — the one we're answering. */
    private String lastUserMessage() {
        for (int i = msgUser.length - 1; i >= 0; i--) {
            if (msgUser[i]) return msgText[i];
        }
        return "";
    }

    /**
     * GET {EMBER_HOST}/v?msg=...&maxlen=... → plain UTF-8 text reply.
     * Blocks; must run on the worker thread only.
     */
    private String askEmber(String message) {
        HttpConnection conn = null;
        InputStream in = null;
        try {
            StringBuffer urlBuf = new StringBuffer();
urlBuf.append(EMBER_HOST);
urlBuf.append("/v?msg=");
urlBuf.append(urlEncode(message));
urlBuf.append("&maxlen=");
urlBuf.append(MAXLEN);
String url = urlBuf.toString();
            conn = (HttpConnection) Connector.open(url, Connector.READ);
            conn.setRequestMethod(HttpConnection.GET);
            conn.setRequestProperty("Accept", "text/plain");
            conn.setRequestProperty("Accept-Charset", "utf-8");

            int code = conn.getResponseCode();
            in = conn.openInputStream();
            String body = readAll(in);

            if (code != HttpConnection.HTTP_OK) {
                    StringBuffer eb = new StringBuffer("Ember error: HTTP ");
                    eb.append(code);
                    if (body.length() > 0) { eb.append(" - "); eb.append(body); }
                    return eb.toString();
            }
            return body.length() > 0 ? body : "Ember error: empty reply.";
        } catch (Exception e) {
            String m = e.getMessage();
            StringBuffer eb = new StringBuffer("Ember error: ");
            eb.append(m != null ? m : "network failure");
            return eb.toString();
        } finally {
            if (in != null) {
                try { in.close(); } catch (Exception ignore) {}
            }
            if (conn != null) {
                try { conn.close(); } catch (Exception ignore) {}
            }
        }
    }

    private static String readAll(InputStream in) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[1024];
        int n;
        while ((n = in.read(buf)) != -1) out.write(buf, 0, n);
        return new String(out.toByteArray(), "UTF-8");
    }

    /** Minimal URL encoder for query values (CLDC has none). */
    private static String urlEncode(String s) {
        StringBuffer out = new StringBuffer();
        try {
            byte[] bytes = s.getBytes("UTF-8");
            for (int i = 0; i < bytes.length; i++) {
                int b = bytes[i] & 0xFF;
                if ((b >= 'A' && b <= 'Z') || (b >= 'a' && b <= 'z')
                        || (b >= '0' && b <= '9')
                        || b == '-' || b == '_' || b == '.' || b == '~') {
                    out.append((char) b);
                } else if (b == ' ') {
                    out.append('+');
                } else {
                    out.append('%');
                    out.append("0123456789ABCDEF".charAt((b >> 4) & 0xF));
                    out.append("0123456789ABCDEF".charAt(b & 0xF));
                }
            }
        } catch (Exception e) {
            return s;
        }
        return out.toString();
    }

    /* ─── Transcript model ────────────────────────────────────────── */

    private void appendMessage(String text, boolean isUser, boolean isError) {
        int n = msgText.length;
        String[] nt = new String[n + 1];
        boolean[] nu = new boolean[n + 1];
        boolean[] ne = new boolean[n + 1];
        for (int i = 0; i < n; i++) {
            nt[i] = msgText[i];
            nu[i] = msgUser[i];
            ne[i] = msgError[i];
        }
        nt[n] = text;
        nu[n] = isUser;
        ne[n] = isError;
        msgText = nt;
        msgUser = nu;
        msgError = ne;

        rewrap();
        followBottom = true;
        saveTranscript();
        canvas.repaint();
    }

    private void clearTranscript() {
        msgText = new String[0];
        msgUser = new boolean[0];
        msgError = new boolean[0];
        rewrap();
        followBottom = true;
        saveTranscript();
        canvas.repaint();
    }

    private void showMenu() {
        menuOpen = true;
        menuSelection = 0;
        canvas.repaint();
    }

    private void hideMenu() {
        menuOpen = false;
        canvas.repaint();
    }

    private void chooseMenuItem() {
        switch (menuSelection) {
            case 0:
                menuOpen = false;
                canvas.repaint();
                canvas.openComposer();
                break;
            case 1:
                clearTranscript();
                menuOpen = false;
                break;
            case 2:
                followBottom = true;
                menuOpen = false;
                canvas.repaint();
                break;
            case 3:
                destroyApp(false);
                notifyDestroyed();
                break;
            default:
                break;
        }
    }

    /** Re-wrap every message into bubble lines (transcripts are tiny here). */
    private void rewrap() {
        Font f = Font.getFont(Font.FACE_SYSTEM, Font.STYLE_PLAIN, Font.SIZE_SMALL);
        int avail = canvas.getWidth() - MARGIN * 2 - PAD * 2 - 2;

        int cap = 8;
        for (int m = 0; m < msgText.length; m++) cap += countLines(msgText[m]);

        String[] nl = new String[cap];
        boolean[] nu = new boolean[cap];
        boolean[] ne = new boolean[cap];
        int k = 0;

        for (int m = 0; m < msgText.length; m++) {
            String[] paragraphs = split(msgText[m], '\n');
            for (int p = 0; p < paragraphs.length; p++) {
                if (p > 0 && k < cap) { // blank line between paragraphs
                    nl[k] = " ";
                    nu[k] = msgUser[m];
                    ne[k] = msgError[m];
                    k++;
                }
                String[] words = split(paragraphs[p], ' ');
                StringBuffer cur = new StringBuffer();
                for (int w = 0; w < words.length; w++) {
                    StringBuffer testBuf = new StringBuffer(cur.toString());
                    if (testBuf.length() > 0) testBuf.append(" ");
                    testBuf.append(words[w]);
                    String test = cur.length() == 0 ? words[w] : testBuf.toString();
                    if (f.stringWidth(test) <= avail) {
                        if (cur.length() > 0) cur.append(' ');
                        cur.append(words[w]);
                    } else {
                        if (cur.length() > 0 && k < cap) {
                            nl[k] = cur.toString();
                            nu[k] = msgUser[m];
                            ne[k] = msgError[m];
                            k++;
                        }
                        cur = new StringBuffer(words[w]);
                    }
                }
                if (k < cap) {
                    nl[k] = cur.toString();
                    nu[k] = msgUser[m];
                    ne[k] = msgError[m];
                    k++;
                }
            }
        }

        lines = new String[k];
        lineUser = new boolean[k];
        lineError = new boolean[k];
        for (int i = 0; i < k; i++) {
            lines[i] = nl[i];
            lineUser[i] = nu[i];
            lineError[i] = ne[i];
        }
    }

    private static int countLines(String s) {
        int c = 1;
        for (int i = 0; i < s.length(); i++) {
            if (s.charAt(i) == '\n') c++;
        }
        return c;
    }

    private static String[] split(String s, char sep) {
        if (s == null || s.length() == 0) return new String[]{""};
        java.util.Vector parts = new java.util.Vector();
        int start = 0;
        for (int i = 0; i < s.length(); i++) {
            if (s.charAt(i) == sep) {
                parts.addElement(s.substring(start, i));
                start = i + 1;
            }
        }
        parts.addElement(s.substring(start));
        String[] out = new String[parts.size()];
        for (int i = 0; i < out.length; i++) out[i] = (String) parts.elementAt(i);
        return out;
    }

    /* ─── Persistence (RMS, best-effort) ──────────────────────────── */

    private void saveTranscript() {
        RecordStore rs = null;
        try {
            RecordStore.deleteRecordStore(RMS_NAME);
        } catch (Exception ignore) {}
        try {
            rs = RecordStore.openRecordStore(RMS_NAME, true);
            ByteArrayOutputStream bout = new ByteArrayOutputStream();
            for (int i = 0; i < msgText.length; i++) {
                bout.write((msgUser[i] ? 1 : 0) | (msgError[i] ? 2 : 0));
                byte[] b = msgText[i].getBytes("UTF-8");
                bout.write((b.length >> 8) & 0xFF);
                bout.write(b.length & 0xFF);
                bout.write(b);
            }
            byte[] all = bout.toByteArray();
            int off = 0;
            while (off < all.length) { // RMS records cap out ~10-30KB; chunk it
                int len = Math.min(10000, all.length - off);
                byte[] chunk = new byte[len];
                System.arraycopy(all, off, chunk, 0, len);
                rs.addRecord(chunk, 0, len);
                off += len;
            }
        } catch (Exception ignore) {
            // Persistence is best-effort on small devices.
        } finally {
            if (rs != null) {
                try { rs.closeRecordStore(); } catch (Exception ignore) {}
            }
        }
    }

    private void loadTranscript() {
        RecordStore rs = null;
        try {
            rs = RecordStore.openRecordStore(RMS_NAME, false);
            ByteArrayOutputStream bout = new ByteArrayOutputStream();
            for (int i = 1; i <= rs.getNumRecords(); i++) {
                byte[] rec = rs.getRecord(i);
                bout.write(rec, 0, rec.length);
            }
            byte[] all = bout.toByteArray();
            int off = 0;
            while (off + 3 <= all.length) {
                int flags = all[off] & 0xFF;
                int len = ((all[off + 1] & 0xFF) << 8) | (all[off + 2] & 0xFF);
                off += 3;
                if (off + len > all.length) break;
                appendMessage(new String(all, off, len, "UTF-8"),
                        (flags & 1) != 0, (flags & 2) != 0);
                off += len;
            }
        } catch (Exception ignore) {
            // Fresh install: empty transcript.
        } finally {
            if (rs != null) {
                try { rs.closeRecordStore(); } catch (Exception ignore) {}
            }
        }
    }

    private static int clamp(int v, int lo, int hi) {
        return v < lo ? lo : (v > hi ? hi : v);
    }

    /* ─── The Canvas: Ember rendered pixel by pixel ───────────────── */

    private class EmberCanvas extends Canvas {

        private final Font bodyFont =
                Font.getFont(Font.FACE_SYSTEM, Font.STYLE_PLAIN, Font.SIZE_SMALL);
        private final Font uiFont =
                Font.getFont(Font.FACE_SYSTEM, Font.STYLE_PLAIN, Font.SIZE_SMALL);
        private final Font titleFont =
                Font.getFont(Font.FACE_SYSTEM, Font.STYLE_BOLD, Font.SIZE_MEDIUM);

        private int viewH() {
            return getHeight() - HEADER_H - INPUT_H;
        }

        private int contentH() {
            return lines.length * (bodyFont.getHeight() + PAD * 2 + GAP);
        }

        protected void paint(Graphics g) {
            int w = getWidth();
            int h = getHeight();

            // Canvas: Ember's exact oat-white.
            g.setColor(CANVAS_BG);
            g.fillRect(0, 0, w, h);

            // ── Header bar (surface-2) with the wordmark ──
            g.setColor(HEADER_BG);
            g.fillRect(0, 0, w, HEADER_H);
            g.setColor(BORDER);
            g.drawLine(0, HEADER_H, w, HEADER_H);
            g.setColor(INK);
            g.setFont(titleFont);
            g.drawString("Ember", MARGIN + 1,
                    (HEADER_H - titleFont.getHeight()) / 2 + 1,
                    Graphics.TOP | Graphics.LEFT);
            if (status.length() > 0) {
                g.setFont(uiFont);
                g.setColor(CLAY_DARK);
                g.drawString(status, w - MARGIN,
                        (HEADER_H - uiFont.getHeight()) / 2 + 1,
                        Graphics.TOP | Graphics.RIGHT);
            } else {
                g.setFont(uiFont);
                g.setColor(INK_MUTED);
                g.drawString("Menu", w - MARGIN,
                        (HEADER_H - uiFont.getHeight()) / 2 + 1,
                        Graphics.TOP | Graphics.RIGHT);
            }

            // ── Message area ──
            int visH = viewH();
            int maxScroll = Math.max(0, contentH() - visH);
            if (followBottom) scrollY = maxScroll;
            scrollY = clamp(scrollY, 0, maxScroll);

            g.setClip(0, HEADER_H + 1, w, visH);
            g.translate(0, HEADER_H + 1 - scrollY);

            int lineH = bodyFont.getHeight() + PAD * 2;
            int y = 0;
            for (int i = 0; i < lines.length; i++) {
                if (y + lineH >= scrollY && y <= scrollY + visH) {
                    paintBubble(g, w, i, y, lineH);
                }
                y += lineH + GAP;
            }

            g.translate(0, -(HEADER_H + 1 - scrollY));
            g.setClip(0, 0, w, h);

            // ── Composer: manual input bar at the bottom ──
            paintComposer(g, w, h);

            if (menuOpen) paintMenu(g, w, h);
        }

        private void paintMenu(Graphics g, int w, int h) {
            int menuH = MENU_ITEMS.length * MENU_ROW_H + 10;
            int x = MARGIN;
            int y = h - INPUT_H - menuH - 3;

            // A small opaque sheet keeps menu labels legible over the chat.
            g.setColor(CARD_BG);
            g.fillRoundRect(x, y, MENU_W, menuH, ARC, ARC);
            g.setColor(BORDER_STRONG);
            g.drawRoundRect(x, y, MENU_W, menuH, ARC, ARC);

            g.setFont(uiFont);
            for (int i = 0; i < MENU_ITEMS.length; i++) {
                int rowY = y + 5 + i * MENU_ROW_H;
                if (i == menuSelection) {
                    g.setColor(CLAY);
                    g.fillRoundRect(x + 3, rowY, MENU_W - 6, MENU_ROW_H - 1,
                            ARC, ARC);
                    g.setColor(0xFFFFFF);
                } else {
                    g.setColor(i == 3 ? ERROR_RED : INK);
                }
                g.drawString(MENU_ITEMS[i], x + PAD + 2,
                        rowY + (MENU_ROW_H - uiFont.getHeight()) / 2,
                        Graphics.TOP | Graphics.LEFT);
            }
        }

        private void paintBubble(Graphics g, int w, int i, int y, int lineH) {
            boolean isUser = lineUser[i];
            boolean isError = lineError[i];

            int textW = bodyFont.stringWidth(lines[i]);
            int bw = textW + PAD * 2 + 2;
            // User right, Ember left — like the web UI.
            int bx = isUser ? w - MARGIN - bw : MARGIN;

            if (isError) {
                // Errors render on the canvas in Ember's destructive red.
                g.setColor(ERROR_RED);
                g.setFont(bodyFont);
                g.drawString(lines[i], bx + PAD + 1, y + PAD,
                        Graphics.TOP | Graphics.LEFT);
                return;
            }

            // Rounded-rect bubble in Ember's palette.
            g.setColor(isUser ? USER_BUBBLE : CARD_BG);
            g.fillRoundRect(bx, y, bw, lineH, ARC, ARC);
            g.setColor(isUser ? BORDER_STRONG : BORDER);
            g.drawRoundRect(bx, y, bw, lineH, ARC, ARC);
            g.setColor(INK);
            g.setFont(bodyFont);
            g.drawString(lines[i], bx + PAD + 1, y + PAD,
                    Graphics.TOP | Graphics.LEFT);
        }

        private void paintComposer(Graphics g, int w, int h) {
            int inputY = h - INPUT_H;
            g.setColor(BORDER);
            g.drawLine(0, inputY - 1, w, inputY - 1);

            // Field (card surface, hairline ring, rounded — composer-shell).
            int fieldW = w - MARGIN * 2 - SEND_W - 4;
            int fieldY = inputY + 3;
            int fieldH = INPUT_H - 7;
            g.setColor(CARD_BG);
            g.fillRoundRect(MARGIN, fieldY, fieldW, fieldH, ARC, ARC);
            g.setColor(BORDER_STRONG);
            g.drawRoundRect(MARGIN, fieldY, fieldW, fieldH, ARC, ARC);

            // Echo of the last draft / placeholder, tail-anchored like a caret.
            g.setColor(INK_MUTED);
            g.setFont(uiFont);
            String shown = draft.length() > 0 ? draft : "Message Ember…";
            while (uiFont.stringWidth(shown) > fieldW - PAD * 2 - 2
                    && shown.length() > 1) {
                shown = shown.substring(1);
            }
            g.drawString(shown, MARGIN + PAD + 1,
                    fieldY + (fieldH - uiFont.getHeight()) / 2,
                    Graphics.TOP | Graphics.LEFT);

            // Send pill: clay with white label (Ember's accent button).
            int btnX = w - MARGIN - SEND_W;
            g.setColor(busy ? HEADER_BG : CLAY);
            g.fillRoundRect(btnX, fieldY, SEND_W, fieldH, ARC, ARC);
            g.setColor(busy ? BORDER : CLAY_DARK);
            g.drawRoundRect(btnX, fieldY, SEND_W, fieldH, ARC, ARC);
            g.setColor(busy ? INK_MUTED : 0xFFFFFF);
            g.setFont(uiFont);
            g.drawString("Send", btnX + SEND_W / 2,
                    fieldY + (fieldH - uiFont.getHeight()) / 2,
                    Graphics.TOP | Graphics.HCENTER);
        }

        /* ── Input & navigation ── */

        protected void keyPressed(int keyCode) {
            int game = getGameAction(keyCode);
            int maxScroll = Math.max(0, contentH() - viewH());

            if (menuOpen) {
                if (game == UP) {
                    menuSelection = (menuSelection + MENU_ITEMS.length - 1)
                            % MENU_ITEMS.length;
                } else if (game == DOWN) {
                    menuSelection = (menuSelection + 1) % MENU_ITEMS.length;
                } else if (game == FIRE || keyCode == KEY_NUM5 || keyCode == KEY_NUM0) {
                    chooseMenuItem();
                    return;
                } else if (isLeftSoftKey(keyCode)) {
                    hideMenu();
                    return;
                } else if (isRightSoftKey(keyCode)) {
                    hideMenu();
                    return;
                } else {
                    return;
                }
                repaint();
                return;
            }

            if (game == UP) {
                followBottom = false;
                scrollY = clamp(scrollY - 24, 0, maxScroll);
            } else if (game == DOWN) {
                scrollY = clamp(scrollY + 24, 0, maxScroll);
                followBottom = scrollY >= maxScroll;
            } else if (isLeftSoftKey(keyCode)) {
                showMenu();
                return;
            } else if (keyCode == KEY_NUM0 || game == FIRE) {
                openComposer();
                return;
            } else if (keyCode == KEY_NUM5) {
                clearTranscript();
                return;
            } else {
                return;
            }
            repaint();
        }

        protected void pointerPressed(int x, int y) {
            if (menuOpen) return;
            dragLastY = y;
        }

        protected void pointerDragged(int x, int y) {
            if (dragLastY < 0) return;
            int maxScroll = Math.max(0, contentH() - viewH());
            followBottom = false;
            scrollY = clamp(scrollY - (y - dragLastY), 0, maxScroll);
            dragLastY = y;
            repaint();
        }

        protected void pointerReleased(int x, int y) {
            dragLastY = -1;
            if (menuOpen) {
                int menuH = MENU_ITEMS.length * MENU_ROW_H + 10;
                int menuY = getHeight() - INPUT_H - menuH - 3;
                if (x >= MARGIN && x <= MARGIN + MENU_W
                        && y >= menuY && y < menuY + menuH) {
                    int item = (y - menuY - 5) / MENU_ROW_H;
                    if (item >= 0 && item < MENU_ITEMS.length) {
                        menuSelection = item;
                        chooseMenuItem();
                        return;
                    }
                }
                hideMenu();
                return;
            }
            // Tap the Send pill to open the composer (touch variants).
            if (y >= getHeight() - INPUT_H
                    && x >= getWidth() - MARGIN - SEND_W) {
                openComposer();
            }
        }

        private void openComposer() {
            composer.setString("");
            display.setCurrent(composer);
        }

        /* Most MIDP phones use -6/-7 for the physical softkeys. Key names
           cover emulators and handsets that expose different numeric codes. */
        private boolean isLeftSoftKey(int keyCode) {
            String name = getKeyName(keyCode);
            return keyCode == -6 || "SOFT1".equals(name) || "SOFTKEY1".equals(name)
                    || "LEFT SOFT KEY".equals(name);
        }

        private boolean isRightSoftKey(int keyCode) {
            String name = getKeyName(keyCode);
            return keyCode == -7 || "SOFT2".equals(name) || "SOFTKEY2".equals(name)
                    || "RIGHT SOFT KEY".equals(name);
        }
    }
}
