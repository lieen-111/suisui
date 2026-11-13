/* 碎碎清单 Pro build switch.
   freeForTesters: true  → everything in Pro is unlocked for everyone; the price, checkout and redeem pages are still
                           there to try, but every payment is simulated and nothing is charged (test builds).
   Set it to false for a store release. Tests set window.SUISUI_PRO_CONFIG themselves before this file runs. */
window.SUISUI_PRO_CONFIG = window.SUISUI_PRO_CONFIG || { freeForTesters: true };
