package com.soresti.overlay;

import net.fabricmc.fabric.api.client.rendering.v1.HudRenderCallback;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.render.RenderTickCounter;
import net.minecraft.client.util.Window;
import net.minecraft.client.network.PlayerListEntry;
import org.lwjgl.glfw.GLFW;
import java.util.Collection;

public class OverlayHud {
    private static final MinecraftClient client = MinecraftClient.getInstance();
    private static float hueTimer = 0f;
    private static long lastFrame = System.currentTimeMillis();

    public static boolean repositionMode = false;
    private static String dragTarget = null;
    private static double dragOffX, dragOffY;

    public static void register() {
        HudRenderCallback.EVENT.register((context, tickCounter) -> {
            var cfg = ConfigManager.get();
            TextRenderer tr = client.textRenderer;

            long now = System.currentTimeMillis();
            hueTimer += (now - lastFrame) / 1000f * 60f;
            lastFrame = now;

            if (cfg.showFPS) drawFPS(context, tr, cfg);
            if (cfg.showPing) drawPing(context, tr, cfg);
            if (!repositionMode) {
                if (cfg.showCPS) drawCPS(context, tr, cfg);
                if (cfg.showKeystrokes) drawKeystrokes(context, tr, cfg);
            } else {
                handleReposition(cfg);
                if (cfg.showCPS) drawCPS(context, tr, cfg);
                if (cfg.showKeystrokes) drawKeystrokes(context, tr, cfg);
                drawRepositionCursor(context, tr);
                drawRepositionUI(context, tr);
            }
        });
    }

    private static double mouseX() {
        Window w = client.getWindow();
        return client.mouse.getX() * w.getScaledWidth() / w.getWidth();
    }

    private static double mouseY() {
        Window w = client.getWindow();
        return client.mouse.getY() * w.getScaledHeight() / w.getHeight();
    }

    private static boolean leftHeld() {
        return GLFW.glfwGetMouseButton(client.getWindow().getHandle(), GLFW.GLFW_MOUSE_BUTTON_1) == GLFW.GLFW_PRESS;
    }

    private static void handleReposition(ConfigManager.ConfigData cfg) {
        if (!repositionMode) return;

        double mx = mouseX();
        double my = mouseY();
        long h = client.getWindow().getHandle();
        boolean left = leftHeld();

        int sw = scaledWidth();
        float cs = Math.max(0.5f, Math.min(2f, cfg.cpsScale));
        float ks = Math.max(0.5f, Math.min(2f, cfg.keysScale));

        int cpsW = (int)(80 * cs);
        int cpsH = (int)((cfg.sparkline ? 62 : 46) * cs);
        int keysW = (int)(145 * ks);
        int keysH = (int)(135 * ks);

        if (dragTarget == null && left) {
            if (mx >= cfg.cpsX && mx <= cfg.cpsX + cpsW && my >= cfg.cpsY && my <= cfg.cpsY + cpsH) {
                dragTarget = "cps"; dragOffX = mx - cfg.cpsX; dragOffY = my - cfg.cpsY;
            } else if (mx >= sw - 130 * ks && mx <= sw - 130 * ks + keysW && my >= cfg.keysY && my <= cfg.keysY + keysH) {
                dragTarget = "keys"; dragOffX = mx - (sw - 130 * ks); dragOffY = my - cfg.keysY;
            }
        }

        if (dragTarget != null && left) {
            int nx = Math.max(0, (int)Math.round(mx - dragOffX));
            int ny = Math.max(0, (int)Math.round(my - dragOffY));
            switch (dragTarget) {
                case "cps" -> { cfg.cpsX = nx; cfg.cpsY = ny; }
                case "keys" -> { cfg.keysY = ny; }
            }
            ConfigManager.save(cfg);
        }

        if (!left) dragTarget = null;

        if (GLFW.glfwGetKey(h, GLFW.GLFW_KEY_RIGHT_SHIFT) == GLFW.GLFW_PRESS && !left) {
            repositionMode = false;
            dragTarget = null;
        }
    }

    private static int scaledWidth() {
        return client.getWindow().getScaledWidth();
    }

    private static int scaledHeight() {
        return client.getWindow().getScaledHeight();
    }

    private static void drawRepositionCursor(DrawContext ctx, TextRenderer tr) {
        double mx = mouseX();
        double my = mouseY();
        int ix = (int)mx;
        int iy = (int)my;
        ctx.fill(ix - 1, iy - 6, ix + 1, iy + 2, 0xffffffff);
        ctx.fill(ix - 6, iy - 1, ix + 2, iy + 1, 0xffffffff);
        ctx.fill(ix + 1, iy - 4, ix + 8, iy + 4, 0xffffffff);
        ctx.fill(ix + 3, iy - 1, ix + 7, iy + 1, 0xff000000);
    }

    private static void drawRepositionUI(DrawContext ctx, TextRenderer tr) {
        int sw = scaledWidth();
        int sh = scaledHeight();

        String hint = dragTarget == null
            ? "HUD ogelerine tiklayip surukleyin | Shift: cikis"
            : switch (dragTarget) {
                case "cps" -> "CPS surukleniyor...";
                case "keys" -> "Tuslar surukleniyor...";
                default -> "";
            };

        int tw = tr.getWidth(hint);
        int bx = (sw - tw - 20) / 2;
        int by = sh - 40;

        ctx.fill(bx, by, bx + tw + 20, by + 22, 0xbb111111);
        ctx.fill(bx, by, bx + tw + 20, by + 1, 0xffff9800);
        ctx.drawText(tr, hint, bx + 10, by + 7, 0xffffffff, true);
    }

    private static int rainbowColor(float base, float offset) {
        float hue = (base + offset) % 360f;
        return java.awt.Color.HSBtoRGB(hue / 360f, 0.8f, 1f) | 0xff000000;
    }

    private static int applyRainbow(int color, float offset, boolean rainbow) {
        if (!rainbow) return color;
        return rainbowColor(hueTimer, offset);
    }

    private static int parseColor(String hex, int fallback) {
        try {
            if (hex.startsWith("#")) hex = hex.substring(1);
            if (hex.length() == 6) return Integer.parseInt(hex, 16) | 0xff000000;
            if (hex.length() == 8) return (int) Long.parseLong(hex, 16);
        } catch (Exception ignored) {}
        return fallback;
    }

    private static void drawFPS(DrawContext ctx, TextRenderer tr, ConfigManager.ConfigData cfg) {
        int fps = client.getCurrentFps();
        int baseColor = parseColor(cfg.fpsColor, 0x44ff44);
        int color = applyRainbow(baseColor, 0, cfg.rainbow);

        String text = fps + " FPS";
        int tw = tr.getWidth(text);
        int x = scaledWidth() - tw - 6;
        int y = 4;

        ctx.fill(x - 2, y - 1, x + tw + 2, y + tr.fontHeight + 1, 0x88000000);
        ctx.drawText(tr, text, x, y, color, true);
    }

    private static void drawPing(DrawContext ctx, TextRenderer tr, ConfigManager.ConfigData cfg) {
        int baseColor = parseColor(cfg.pingColor, 0x44ff44);
        int color = applyRainbow(baseColor, 60, cfg.rainbow);

        int ping = 0;
        if (client.getNetworkHandler() != null && client.player != null) {
            Collection<PlayerListEntry> entries = client.getNetworkHandler().getPlayerList();
            for (PlayerListEntry e : entries) {
                if (e.getProfile().getId().equals(client.player.getUuid())) {
                    ping = e.getLatency();
                    break;
                }
            }
        }

        String text = ping + " ms";
        int tw = tr.getWidth(text);
        int x = scaledWidth() - tw - 6;
        int y = 4 + tr.fontHeight + 3;

        ctx.fill(x - 2, y - 1, x + tw + 2, y + tr.fontHeight + 1, 0x88000000);
        ctx.drawText(tr, text, x, y, color, true);
    }

    private static void drawCPS(DrawContext ctx, TextRenderer tr, ConfigManager.ConfigData cfg) {
        int cps = ClickTracker.getLeftCPS();
        int baseColor = parseColor(cfg.cpsColor, 0xffff9800);
        int color = applyRainbow(baseColor, 0, cfg.rainbow);
        float scale = Math.max(0.5f, Math.min(2f, cfg.cpsScale));
        int x = cfg.cpsX;
        int y = cfg.cpsY;

        ctx.getMatrices().push();
        ctx.getMatrices().translate(x, y, 0);
        ctx.getMatrices().scale(scale, scale, 1);

        String text = String.valueOf(cps);
        int tw = tr.getWidth(text);
        int pw = Math.max(tw + 36, 70);
        int ph = cfg.sparkline ? 62 : 46;

        int bg = (color & 0x00ffffff) | 0x33000000;
        int border = (color & 0x00ffffff) | 0xaa000000;

        ctx.fill(0, 0, pw, ph, 0xdd0a0a0f);
        ctx.fill(0, 0, pw, ph, bg);
        ctx.fill(0, ph - 1, pw, ph, border);
        ctx.fill(0, 0, pw, 1, border);

        if (repositionMode) {
            int dash = (color & 0x00ffffff) | 0x66000000;
            for (int dd = 0; dd < pw; dd += 6) ctx.fill(dd, 0, Math.min(dd + 3, pw), 1, dash);
            for (int dd = 0; dd < ph; dd += 6) ctx.fill(pw - 1, dd, pw, Math.min(dd + 3, ph), dash);
            for (int dd = 0; dd < pw; dd += 6) ctx.fill(dd, ph - 1, Math.min(dd + 3, pw), ph, dash);
            for (int dd = 0; dd < ph; dd += 6) ctx.fill(0, dd, 1, Math.min(dd + 3, ph), dash);
        }

        int textX = (pw - tw) / 2;
        int textY = cfg.sparkline ? 6 : 10;
        ctx.drawText(tr, text, textX, textY, color, true);

        int labelX = (pw - tr.getWidth("CPS")) / 2;
        int labelY = cfg.sparkline ? 20 : textY + 22;
        ctx.drawText(tr, "CPS", labelX, labelY, 0xaaffffff, true);

        if (cfg.sparkline) {
            int[] history = ClickTracker.getCpsHistory();
            int hIdx = ClickTracker.getHistoryIndex();
            int totalBars = Math.min((pw - 10) / 3, 30);
            int sparkY = 32;
            int sparkH = 22;
            int maxVal = 1;
            for (int i = 0; i < totalBars; i++) {
                int v = history[(hIdx - i - 1 + history.length) % history.length];
                if (v > maxVal) maxVal = v;
            }
            if (maxVal < 1) maxVal = 1;
            for (int i = 0; i < totalBars; i++) {
                int idx = (hIdx - i - 1 + history.length) % history.length;
                int val = history[idx];
                int bh = Math.max(1, (val * sparkH) / maxVal);
                int bx = pw - 8 - (i * 3);
                int by2 = sparkY + sparkH - bh;
                float alpha = 0.3f + (i / (float) totalBars) * 0.7f;
                int barColor = (color & 0x00ffffff) | ((int)(alpha * 255) << 24);
                ctx.fill(bx, by2, bx + 2, by2 + bh, barColor);
            }
        }

        ctx.getMatrices().pop();
    }

    private static void drawKeystrokes(DrawContext ctx, TextRenderer tr, ConfigManager.ConfigData cfg) {
        int baseColor = parseColor(cfg.keysColor, 0xffff9800);
        int color = applyRainbow(baseColor, 120, cfg.rainbow);
        float scale = Math.max(0.5f, Math.min(2f, cfg.keysScale));

        boolean w = isPressed(GLFW.GLFW_KEY_W);
        boolean a = isPressed(GLFW.GLFW_KEY_A);
        boolean s = isPressed(GLFW.GLFW_KEY_S);
        boolean d = isPressed(GLFW.GLFW_KEY_D);
        boolean space = isPressed(GLFW.GLFW_KEY_SPACE);
        boolean shift = isPressed(GLFW.GLFW_KEY_LEFT_SHIFT) || isPressed(GLFW.GLFW_KEY_RIGHT_SHIFT);
        boolean e = isPressed(GLFW.GLFW_KEY_E);

        int sw = scaledWidth();
        int ks = 28;
        int gap = 3;
        int px = sw - 130;
        int py = cfg.keysY;

        ctx.getMatrices().push();
        ctx.getMatrices().translate(px, py, 0);
        ctx.getMatrices().scale(scale, scale, 1);

        int nk = 0x33 << 24;
        int pk = (color & 0x00ffffff) | 0x88000000;
        int glw = (color & 0x00ffffff) | 0x33000000;

        drawKey(ctx, tr, "W",  (ks + gap), 0,      ks, ks, w, pk, nk, color, glw);
        drawKey(ctx, tr, "A",  0,           ks + gap, ks, ks, a, pk, nk, color, glw);
        drawKey(ctx, tr, "S",  ks + gap,    ks + gap, ks, ks, s, pk, nk, color, glw);
        drawKey(ctx, tr, "D",  2*(ks + gap), ks + gap, ks, ks, d, pk, nk, color, glw);

        int row2y = 2 * (ks + gap) + 8;
        drawKey(ctx, tr, "E",  0,           row2y, ks, ks, e, pk, nk, color, glw);
        drawKey(ctx, tr, "SPACE", ks + gap, row2y, (int)(ks * 2.2), ks, space, pk, nk, color, glw);
        drawKey(ctx, tr, "SHIFT", ks + gap + (int)(ks * 2.2) + gap, row2y, (int)(ks * 2.2), ks, shift, pk, nk, color, glw);

        int row3y = row2y + ks + gap + 4;
        boolean lmb = client.options.attackKey.isPressed();
        boolean rmb = client.options.useKey.isPressed();
        drawKey(ctx, tr, "LMB", 0, row3y, 58, 24, lmb, pk, nk, color, glw);
        drawKey(ctx, tr, "RMB", 61, row3y, 58, 24, rmb, pk, nk, color, glw);

        if (repositionMode) {
            int totalW = (int)(ks * 3.4) + gap * 2;
            int totalH = row3y + 28;
            int dash = (color & 0x00ffffff) | 0x55000000;
            for (int dd = 0; dd < totalW; dd += 6) ctx.fill(dd, 0, Math.min(dd + 3, totalW), 1, dash);
            for (int dd = 0; dd < totalH; dd += 6) ctx.fill(totalW - 1, dd, totalW, Math.min(dd + 3, totalH), dash);
            for (int dd = 0; dd < totalW; dd += 6) ctx.fill(dd, totalH - 1, Math.min(dd + 3, totalW), totalH, dash);
            for (int dd = 0; dd < totalH; dd += 6) ctx.fill(0, dd, 1, Math.min(dd + 3, totalH), dash);
        }

        ctx.getMatrices().pop();
    }

    private static boolean isPressed(int key) {
        long h = client.getWindow().getHandle();
        return GLFW.glfwGetKey(h, key) == GLFW.GLFW_PRESS;
    }

    private static void drawKey(DrawContext ctx, TextRenderer tr, String label, int x, int y, int w, int h, boolean pressed, int pk, int nk, int accent, int glow) {
        if (pressed) ctx.fill(x - 1, y - 1, x + w + 1, y + h + 1, glow);
        int bg = pressed ? pk : nk;
        ctx.fill(x, y, x + w, y + h, bg);
        if (pressed) {
            ctx.fill(x, y, x + w, y + 1, accent);
            ctx.fill(x, y, x + 1, y + h, accent);
            ctx.fill(x + w - 1, y, x + w, y + h, accent);
            ctx.fill(x, y + h - 1, x + w, y + h, accent);
        }
        int tx = x + (w - tr.getWidth(label)) / 2;
        int ty = y + (h - tr.fontHeight) / 2 + 1;
        ctx.drawText(tr, label, tx, ty, pressed ? 0xffffffff : 0x99ffffff, true);
    }

    private static boolean prevLeft = false;
}
