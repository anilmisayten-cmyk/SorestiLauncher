package com.soresti.overlay;

import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.minecraft.client.option.KeyBinding;
import java.util.LinkedList;

public class ClickTracker {
    private static final LinkedList<Long> leftClicks = new LinkedList<>();
    private static final LinkedList<Long> rightClicks = new LinkedList<>();
    private static boolean prevLeft = false;
    private static boolean prevRight = false;

    private static final int[] cpsHistory = new int[60];
    private static int historyIndex = 0;
    private static int tickCounter = 0;

    public static void register() {
        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            KeyBinding atk = client.options.attackKey;
            KeyBinding use = client.options.useKey;

            boolean nowLeft = atk.isPressed();
            boolean nowRight = use.isPressed();

            long now = System.currentTimeMillis();
            if (nowLeft && !prevLeft) leftClicks.add(now);
            if (nowRight && !prevRight) rightClicks.add(now);

            prevLeft = nowLeft;
            prevRight = nowRight;

            while (!leftClicks.isEmpty() && now - leftClicks.peek() > 1000) leftClicks.poll();
            while (!rightClicks.isEmpty() && now - rightClicks.peek() > 1000) rightClicks.poll();

            tickCounter++;
            if (tickCounter >= 2) {
                tickCounter = 0;
                cpsHistory[historyIndex % cpsHistory.length] = leftClicks.size();
                historyIndex++;
            }
        });
    }

    public static int getLeftCPS() { return leftClicks.size(); }
    public static int getRightCPS() { return rightClicks.size(); }

    public static int[] getCpsHistory() { return cpsHistory; }
    public static int getHistoryIndex() { return historyIndex; }
}
