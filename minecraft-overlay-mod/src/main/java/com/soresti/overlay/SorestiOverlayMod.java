package com.soresti.overlay;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientLifecycleEvents;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import net.minecraft.resource.ResourcePackManager;
import org.lwjgl.glfw.GLFW;
import java.io.File;

public class SorestiOverlayMod implements ClientModInitializer {
    private static KeyBinding menuKey;
    private static boolean prevMenuKey = false;
    static final String[] BUNDLED_PACKS = {
        "Theone's Eating Animation Pack v1.0",
        "ToolTips-Stylized_v1.1_1.20+-1.21+",
        "§b§lVanilla Experience+§0"
    };

    @Override
    public void onInitializeClient() {
        ConfigManager.load();
        ClickTracker.register();
        OverlayHud.register();

        menuKey = KeyBindingHelper.registerKeyBinding(new KeyBinding(
            "key.sorestioverlay.menu",
            InputUtil.Type.KEYSYM,
            GLFW.GLFW_KEY_RIGHT_SHIFT,
            "category.sorestioverlay"
        ));

        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            boolean now = menuKey.isPressed();

            if (OverlayHud.repositionMode) {
                if (now && !prevMenuKey) {
                    OverlayHud.repositionMode = false;
                }
                prevMenuKey = now;
                return;
            }

            if (now && !prevMenuKey) {
                if (client.currentScreen instanceof OverlayMenuScreen) {
                    client.setScreen(null);
                } else {
                    client.setScreen(new OverlayMenuScreen());
                }
            }
            prevMenuKey = now;
        });

        ClientLifecycleEvents.CLIENT_STARTED.register(client -> {
            enableBundledResourcePacks(client);
        });
    }

    private static void enableBundledResourcePacks(MinecraftClient client) {
        try {
            File respacksDir = new File(client.runDirectory, "resourcepacks");
            if (!respacksDir.exists()) return;

            ResourcePackManager rpm = client.getResourcePackManager();
            rpm.scanPacks();

            for (String packName : BUNDLED_PACKS) {
                if (rpm.enable(packName)) continue;
                rpm.enable(packName + ".zip");
            }

            client.reloadResources();
        } catch (Exception e) {
            System.out.println("[SorestiOverlay] Resource pack enable error: " + e.getMessage());
        }
    }

}
