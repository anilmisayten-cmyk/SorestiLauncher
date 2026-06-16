package com.soresti.overlay;

import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.client.gui.widget.SliderWidget;
import net.minecraft.text.Text;
import net.minecraft.util.math.MathHelper;
import java.util.function.Consumer;

public class OverlayMenuScreen extends Screen {
    private static final String[] PRESETS = {"#ff4444","#44ff44","#4488ff","#ffdd44","#ff44ff","#44ffdd","#ffffff","#ff9800"};
    private String tab = "cps";
    private int panelX, panelY, panelW, panelH;
    private ConfigManager.ConfigData cfg;
    private int colStartX, colStartY, colSize = 22;

    public OverlayMenuScreen() {
        super(Text.literal("Overlay Settings"));
    }

    @Override
    protected void init() {
        cfg = ConfigManager.get();
        panelW = Math.min(480, width - 40);
        panelH = Math.min(500, height - 40);
        panelX = (width - panelW) / 2;
        panelY = (height - panelH) / 2;
        colStartX = panelX + 8 + (panelW - 16 - PRESETS.length * (colSize + 2)) / 2;
        rebuild();
    }

    private void rebuild() {
        clearChildren();

        int by = panelY + 8;
        int tw = 44;

        addDrawableChild(tabBtn("CPS", 0, by, "cps"));
        addDrawableChild(tabBtn("Tus", 44, by, "keys"));
        addDrawableChild(tabBtn("FPS", 88, by, "fps"));
        addDrawableChild(tabBtn("Ping", 132, by, "ping"));

        addDrawableChild(ButtonWidget.builder(
            Text.literal("\u270E KONUM"), b -> {
                close();
                OverlayHud.repositionMode = true;
            })
            .dimensions(panelX + 224, by, 68, 20).build());

        addDrawableChild(ButtonWidget.builder(Text.literal("X"), b -> close())
            .dimensions(panelX + panelW - 24, by, 18, 20).build());

        int cy = panelY + 36;

        switch (tab) {
            case "cps" -> {
                addDrawableChild(toggle("CPS", cfg.showCPS, cy, v -> { cfg.showCPS = v; save(); rebuild(); }));
                cy += 24;
                addSlider("Boyut", 0.5f, 2f, cfg.cpsScale, cy, v -> { cfg.cpsScale = v; save(); });
                cy += 22;
                addDrawableChild(toggle("Graf", cfg.sparkline, cy, v -> { cfg.sparkline = v; save(); rebuild(); }));
            }
            case "keys" -> {
                addDrawableChild(toggle("Tuslar", cfg.showKeystrokes, cy, v -> { cfg.showKeystrokes = v; save(); rebuild(); }));
                cy += 24;
                addSlider("Boyut", 0.5f, 2f, cfg.keysScale, cy, v -> { cfg.keysScale = v; save(); });
                cy += 22;
                addSlider("Y-Konum", 0f, 300f, cfg.keysY, cy, v -> { cfg.keysY = (int)(float)v; save(); });
            }
            case "fps" -> {
                addDrawableChild(toggle("FPS", cfg.showFPS, cy, v -> { cfg.showFPS = v; save(); rebuild(); }));
            }
            case "ping" -> {
                addDrawableChild(toggle("Ping", cfg.showPing, cy, v -> { cfg.showPing = v; save(); rebuild(); }));
            }
        }

        int ry = panelY + panelH - 28;
        addDrawableChild(toggle("Gokkusagi (Hepsi)", cfg.rainbow, ry, v -> { cfg.rainbow = v; save(); rebuild(); }));
    }

    private ButtonWidget tabBtn(String label, int x, int y, String t) {
        return ButtonWidget.builder(
            Text.literal((tab.equals(t) ? ">" : " ") + label),
            b -> { tab = t; rebuild(); })
            .dimensions(panelX + x, y, 40, 20).build();
    }

    private ButtonWidget toggle(String label, boolean val, int y, Consumer<Boolean> cb) {
        return ButtonWidget.builder(
            Text.literal(label + ": " + (val ? "ON" : "OFF")),
            b -> cb.accept(!val))
            .dimensions(panelX + 8, y, panelW - 16, 20).build();
    }

    private void addSlider(String label, float min, float max, float val, int y, Consumer<Float> cb) {
        addDrawableChild(new SliderWidget(panelX + 8, y, panelW - 16, 20,
            Text.literal(label + ": " + String.format("%.1f", val)),
            (val - min) / (max - min)) {
            @Override
            protected void updateMessage() {
                float v = MathHelper.lerp((float)this.value, min, max);
                setMessage(Text.literal(label + ": " + String.format("%.1f", v)));
            }
            @Override
            protected void applyValue() {
                cb.accept(MathHelper.lerp((float)this.value, min, max));
            }
        });
    }

    @Override
    public void render(DrawContext ctx, int mx, int my, float delta) {
        renderBackground(ctx, mx, my, delta);
        ctx.fill(panelX, panelY, panelX + panelW, panelY + panelH, 0xee111111);
        ctx.fill(panelX, panelY, panelX + panelW, panelY + 1, 0xff9800);
        super.render(ctx, mx, my, delta);

        String current = switch (tab) {
            case "cps" -> cfg.cpsColor;
            case "keys" -> cfg.keysColor;
            case "fps" -> cfg.fpsColor;
            case "ping" -> cfg.pingColor;
            default -> "#ff9800";
        };

        int colLabelY = tab.equals("fps") || tab.equals("ping") ? panelY + 36 : panelY + 82;
        ctx.drawText(textRenderer, "Renk", colStartX, colLabelY, 0xffffffff, true);
        int colY = colLabelY + 14;
        for (int i = 0; i < PRESETS.length; i++) {
            int px = colStartX + i * (colSize + 2);
            int c = parseHex(PRESETS[i]);
            ctx.fill(px, colY, px + colSize, colY + colSize, c);
            if (PRESETS[i].equals(current)) {
                ctx.fill(px - 1, colY - 1, px + colSize + 1, colY + colSize + 1, 0xffffffff);
                ctx.fill(px, colY, px + colSize, colY + colSize, c);
            }
        }
    }

    @Override
    public boolean mouseClicked(double mx, double my, int button) {
        if (super.mouseClicked(mx, my, button)) return true;
        String current = switch (tab) {
            case "cps" -> cfg.cpsColor;
            case "keys" -> cfg.keysColor;
            case "fps" -> cfg.fpsColor;
            case "ping" -> cfg.pingColor;
            default -> "#ff9800";
        };
        int colLabelY = tab.equals("fps") || tab.equals("ping") ? panelY + 36 : panelY + 82;
        int colY = colLabelY + 14;
        for (int i = 0; i < PRESETS.length; i++) {
            int px = colStartX + i * (colSize + 2);
            if (mx >= px && mx < px + colSize && my >= colY && my < colY + colSize) {
                String clr = PRESETS[i];
                switch (tab) {
                    case "cps" -> cfg.cpsColor = clr;
                    case "keys" -> cfg.keysColor = clr;
                    case "fps" -> cfg.fpsColor = clr;
                    case "ping" -> cfg.pingColor = clr;
                }
                save(); rebuild();
                return true;
            }
        }
        return false;
    }

    private void save() { ConfigManager.save(cfg); }

    @Override
    public boolean shouldPause() { return false; }

    private static int parseHex(String h) {
        try { return Integer.parseInt(h.replace("#",""), 16) | 0xff000000; }
        catch (Exception e) { return 0xffff9800; }
    }
}
