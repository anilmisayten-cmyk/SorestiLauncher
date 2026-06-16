package com.soresti.overlay;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import net.fabricmc.loader.api.FabricLoader;
import java.io.*;
import java.nio.file.Path;

public class ConfigManager {
    private static final Path CONFIG_PATH = FabricLoader.getInstance().getConfigDir().resolve("sorestioverlay.json");
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static ConfigData data = new ConfigData();

    public static ConfigData load() {
        if (CONFIG_PATH.toFile().exists()) {
            try (Reader r = new FileReader(CONFIG_PATH.toFile())) {
                data = GSON.fromJson(r, ConfigData.class);
                if (data == null) data = new ConfigData();
            } catch (Exception e) {
                data = new ConfigData();
            }
        }
        return data;
    }

    public static void save(ConfigData d) {
        data = d;
        try (Writer w = new FileWriter(CONFIG_PATH.toFile())) {
            GSON.toJson(data, w);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public static ConfigData get() { return data; }

    public static class ConfigData {
        public boolean showCPS = true;
        public boolean showKeystrokes = true;
        public boolean showFPS = true;
        public boolean showPing = true;
        public int cpsX = 14, cpsY = 14;
        public float cpsScale = 1.0f;
        public String cpsColor = "#ff9800";
        public int keysY = 14;
        public float keysScale = 1.0f;
        public String keysColor = "#ff9800";
        public String fpsColor = "#44ff44";
        public String pingColor = "#44ff44";
        public boolean rainbow = false;
        public boolean sparkline = true;
    }
}
