/* 碎碎清单 i18n (1.9): Chinese is the source language. In English the page's own text, attributes, toasts,
   canvas text and notifications are translated as they appear (MutationObserver), so app.js keeps one copy of
   its logic. User content (task titles, notes, group names you typed) is never translated.
   window.SuiSuiI18n.setLang('en'|'zh') is called by app.js once settings are loaded. */
(() => {
  'use strict';
  const D = {
    // brand & navigation
    '碎碎清单': 'SuiSui', '碎碎清单首页': 'SuiSui home', '主导航': 'Main navigation', '清单': 'List', '设置': 'Settings', '回顾': 'Review', '关于': 'About', '关于碎碎清单': 'About SuiSui',
    '搜索': 'Search', '搜索待办': 'Search to-dos', '搜索待办、备注、子任务、历史': 'Search to-dos, notes, subtasks, history', '取消': 'Cancel', '完成': 'Done', '关闭': 'Close', '编辑': 'Edit', '删除': 'Delete', '撤销': 'Undo', '添加': 'Add', '分享': 'Share', '保存图片': 'Save image', '知道了': 'Got it', '知道了，不再显示': "Got it, don't show again",
    '周 / 月回顾': 'Weekly / monthly review', '返回清单': 'Back to list', '返回设置': 'Back to settings', '设置分类': 'Settings sections',
    '有新版本，点此更新': 'New version — tap to update', '更新应用': 'Update app',
    // today & list
    '今天': 'Today', '明天': 'Tomorrow', '以后': 'Later', '已完成': 'Done', '历史': 'History', '全部': 'All', '重复': 'Repeat', '全部待办': 'All to-dos', '筛选分组': 'Filter groups',
    '今天的待办': "Today's to-dos", '今天，留一点空白。': 'Today, leave a little space.', '今天从一件小事开始。': 'Start today with one small thing.', '都完成了，给自己一点空白。': 'All done. Give yourself some space.', '今天的事，圆满完成。': "Today's done. Well done.", '又完成一件。': 'One more done.',
    '这个分组今天没有待办': 'Nothing in this group today', '今天要做的重复事项都做完了': "Today's repeating tasks are all done", '暂无待办': 'Nothing to do',
    '从第一件小事开始': 'Start with one small thing', '点下面的 + 写下今天想做的事。': 'Tap + below to write down something for today.', '需要专注的事可以设个时长，点开始就倒计时。': 'Give focus tasks a duration and tap start to count down.', '添加第一件': 'Add the first one',
    '三个手势就够了': 'Three gestures are enough', '点圆圈完成，点文字编辑；右滑完成，左滑删除，删错了能撤销。': 'Tap the circle to finish, tap the text to edit; swipe right to finish, left to delete — you can undo.',
    '已完成的事项会在第二天自动移入历史': 'Finished items move to history the next day', '现在移入历史': 'Move to history now', '放回待办': 'Back to to-dos', '恢复待办': 'Restore', '下次该做时自动重新出现': 'Comes back when it is due again',
    '所有每天、工作日、每周重复的事': 'Everything that repeats daily, on weekdays or weekly', '有备注': 'Has a note', '置顶': 'Pin', '保存在本机': 'Saved on this device', '恢复示例': 'Restore samples',
    '专注中': 'Focusing', '暂停计时': 'Pause timer', '继续计时': 'Resume timer', '结束计时': 'Stop timer', '完成这件事': 'Finish this', '标记完成': 'Mark done', '明天再做': 'Do it tomorrow', '改到今天': 'Move to today',
    // add sheet
    '添加待办': 'Add to-do', '新的待办事项': 'New to-do', '想做什么？例如：明天下午3点 开会': 'What to do? e.g. meeting tomorrow 3pm', '保留原文': 'Keep as typed', '请先写下待办内容。': 'Write the to-do first.', '请选择一个日期。': 'Pick a date.',
    '日期': 'Date', '提醒': 'Remind', '时长': 'Duration', '分组': 'Group', '选日期': 'Pick date', '指定日期': 'Pick a date', '不重复': 'Never', '每天': 'Daily', '工作日': 'Weekdays', '每周': 'Weekly', '不提醒': 'None', '自定': 'Custom', '提醒时间': 'Reminder time', '不计时': 'None', '自定分钟': 'Custom minutes', '分钟': 'min', '选时间': 'Pick time', '其他日期': 'Other day', '从哪天': 'Starts', '按重复出现': 'By repeat', '每天出现': 'Every day',
    // edit sheet
    '编辑待办': 'Edit to-do', '待办内容': 'To-do', '备注': 'Note', '添加备注': 'Add a note', '子任务': 'Subtasks', '添加子任务': 'Add subtask', '删除这件事': 'Delete this', '工作': 'Work', '生活': 'Life', '学习': 'Study',
    // review
    '每月': 'Monthly', '周期': 'Period', '上一段': 'Previous', '下一段': 'Next', '件完成': 'done', '分钟专注': 'min focus', '小时专注': 'h focus', '天有完成': 'days active', '每天完成': 'Done per day', '分组占比': 'By group', '做了什么': 'What got done', '导出成图片': 'Export image', '回顾图片': 'Review image', '本周': 'This week', '上周': 'Last week', '本月': 'This month', '上月': 'Last month', '每周回顾': 'Weekly review', '每月回顾': 'Monthly review', '本周回顾': 'This week', '上周回顾': 'Last week', '本月回顾': 'This month', '上月回顾': 'Last month', '这段时间还没有完成记录': 'Nothing finished in this period yet', '日': 'Sun', '一': 'Mon', '二': 'Tue', '三': 'Wed', '四': 'Thu', '五': 'Fri', '六': 'Sat',
    // settings home
    '外观': 'Appearance', '锁屏': 'Lock screen', '数据': 'Data', '语言 · Language': 'Language · 语言', '语言 Language': 'Language', '语言': 'Language', '仅本机': 'On device', '外观与锁屏卡片': 'Appearance and lock card', '锁屏预览': 'Lock preview', '已开启': 'On', '未开启': 'Off', '隐藏内容': 'Hidden',
    '切换后界面、提示、日期和锁屏卡片一起换。你写下的待办内容不会被翻译。': "The interface, tips, dates and lock card switch together. Your own to-dos are not translated.", '简体中文': '简体中文',
    '锁屏与隐私': 'Lock screen & privacy', '分组与每日整理': 'Groups & daily tidy', '数据与备份': 'Data & backup',
    // look page
    'App 界面': 'App', '界面风格': 'Style', '玻璃': 'Glass', '纸墨': 'Paper', '夜光': 'Night', '壁纸铺底，通透': 'Your wallpaper, frosted', '米白纸，大号日期': 'Warm paper, big date', '深色，荧光色': 'Dark with neon', '配色': 'Colour', 'App 配色': 'App colour',
    '墨黑': 'Ink', '暖橙': 'Orange', '靛蓝': 'Indigo', '莓果': 'Berry', '松绿': 'Pine', '荧光': 'Neon', '雾白': 'Mist', '湖蓝': 'Lake', '梅紫': 'Plum', '松林': 'Forest', '石墨': 'Graphite', '自定义': 'Custom',
    '字体与字号': 'Font & size', '字体': 'Font', '字号': 'Text size', '默认': 'Default', '宋体': 'Serif', '楷体': 'Kai', '圆体': 'Rounded', '小': 'Small', '标准': 'Standard', '大': 'Large', '特大': 'Extra large', 'Aa 碎碎': 'Aa Sui',
    '清单、锁屏卡片和预览一起变化。字体用的是手机自带的，没有的会自动换成最接近的。': "The list, lock card and preview change together. Fonts come with your phone; missing ones fall back to the closest.",
    '锁屏卡片': 'Lock card', '卡片样式': 'Card style', '锁屏卡片样式': 'Lock card style', '锁屏显示条数': 'Rows on the lock screen', '锁屏清单密度': 'Lock list density', '舒适 · 3 条': 'Comfortable · 3', '紧凑 · 4 条': 'Compact · 4',
    '预览壁纸': 'Preview wallpaper', '壁纸库': 'Wallpapers', '用自己的照片': 'Use my photo', '我的照片': 'My photo', '我的照片壁纸': 'My photo', '用 iPhone 自带的': "Use the iPhone's own",
    '网页读不到手机壁纸，这里只影响预览。可以选一张和你锁屏一样的照片来对照。': "A web page can't read your phone wallpaper; this only changes the preview. Pick a photo like your lock screen to compare.",
    '湖畔': 'Lakeside', '黑白': 'Mono', '晨雾': 'Mist', '暮山': 'Dusk', '深林': 'Forest', '海面': 'Sea', '月夜': 'Moonlit', '极光': 'Aurora', '沙丘': 'Dunes', '山间湖泊': 'Mountain lake', '手机壁纸': 'Phone wallpaper',
    '更多卡片设置': 'More card settings', '材质': 'Material', '待办框': 'Card', '待办框材质': 'Card material', '磨砂': 'Frosted', '柔和模糊': 'Soft blur', '通透反光': 'Clear, glossy', '平面': 'Flat', '纯色干净': 'Solid colour', '颜色': 'Colour', '待办框颜色': 'Card colour', '自定义颜色': 'Custom colour', '自定义待办框颜色': 'Custom card colour', '透明度': 'Transparency', '待办框透明度': 'Card transparency', '文字': 'Text', '文字颜色': 'Text colour', '自动': 'Auto', '浅色字': 'Light', '深色字': 'Dark',
    '完成反馈': 'Finish feedback', '碎裂动画': 'Shatter animation', '完成时文字碎开再划线': 'Text shatters, then strikes through', '碎裂幅度': 'Shatter strength', '轻': 'Light', '适中': 'Medium', '强': 'Strong', '恢复默认外观': 'Reset appearance', '实时预览': 'Live preview', '和手机锁屏上的样子一致': 'Matches your lock screen', '查看全部': 'See all', '全部清单': 'Full list', '解锁查看': 'Unlock to see', '锁屏卡片预览': 'Lock card preview', '待办清单，可上下滚动': 'To-do list, scrolls',
    // lock page
    '锁屏提醒': 'Lock screen', '离开应用时，把待办放到锁屏通知': 'Put to-dos in a lock-screen notification when you leave', '立即刷新锁屏通知': 'Refresh lock notification now', '锁屏隐藏待办内容': 'Hide to-dos on the lock screen',
    '开启后，锁屏上只显示“还有几件”，内容要解锁后才能看到和勾选。别人拿到你的手机时更安心。': 'The lock screen then shows only how many are left; unlock to see and tick them.',
    '开启后，离开应用时把未完成事项放到锁屏通知里。点通知回到清单（通知里不能直接勾选）。': "When you leave the app, open items go into a lock-screen notification. Tap it to come back (it can't tick items).",
    '亮屏直接显示碎碎清单锁屏（推荐）': 'Show the SuiSui lock screen on wake (recommended)', '亮屏就能看到今天的待办': "See today's to-dos as soon as the screen wakes",
    '亮屏时先看到碎碎清单的锁屏：壁纸、时钟和今天的待办，点圆圈直接完成，上滑进入手机。需要打开下面几项权限，完成后回到这里会自动打勾。': "On wake you first see SuiSui's lock screen — wallpaper, clock and today's to-dos; tap a circle to finish, swipe up to unlock. Turn on the permissions below; they tick themselves when done.",
    '让碎碎清单出现在锁屏': 'Let SuiSui appear on the lock screen', '熄屏时把碎碎清单放到锁屏前面。': 'Puts SuiSui in front when the screen turns off.', '显示在其他应用上层': 'Display over other apps',
    '第二种调出锁屏的方式（闹钟类 App 用的同一种），直接启动被系统拦下时由它补上。': 'A second way to show the lock screen (the one alarm apps use), for when a direct start is blocked.',
    '全屏通知': 'Full-screen notifications', '不限制电池': 'Unrestricted battery', '让系统不要在后台关掉碎碎清单，否则熄屏后经常不出现。': "Stops the system closing SuiSui in the background; otherwise it often won't appear.",
    '用来在锁屏常驻待办卡片，并让锁屏服务保持运行。': 'Keeps the to-do card on the lock screen and the lock service running.', '允许通知': 'Allow notifications', '通知': 'Notifications', '去开启': 'Turn on', '检查锁屏权限': 'Check lock permissions', '打开权限页': 'Open permissions', '打开通知权限': 'Open notification settings',
    '锁屏显示、后台弹出界面、省电无限制': 'Show on lock screen, pop up in background, no battery limits',
    '小米、红米、OPPO、vivo、荣耀等手机还需要在应用权限里手动打开这几项，否则锁屏可能不出现或被系统关掉。': 'Xiaomi, Redmi, OPPO, vivo, Honor and similar phones also need these switched on in app permissions, or the lock screen may not appear.',
    '还差权限：点“检查锁屏权限”，按提示打开。': 'Permissions missing: tap “Check lock permissions” and follow the steps.', '设置好了，熄屏后再亮屏看看': 'All set — turn the screen off and on to try',
    '已开启。熄屏后再亮屏试试；若没出现，点“检查锁屏权限”，按品牌打开“锁屏显示”和“后台弹出界面”。': 'On. Turn the screen off and on; if nothing shows, tap “Check lock permissions”.',
    '已开启：锁屏上常驻今天的待办，点“✓”即可完成。若锁屏看不到，请在系统设置里允许碎碎清单在锁屏显示通知。': "On: today's to-dos stay on the lock screen; tap “✓” to finish. If you can't see them, allow SuiSui notifications on the lock screen.",
    '已开启。每次离开碎碎清单，锁屏通知会更新为最新的未完成事项；全部完成后自动移除。': 'On. Each time you leave, the lock notification updates; it goes away when everything is done.',
    '在锁屏显示今天的待办（实时活动）': "Show today's to-dos on the lock screen (Live Activity)", '开启后，锁屏和灵动岛上显示今天的待办，点圆圈直接完成。': "Shows today's to-dos on the lock screen and Dynamic Island; tap a circle to finish.",
    '已开启：锁屏和灵动岛上显示今天的待办，点圆圈直接完成。系统限制每次最多显示 8 小时，打开碎碎清单会自动续上。': 'On: shown on the lock screen and Dynamic Island. iOS allows 8 hours at a time; opening SuiSui renews it.',
    '实时活动在系统里被关闭了：设置 > 碎碎清单 > 实时活动，打开后回来再开。': 'Live Activities are off in Settings > SuiSui > Live Activities. Turn them on, then come back.',
    '还可以把小组件放到锁屏：长按锁屏 → 自定 → 锁定屏幕 → 添加小组件 → 碎碎清单。点圆圈直接完成，不用解锁进应用。': 'You can also add the widget: long-press the lock screen → Customize → Lock Screen → Add Widgets → SuiSui. Tap a circle to finish without unlocking.',
    '到点提醒与计时通知': 'Reminders and timer alerts', '设了提醒时间的待办会到点通知你。第一次设置提醒时会请求通知权限。': 'To-dos with a reminder time notify you on time. The first reminder asks for permission.',
    '已允许：到点提醒和计时结束会准时通知你，通知里能直接点“完成”。': 'Allowed: reminders and timers notify you on time, with a “Done” button.', '通知权限已被拒绝。请到系统设置 > 通知 > 碎碎清单 中打开。': 'Notifications are blocked. Turn them on in Settings > Notifications > SuiSui.',
    '隐私': 'Privacy', '隐私政策': 'Privacy policy', '意见反馈': 'Feedback',
    // list & data pages
    '每日整理': 'Daily tidy', '每天自动把前一天完成的事移入历史': "Move yesterday's finished items to history automatically", '重复的事项（每天、工作日、每周）完成后，到下一次该做的那天会自动回到待完成。': 'Repeating items (daily, weekdays, weekly) come back on the next day they are due.',
    '新建分组': 'New group', '分组名称': 'Group name', '删除分组': 'Delete group', '至少保留一个分组': 'Keep at least one group',
    '导出备份': 'Export backup', '导入备份': 'Import backup', '合并': 'Merge', '替换当前清单': 'Replace current list', '取消导入': 'Cancel import', '同时导入外观设置': 'Also import appearance', '这个文件不是有效的 JSON 备份。': 'This file is not a valid JSON backup.',
    '待办只保存在这台设备上，没有上传到任何服务器。换手机或清除网站数据前，请先导出备份。': 'To-dos stay on this device and are never uploaded. Export a backup before changing phones or clearing site data.',
    '没有账号，没有服务器，待办只保存在你的手机里。可以在“设置”里开启“锁屏隐藏待办内容”。换手机前请导出备份。': 'No account, no server: your to-dos live only on your phone. Export a backup before changing phones.',
    // about & install
    '亮屏就能看到的待办清单：完成时碎裂、划线后排到最后。可离线使用。': 'A to-do list you see as soon as the screen wakes. Works offline.', '遇到问题或有想法，欢迎': 'Problems or ideas? You are welcome to', '在这里留言': 'leave a note here',
    '安卓 App 版：内容已内置，离线可用': 'Android app: everything is built in and works offline', 'iPhone App 版：内容已内置，离线可用': 'iPhone app: everything is built in and works offline', '已准备好，可离线使用': 'Ready to use offline', '正在检查离线可用状态': 'Checking offline readiness',
    '安卓 App：熄屏后再亮屏，先看到碎碎清单的锁屏，点圆圈完成，上滑进入手机；也可以只用锁屏通知卡片。iPhone：添加到主屏幕后可开启锁屏通知；原生版提供锁屏小组件。': 'Android app: wake the screen to see SuiSui first; tap a circle to finish, swipe up to unlock — or use only the notification card. iPhone: add to Home Screen for lock notifications; the app adds lock-screen widgets.',
    '添加到主屏幕': 'Add to Home Screen', '添加到主屏幕再使用': 'Add to Home Screen first', '数据保存更稳定，还能在锁屏通知里看到待办。': 'Data is kept more reliably and you can see to-dos in a lock notification.', '安装': 'Install', '怎么添加': 'How', '暂不添加': 'Not now', 'iPhone 安装': 'Install on iPhone', '关闭说明': 'Close guide', '关闭通知': 'Close',
    '打开本页（微信、小红书里请先点右上角，选择“在浏览器打开”）。': 'Open this page (in WeChat or Xiaohongshu, tap ··· and choose “Open in browser”).', '点底部或地址栏旁的': 'Tap', '向下找到': 'scroll to', '；若看到“作为网页 App 打开”，保持开启。': '; keep “Open as Web App” on if you see it.',
    '以后从桌面的“碎碎清单”图标打开。第一次打开请保持联网，等“关于”里显示可离线使用。': 'From now on open SuiSui from its Home Screen icon. Stay online the first time until About says it works offline.',
    '从桌面图标打开的碎碎清单与 Safari 里的网页，数据彼此独立。请从图标开始正式记录。': 'The Home Screen app and the Safari page keep separate data. Start recording from the icon.', '需要先“添加到主屏幕”，再从桌面图标打开（iOS 16.4 及以上）。': 'Add to Home Screen first, then open from the icon (iOS 16.4+).',
    '按钮': 'button', '快乐体': 'Playful', '黄油体': 'Butter', '手写体': 'Handwriting', '清单、锁屏卡片和预览一起变化。宋体、楷体、圆体用手机自带的；快乐体、黄油体、手写体是内置的，第一次显示时会稍慢一点。': 'The list, lock card and preview change together. Serif, Kai and Rounded come with your phone; Playful, Butter and Handwriting are built in and take a moment the first time.', '分组图标': 'Group icon', '选择图标': 'Choose icon', '不用图标': 'No icon', '打开清单': 'Open list', '上滑或轻点进入手机': 'Swipe up or tap to unlock', '锁屏通知': 'Lock notification', '锁屏卡片': 'Lock card', '实时活动 · 锁屏小组件': 'Live Activity · widgets', '可以搜标题、备注、子任务，也能搜到历史里完成过的事。': 'Search titles, notes and subtasks — finished items in history too.', '待完成': 'To do', '今天已完成': 'Done today',
    // toasts
    '待办已添加': 'To-do added', '已保存修改': 'Saved', '已删除待办': 'To-do deleted', '已完成一项待办': 'One to-do done', '已恢复到待完成': 'Back to to-do', '已暂停计时': 'Timer paused', '已暂停': 'Paused', '已结束计时': 'Timer stopped', '已调整顺序': 'Order changed', '已置顶': 'Pinned', '已取消置顶': 'Unpinned', '已改到今天': 'Moved to today', '已移到明天': 'Moved to tomorrow', '已放回今天': 'Back to today',
    '已导出待办备份': 'Backup exported', '没有导出': 'Not exported', '已生成备份，可存到“文件”': 'Backup ready — save it to Files', '导出失败，请重试': 'Export failed, try again', '备份文件过大（超过 2MB）': 'Backup file too large (over 2 MB)', '未能读取这个文件': "Couldn't read this file", '已合并备份': 'Backup merged', '已用备份替换清单': 'List replaced with backup', '已恢复示例清单': 'Samples restored', '已恢复默认外观': 'Appearance reset',
    '图片已保存': 'Image saved', '保存失败，请长按图片保存': 'Save failed — long-press the image to save', '已保存到相册（图片 / 碎碎清单）': 'Saved to Photos (SuiSui)', '没有保存': 'Not saved', '预览页不能下载文件，请在正式网站导出': "The preview can't download files; export from the real site",
    '已开启锁屏通知，离开应用后生效': 'Lock notification on — it shows when you leave the app', '已刷新锁屏通知，锁屏即可看到': 'Lock notification refreshed', '全部完成，没有需要提醒的事项': 'All done — nothing to show', '没有获得通知权限': 'Notification permission not granted', '没有通知权限，锁屏卡片无法显示': "Without notification permission the lock card can't show",
    '已开启锁屏显示，熄屏后再亮屏看看': 'Lock screen on — turn the screen off and on', '已关闭锁屏显示': 'Lock screen off', '已开启锁屏待办卡片': 'Lock card on', '已关闭锁屏待办卡片': 'Lock card off', '已在锁屏显示今天的待办': "Today's to-dos are on the lock screen", '已从锁屏移除': 'Removed from the lock screen',
    '锁屏上只显示数量，解锁后才能看到内容': 'The lock screen shows only the count', '锁屏上会显示待办内容': 'The lock screen shows your to-dos', '重复的事项会在下次该做时自动重置，不需要清理': 'Repeating items reset by themselves when due', '已从锁屏完成': 'Finished from the lock screen'
  };
  const DAYS = { 周日: 'Sun', 周一: 'Mon', 周二: 'Tue', 周三: 'Wed', 周四: 'Thu', 周五: 'Fri', 周六: 'Sat' };
  const word = s => D[s] ?? s;
  const R = [
    [/^(.*) · 还有 (\d+) 件，完成 (\d+) 件$/, (_, a, b, c) => `${a} · ${b} left, ${c} done`],
    [/^(.*) · (\d+) 件都完成了$/, (_, a, b) => `${a} · all ${b} done`],
    [/^(.*) · 给今天留一件想做的事$/, (_, a) => `${a} · add one thing for today`],
    [/^今天 · (\d+)\/(\d+)$/, (_, a, b) => `Today · ${a}/${b}`],
    [/^剩余 (\d+) 项 · 已完成 (\d+) 项$/, (_, a, b) => `${a} left · ${b} done`],
    [/^全部完成 · (\d+) 项$/, (_, a) => `All ${a} done`],
    [/^碎碎清单 · (\d+) 项待完成$/, (_, a) => `SuiSui · ${a} to do`],
    [/^今天还有 (\d+) 件待办$/, (_, a) => `${a} left today`],
    [/^今天的事都完成了$/, () => 'All done for today'],
    [/^(.*) · 还有 (\d+) 件$/, (_, a, b) => `${a} · ${b} left`], [/^(.*) · 都完成了$/, (_, a) => `${a} · all done`], [/^(.*) · 还没有待办$/, (_, a) => `${a} · nothing yet`],
    [/^(完成|恢复|删除|放回待办|取消完成|删除子任务|暂停计时|继续计时)：(.+)$/s, (_, a, b) => `${{ 完成: 'Finish', 恢复: 'Restore', 删除: 'Delete', 放回待办: 'Back to to-dos', 取消完成: 'Not done', 删除子任务: 'Delete subtask', 暂停计时: 'Pause', 继续计时: 'Resume' }[a]}: ${b}`],
    [/^编辑：(.+)（(.+)）$/s, (_, a, b) => `Edit: ${a} (${word(b)})`],
    [/^删除分组：(.+)$/, (_, a) => `Delete group: ${word(a)}`],
    [/^(.+)的颜色$/, (_, a) => `${word(a)} colour`], [/^颜色 (#\w+)$/, (_, a) => `Colour ${a}`],
    [/^(.+)壁纸$/, (_, a) => `${word(a)} wallpaper`],
    [/^开始计时 (.+)：(.+)$/s, (_, a, b) => `Start ${tr(a)}: ${b}`], [/^开始计时：(.+) · (.+)$/s, (_, a, b) => `Timer started: ${a} · ${tr(b)}`], [/^开始计时 · (.+)$/, (_, a) => `Start · ${tr(a)}`],
    [/^时间到：(.+)$/s, (_, a) => `Time's up: ${a}`],
    [/^(\d+)分钟$/, (_, a) => `${a} min`], [/^(\d+)分$/, (_, a) => `${a}m`], [/^(\d+)小时$/, (_, a) => `${a} h`], [/^(\d+)小时(\d+)分$/, (_, a, b) => `${a} h ${b} min`],
    [/^(\d+) 个$/, (_, a) => `${a}`], [/^(\d+)\s*个$/, (_, a) => a],
    [/^每(周[日一二三四五六])$/, (_, a) => `Every ${DAYS[a]}`],
    [/^已识别：(.+)$/, (_, a) => `Recognized: ${a.split(' · ').map(tr).join(' · ')}`],
    [/^(\d\d:\d\d) 提醒$/, (_, a) => `remind ${a}`],
    [/^已添加到“以后”：(.+)$/, (_, a) => `Added to Later: ${tr(a)}`],
    [/^已保存，(.+)出现$/, (_, a) => `Saved — shows up ${tr(a)}`],
    [/^已删除“(.+?)”(?:，(\d+) 件移到“(.+)”)?$/, (_, a, n, b) => `Deleted “${word(a)}”${n ? `, ${n} moved to “${word(b)}”` : ''}`],
    [/^已把 (\d+) 件移入历史$/, (_, a) => `Moved ${a} to history`],
    [/^新的一天：(.+)$/, (_, a) => `New day: ${a.split('，').map(x => x.replace(/^(\d+) 件已完成移入历史$/, '$1 finished moved to history').replace(/^(\d+) 件重复事项已重置$/, '$1 repeating reset')).join(', ')}`],
    [/^锁屏卡片已换成“(.+)”$/, (_, a) => `Lock card: ${word(a)}`],
    [/^已过期 · (.+)$/, (_, a) => `Overdue · ${a}`],
    [/^(.+) (\d+) · (\d+)%$/, (_, a, b, c) => `${word(a)} ${b} · ${c}%`],
    [/^\/ (\d+) 天有完成$/, (_, a) => `/ ${a} days active`],
    [/^(.+) · (\d+) 件$/, (_, a, b) => `${a} · ${b}`],
    [/^备份里有 (\d+) 件待办(?:、(\d+) 条历史)?。合并会加入其中 (\d+) 件新的事项；替换会用备份覆盖当前清单。$/, (_, a, h, c) => `The backup has ${a} to-dos${h ? ` and ${h} history items` : ''}. Merge adds ${c} new ones; Replace overwrites the current list.`],
    [/^最近 (\d+) 次熄屏，碎碎清单锁屏出现了 (\d+) 次。(.*)$/, (_, a, b, c) => `SuiSui showed on ${b} of the last ${a} wakes.${c ? ' If some were missed, turn on “Unrestricted battery” in “Check lock permissions”.' : ''}`],
    [/^碎碎清单 ([\d.]+) · 湖畔照片来自 Unsplash，其余壁纸为碎碎清单原创$/, (_, a) => `SuiSui ${a} · Lake photo from Unsplash; other wallpapers are original`],
    [/^亮屏就能看到、能勾选的待办 · ([\d.]+)$/, (_, a) => `To-dos you can see and tick on wake · ${a}`],
    [/^(玻璃|纸墨|夜光) · (.+)$/, (_, a, b) => `${word(a)} · ${word(b)}`],
    [/^生成于 (.+)$/, (_, a) => `Made ${a}`],
    [/^没有找到“(.+)”$/, (_, a) => `Nothing found for “${a}”`],
    [/^(\d+)\s*件$/, (_, a) => a]
  ];
  function tr(s) {
    if (lang !== 'en' || !s || !/[\u4e00-\u9fff]/.test(s)) return s;
    const k = s.trim();
    let out = D[k];
    if (out === undefined) for (const [re, fn] of R) { if (re.test(k)) { out = k.replace(re, fn); break; } }
    return out === undefined ? s : s.replace(k, out);
  }
  // User content is never translated (titles, notes, group names you typed, search results).
  const USER = '.task-title,.lock-task-label,.mini-row-label,.done-text,.completed-title,.subtask span,.subtask input,.rt-title,.sub-title,.archive-title,#home-card-rows,.quick-title,.focus-text strong,.group-name,[data-user]';
  const ATTRS = ['aria-label', 'placeholder', 'title', 'alt'];
  let lang = 'zh', observer = null;
  function fixNode(n) {
    if (n.nodeType === 3) {
      const p = n.parentElement;
      if (!p || p.closest('script,style') || p.closest(USER)) return;
      const v = tr(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v;
    } else if (n.nodeType === 1) {
      for (const a of ATTRS) { const v = n.getAttribute(a); if (v) { const t = tr(v); if (t !== v) n.setAttribute(a, t); } }
      if (n.tagName === 'A' && n.getAttribute('href') === 'privacy.html') n.setAttribute('href', 'privacy.html#en');
    }
  }
  function walk(root) {
    fixNode(root);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    for (let n = w.nextNode(); n; n = w.nextNode()) fixNode(n);
  }
  function patchOutputs() {
    // Canvas (review poster) and notifications get the same translation.
    const fill = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, ...rest) { return fill.call(this, typeof text === 'string' ? tr(text) : text, ...rest); };
    const measure = CanvasRenderingContext2D.prototype.measureText;
    CanvasRenderingContext2D.prototype.measureText = function (text) { return measure.call(this, typeof text === 'string' ? tr(text) : text); };
    if (window.Notification) {
      const N = window.Notification;
      const Wrapped = function (title, opts = {}) { return new N(tr(title), { ...opts, body: opts.body && tr(opts.body) }); };
      Object.setPrototypeOf(Wrapped, N); Wrapped.prototype = N.prototype;
      Object.defineProperty(Wrapped, 'permission', { get: () => N.permission });
      window.Notification = Wrapped;
    }
    if (window.ServiceWorkerRegistration?.prototype.showNotification) {
      const show = ServiceWorkerRegistration.prototype.showNotification;
      ServiceWorkerRegistration.prototype.showNotification = function (title, opts = {}) { return show.call(this, tr(title), { ...opts, body: opts.body && opts.body.split('\n').map(tr).join('\n') }); };
    }
  }
  function setLang(next) {
    lang = next === 'en' ? 'en' : 'zh';
    document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
    if (lang !== 'en') return;
    if (!observer) {
      patchOutputs();
      walk(document.body); document.title = tr(document.title);
      observer = new MutationObserver(list => {
        for (const m of list) {
          if (m.type === 'characterData') fixNode(m.target);
          else if (m.type === 'attributes') fixNode(m.target);
          else m.addedNodes.forEach(n => (n.nodeType === 1 ? walk(n) : fixNode(n)));
        }
      });
      observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    }
  }
  window.SuiSuiI18n = { setLang, t: tr, get lang() { return lang; }, dictionary: D };
})();
