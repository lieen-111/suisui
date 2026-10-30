(() => {
  'use strict';
  const status = document.getElementById('offline-status');
  const update = document.getElementById('pwa-update');
  // Inside the Android app every file is bundled, so no service worker is needed.
  if (window.SuiSuiAndroid) {
    status.textContent = '安卓 App 版：内容已内置，离线可用';
    return;
  }
  if (!window.isSecureContext || !('serviceWorker' in navigator)) {
    status.textContent = '当前地址不支持离线使用';
    return;
  }

  let registration;
  let applyingUpdate = false;
  let ready = false;
  const renderStatus = () => {
    if (applyingUpdate) status.textContent = '正在更新';
    else if (registration?.waiting) status.textContent = '新版已就绪';
    else if (ready) status.textContent = navigator.onLine ? '已准备好，可离线使用' : '离线可用';
  };
  // Visible prompt in the header; the button in “关于” does the same.
  const chip = document.getElementById('update-chip');
  chip?.addEventListener('click', () => update.click());
  const showUpdate = () => {
    update.hidden = !registration.waiting;
    if (chip) chip.hidden = !registration.waiting;
    renderStatus();
  };
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (applyingUpdate) location.reload();
  });
  update.addEventListener('click', () => {
    if (!registration?.waiting) return;
    applyingUpdate = true;
    update.disabled = true;
    if (chip) chip.disabled = true;
    renderStatus();
    registration.waiting.postMessage({ type: 'ACTIVATE_UPDATE' });
  });
  window.addEventListener('online', renderStatus);
  window.addEventListener('offline', renderStatus);

  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(async value => {
    registration = value;
    showUpdate();
    const watchInstall = worker => {
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed') showUpdate();
        if (worker.state === 'redundant' && !ready) status.textContent = '离线准备失败，请联网后重新打开';
      });
    };
    watchInstall(registration.installing);
    registration.addEventListener('updatefound', () => watchInstall(registration.installing));
    await navigator.serviceWorker.ready;
    ready = true;
    renderStatus();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && navigator.onLine) registration.update().catch(() => {});
    });
  }).catch(() => {
    status.textContent = '离线准备失败，请联网后重新打开';
  });
})();
