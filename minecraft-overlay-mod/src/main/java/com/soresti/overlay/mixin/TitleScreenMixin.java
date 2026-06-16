package com.soresti.overlay.mixin;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.screen.TitleScreen;
import net.minecraft.client.gui.screen.multiplayer.ConnectScreen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.client.network.ServerAddress;
import net.minecraft.client.network.CookieStorage;
import net.minecraft.client.network.ServerInfo;
import net.minecraft.text.Text;
import net.minecraft.util.Identifier;
import java.util.Collections;
import java.util.Map;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(TitleScreen.class)
public class TitleScreenMixin {
    @Inject(method = "init", at = @At("RETURN"))
    private void onInit(CallbackInfo ci) {
        TitleScreen screen = (TitleScreen)(Object)this;
        for (var e : screen.children()) {
            if (e instanceof ButtonWidget btn) {
                String msg = btn.getMessage().getString();
                if (msg.contains("Multiplayer") || msg.contains("multiplayer") || msg.contains("Çok Oyunculu") || msg.contains("çok oyunculu")) {
                    btn.setMessage(Text.literal("Sunucuya Gir"));
                    ((ButtonWidgetAccessor)btn).setOnPress(b -> {
                        MinecraftClient client = MinecraftClient.getInstance();
                        ServerInfo info = new ServerInfo("SorestiMC", "oyna.sorestimc.xyz", ServerInfo.ServerType.OTHER);
                        ServerAddress addr = ServerAddress.parse("oyna.sorestimc.xyz");
                        ConnectScreen.connect(screen, client, addr, info, false, new CookieStorage(Collections.<Identifier, byte[]>emptyMap()));
                    });
                    break;
                }
            }
        }
    }
}
