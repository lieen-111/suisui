/* 碎碎清单 Pro build switch.
   Test builds (this file as it is): freeForTesters: true → all of Pro is unlocked; the checkout can be tried and
     runs against a stand-in server, so nothing is charged.
   Release builds: replace this whole file with the snippet from the admin page (server/ → 设置 → 接到 App 上):
     { freeForTesters: false, server: 'https://pay.your-domain.com', publicKey: { kty: 'EC', crv: 'P-256', x, y } }
     The app then sells Pro through that server and checks every unlock with the public key (works offline).
   Tests set window.SUISUI_PRO_CONFIG themselves before this file runs. */
window.SUISUI_PRO_CONFIG = window.SUISUI_PRO_CONFIG || { freeForTesters: true };
