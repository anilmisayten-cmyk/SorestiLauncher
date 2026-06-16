package com.soresti.overlay.mixin;

import net.minecraft.client.gui.widget.ButtonWidget;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Accessor;
import org.spongepowered.asm.mixin.Mutable;

@Mixin(ButtonWidget.class)
public interface ButtonWidgetAccessor {
    @Accessor("onPress")
    @Mutable
    void setOnPress(ButtonWidget.PressAction action);
}
