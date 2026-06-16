package com.soresti.overlay.mixin;

import net.minecraft.resource.ResourcePackManager;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(ResourcePackManager.class)
public class ResourcePackManagerMixin {
    private static final String[] LOCKED_PACK_NAMES = {
        "Theone's Eating Animation Pack v1.0",
        "ToolTips-Stylized_v1.1_1.20+-1.21+",
        "§b§lVanilla Experience+§0"
    };

    @Inject(method = "disable", at = @At("HEAD"), cancellable = true)
    private void onDisable(String pack, CallbackInfoReturnable<Boolean> ci) {
        for (String locked : LOCKED_PACK_NAMES) {
            if (pack.equals(locked) || pack.equals(locked + ".zip")) {
                ci.setReturnValue(false);
                return;
            }
        }
    }
}
