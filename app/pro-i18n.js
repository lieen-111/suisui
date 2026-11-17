/* 碎碎清单 Pro — English for the Pro layer. Chinese stays the source; this only adds entries to i18n.js
   (window.SuiSuiI18n.dictionary for whole text nodes, .rules for text with numbers in it), so pro.js and
   pro-skins.js keep one copy of their logic. The 昼 copybook characters are the picture itself and stay Chinese. */
(() => {
  'use strict';
  const I = window.SuiSuiI18n; if (!I || !I.dictionary) return;
  const NAME = { 晨: 'Dawn', 昼: 'Day', 夜: 'Night', 晕: 'Bloom', 印: 'Riso', 屋: 'Room', 毛: 'Fluff' };
  const FULL = { '琉璃': 'Prism', '素笺': 'Washi', '星河': 'Nocturne', '洇色': 'Aquarelle', '套色': 'Overprint', '小筑': 'Haven', '绒绒': 'Velvet', '随光': 'Daylight' };
  const WEEK = { 日: 'Sun', 一: 'Mon', 二: 'Tue', 三: 'Wed', 四: 'Thu', 五: 'Fri', 六: 'Sat' };
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const full = s => FULL[s] || s;
  Object.assign(I.dictionary, FULL, {
    // themes
    '一只量杯，做完一件，满一点': 'A measuring glass that fills a little with each task', '稿纸一格一个字，做完画个红圈': 'One character per square; a red circle when you finish',
    '每件事一颗星，做完连成星座': 'Each task is a star; finish and they join into a constellation', '每做完一件，滴一滴颜色，慢慢晕开': 'Each finished task drops a colour that slowly spreads',
    '每做完一件，房间里添一件家具': 'Each finished task adds a piece of furniture', '做完一件多画一层毛，全做完它睁眼': 'Each task adds a layer of fur; finish them all and it opens its eyes',
    '每做完一件，印上一张小插画': 'Each finished task prints a little picture',
    '跟随时间': 'Follow the time', '晨 5 点，昼 10 点，夜 18 点': 'Dawn from 5, Day from 10, Night from 18', '现在是': 'Now',
    '使用中': 'In use', '使用': 'Use', '试穿': 'Try on', '换回': 'Switch back', '解锁': 'Unlock', 'Pro 主题': 'Pro themes',
    // effects
    '跟随主题': 'Match theme', '碎裂': 'Shatter', '流光': 'Light trail', '墨染': 'Ink', '纸飞机': 'Paper plane', '点阵': 'Dots', '金箔': 'Gold leaf',
    '按主题的材质碎开': "Breaks in the theme's material", '化成一缕光': 'Turns into a thread of light', '墨晕开，落一点红': 'Ink spreads, a dot of red',
    '折成纸飞机飞走': 'Folds into a paper plane', '散成一粒粒点': 'Scatters into dots', '金箔慢慢飘落': 'Gold leaf drifts down', '完成动效': 'Finish effect',
    '完成一件事试试效果': 'Finish a task to see it',
    // Pro page
    '碎碎清单 Pro': 'SuiSui Pro', '主题、碎片罐、完成动效': 'Themes, the shard jar, finish effects', '主题、碎片罐、动效都已打开': 'Themes, jar and effects are on',
    '已解锁': 'Unlocked', '每做完一件事，都变成一片光，收进你的碎片罐。': 'Every finished task becomes a shard of light in your jar.',
    '七套完整主题、七种完成动效与每周碎片画。': 'Seven complete themes, seven finish effects and a weekly picture.', '一次购买，永久使用；此后上线的新主题同样包含在内。': 'Pay once, keep it forever — future themes included.', '每套主题同时改变 App 界面、锁屏卡片与完成动效，当天全部完成时生成专属画面。左右滑动查看，点击「查看界面」预览。': 'Each theme changes the app, the lock card and the finish effect, and draws its own picture when the day is done. Swipe to browse; tap “See it” to preview.', '完成动效': 'Finish effects', '完成一件事时的反馈。点击圆圈即可预览；选择「跟随主题」时，由当前主题决定。': 'What finishing looks like. Tap the circle to preview; “Follow theme” lets the theme decide.', '碎片罐与每周碎片画': 'The shard jar and a weekly picture', '每天完成的事项收进碎片罐；每周结束时，按完成时间与分组生成一幅画，可保存为图片。': 'What you finish goes into the jar; at the end of each week it becomes a picture by time and group, ready to save.', '在「今天」页点击碎片罐即可查看。': 'Tap the jar on Today to open it.', '图示为演示数据。': 'Shown with sample data.', '同样包含': 'Also included', '考试、生日、出发等重要日子，显示在清单与锁屏上': 'Exams, birthdays, trips — on the list and the lock screen', '当天事项全部完成时，播放专属庆祝动画': 'A celebration when everything is done for the day', '后续新主题': 'Future themes', '此后上线的主题，无需再次付费': 'Themes released later, at no extra cost', '首发价': 'Launch price', 'Pro 已开通，感谢支持。': 'Pro is on. Thank you!', '可在其他设备上开通': 'works on your other devices', '通过 App Store 购买': 'Bought on the App Store', '兑换码开通': 'Unlocked with a code', '购买须知': 'Purchase terms', '隐私政策': 'Privacy', '开通 Pro': 'Get Pro', 'Pro 已开通': 'Pro is on', '扫码付款': 'Pay by QR code', '等待确认': 'Waiting for confirmation', '填写爱发电订单号': 'Enter your afdian order number', '使用兑换码': 'Or use a code', '一次购买，永久使用': 'Pay once, keep it forever', '正在读取价格…': 'Loading the price…', '重新加载': 'Try again', '保存二维码到相册': 'Save the QR code to Photos', '打开微信或支付宝「扫一扫」，从相册选取这张二维码。': 'Open Scan in WeChat or Alipay and pick this QR code from your photos.', '付款完成后，点击下方「我已付款」。': 'When you have paid, tap “I have paid” below.', '我已付款': 'I have paid', '已开通': 'On', '支付宝扫码付款': 'Pay with Alipay', '打开支付宝「扫一扫」，从相册选取这张二维码。': 'Open Scan in Alipay and pick this QR code from your photos.', '打开微信「扫一扫」，从相册选取这张二维码。': 'Open Scan in WeChat and pick this QR code from your photos.', '复制': 'Copy', '刷新状态': 'Check again', '查看付款码': 'Show the QR code', '正在等待确认': 'Waiting for confirmation', '没有核对到这笔付款': 'We could not find this payment', '我们核对到账后会立即为你开通，通常需要几分钟。可以先关闭此页面，开通后自动生效。': 'Pro turns on as soon as we see the payment, usually within minutes. You can close this; it unlocks by itself.', '在爱发电完成付款后，打开订单详情，复制「订单号」粘贴到这里。': 'After paying on afdian, open the order and paste its order number here.', '验证': 'Check', '还没付款？前往爱发电': 'Not paid yet? Go to afdian', '已在爱发电付款？填写订单号': 'Paid on afdian? Enter the order number', '感谢支持。Pro 的全部功能已在这台设备上开通。': 'Thank you. All of Pro is now on this device.', '挑一套主题开始用：': 'Pick a theme to start:', '稍后再选': 'Later', '正在开通…': 'Turning Pro on…', '正在生成订单…': 'Creating your order…', '正在查询…': 'Checking…', '正在验证兑换码…': 'Checking the code…', '正在向爱发电核对订单…': 'Checking with afdian…', '已有兑换码': 'I have a code', '测试版预览 · 付款方式': 'Test build · payment method', '扫码': 'QR code', '爱发电': 'afdian', '只用兑换码': 'Codes only',
    '完成的那一下': 'The moment you finish', '点圆圈试试。六种完成动效，每一种都配了声音。': 'Tap the circle. Six finish effects, each with its own sound.',
    '把锁屏待办的想法做出来': 'Build the lock-screen to-do idea', '七套主题': 'Seven themes',
    '七种看今天的方式：清晨的杯子一点点满起来，稿纸上的一句话一个字一个字写完，夜里每件事是一颗星；一滴滴颜色在水里晕开，一张孔版小海报慢慢印好，一间小屋一件件摆满家具，一只毛团小猫一层层长出毛。每套都换掉所有界面，连锁屏和壁纸也一起换。':
      'Seven ways to see today: a glass filling at dawn, a line of calligraphy written one character at a time, a star for each task at night; drops of colour spreading in water, a little riso poster printing, a small room filling with furniture, a furball cat growing its fur. Each theme changes every screen, the lock screen and the wallpaper too.',
    '碎片罐和每周碎片画': 'The shard jar and a weekly picture', '今天完成的事落进罐子；每周结束，这一周按你做事的时间和分组，长成一幅只属于你的画。':
      "What you finish today falls into the jar; at the end of the week it grows into a picture made from when and what you did.",
    '还有': 'Also', '倒数日': 'Countdowns', '考试、生日、出发的日子，挂在清单和锁屏上': 'Exams, birthdays, trips — on the list and the lock screen',
    '清空时刻': 'All-done moment', '当天全部做完，有一段专门的庆祝': 'Finish everything today and get a small celebration',
    '主题音效': 'Theme sounds', '每个主题一套完成的声音': 'Each theme has its own finish sound', '以后的新主题': 'Future themes', '一次买断，之后上线的主题都免费': 'Pay once; new themes are included',
    '比如：考试': 'e.g. Exam', '倒数日名称': 'Countdown name', '日期': 'Date', '兑换码解锁': 'Unlock with a code', 'App Store 购买': 'Buy on the App Store',
    '免费试用': 'Free trial', '本地预览：付款是模拟的': 'Local preview: payment is simulated', '重置': 'Reset', '预览付款方式': 'Preview payment as', '安卓': 'Android', '网页': 'Web',
    '还没有倒数日。': 'No countdowns yet.', '就是今天': 'Today', '保存这幅碎片画': 'Save this picture',
    '7 套主题': '7 themes', '每套一种看今天的方式，所有界面都换': 'Each one a way to see today; every screen changes', '锁屏也换': 'Lock screen too',
    '安卓锁屏卡片跟着主题': 'The Android lock card follows the theme', '完成动效与音效': 'Finish effects and sounds', '碎片飞进画面，每套自己的声音': 'Shards fly into the picture, each theme with its own sound',
    '碎片罐与每周画': 'Shard jar and weekly picture', '一周做完的事，存成一幅画': "A week's finished tasks, kept as a picture", '考试、生日，写在头部': 'Exams, birthdays, at the top',
    // checkout
    '首发价，上架后第一个月': 'Launch price for the first month', '一次买断，永久使用': 'Pay once, yours to keep', '用 App Store 购买': 'Buy with the App Store',
    '付款由 Apple 处理 ·': 'Payment by Apple ·', '恢复购买': 'Restore purchase', '付款': 'Pay', '拿到兑换码': 'Get a code', '粘贴兑换': 'Paste to redeem',
    '粘贴': 'Paste', '兑换': 'Redeem', '支付宝、微信都能付 · 一个码最多用在 3 台设备上': 'Alipay or WeChat Pay · one code works on up to 3 devices',
    '本地预览 · 模拟结果': 'Local preview · simulated result', '成功': 'Success', '取消': 'Cancel', '失败': 'Failed', '家长同意': 'Ask a parent', '已被用过': 'Already used', '没网': 'Offline',
    'Pro 已解锁': 'Pro unlocked', '谢谢支持，全部功能已经可以用了。挑一个主题试试：': 'Thank you! Everything is unlocked. Try a theme:', '以后再说': 'Later',
    '已取消，没有扣款。': 'Cancelled. You were not charged.', '没能完成付款：连不上 App Store。检查网络后再试一次。': "Couldn't reach the App Store. Check your connection and try again.",
    '已经发给家长了。家长同意后，Pro 会自动解锁。': 'Sent to a parent. Pro unlocks once they approve.', '这个 Apple 账户没有买过 Pro。换手机前用的是别的 Apple 账户吗？': 'This Apple account has not bought Pro. Did you use another Apple account before?',
    '这个兑换码已经在 3 台设备上用过了。需要帮助，就在“关于”里给我们留言。': 'This code is already used on 3 devices. For help, leave us a note in About.',
    '验证兑换码要联网。连上网再试一次。': 'Checking a code needs the internet. Connect and try again.', '兑换码不对：应该是 SUISUI 开头，后面 12 位字母和数字。': 'That code looks wrong: it starts with SUISUI, then 12 letters and numbers.',
    '本地预览没有真的付款页。付完款，付款页会显示一串兑换码，像这样：': 'The local preview has no real payment page. After paying, the page shows a code like this:',
    '正在连接 App Store…': 'Connecting to the App Store…', '正在查找这个 Apple 账户的购买记录…': 'Looking for purchases on this Apple account…', '正在验证兑换码…': 'Checking the code…',
    '已恢复购买': 'Purchase restored', '没有找到购买记录（本地预览）': 'No purchase found (local preview)', '兑换码不对，检查一下有没有输错': 'That code is wrong — check for typos',
    '没能读取剪贴板，请长按输入框粘贴': "Couldn't read the clipboard — long-press the box to paste", '已重置为未购买（本地预览）': 'Reset to not purchased (local preview)',
    '已开始 3 天免费试用，Pro 全部可用': 'Your 3-day free trial has started — all of Pro is on', '试穿结束，已换回原来的样子': 'Try-on over — back to your own look',
    'Pro 已解锁，去“外观”或“今天”页的罐子看看': 'Pro unlocked — see Appearance, or the jar on Today',
    '碎成玻璃 · 玻璃轻响': 'Breaks into glass · a glassy tink', '碎成纸屑 · 纸页一声': 'Tears into paper · a page turn', '化成光点 · 夜里一声轻响': 'Turns into starlight · a soft night chime',
    '化成一滴颜色 · 水滴声': 'Becomes a drop of colour · a water drip', '印成一张小画 · 印机咔哒': 'Prints a little picture · a press clack', '变成一件家具 · 木头轻敲': 'Becomes furniture · a wooden knock', '多长一层毛 · 软软一声': 'Grows a layer of fur · a soft puff',
    '件今天完成': 'done today', '件今天完成，第一片还在路上': 'done today, the first shard is on its way', '已解锁 Pro，谢谢你。': 'Pro is unlocked. Thank you.',
    '测试版 · 全部免费': 'Test build · all free', '免费测试': 'Free test', '测试版：付款是模拟的': 'Test build: payment is simulated',
    '测试版：Pro 全部免费，已经都能用。下面的购买只是演示，不会扣钱。': 'Test build: all of Pro is free and already on. Buying below is only a demo; nothing is charged.',
    '手机壁纸铺在底下，半透明的玻璃质感': 'Your phone wallpaper underneath, frosted like glass', '米白纸面，大号日期，像一本手账': 'Off-white paper and a big date, like a planner', '纯黑底，荧光色点缀，夜里看不刺眼': 'Pure black with a neon accent, easy on the eyes at night', '早上琉璃，白天素笺，晚上星河，跟着时间换': 'Prism in the morning, Washi by day, Nocturne at night', '使用中': 'In use',
    '测试版 · 全部已解锁': 'Test build · everything unlocked', '一只玻璃杯，做完一件，倒进一层颜色': 'A glass: each thing done pours in one layer of colour', '稿纸一格写一字，做完盖一枚红印': 'Manuscript paper, one character per thing, a red seal when done', '每件事是一颗星，做完连成今天的星座': 'Every thing is a star; done ones join into today\'s constellation', '每做完一件，滴一滴颜色，开成一朵花': 'Each thing done drops a colour that opens into a flower', '每做完一件，印上一幅双色小画': 'Each thing done prints a little two-colour picture', '每做完一件，小屋里添一件家具': 'Each thing done adds a piece of furniture to the little room', '每做完一件多长一层绒毛，全做完它睁眼': 'Each thing done grows a layer of fur; all done, it opens its eyes', '随光': 'Daylight', '早上 5 点用琉璃，10 点用素笺，晚上 6 点用星河。': 'Prism from 5 am, Washi from 10, Nocturne from 6 pm.', '每套主题都有自己的配色、完成动效，和全部做完时的那幅画。': 'Each theme has its own colours, finishing effect and the picture you get when everything is done.', '看付款页': 'See checkout', '测试版：Pro 全部免费，已经都能用。付款页只是演示，不会扣钱。': 'Test build: all of Pro is free and already on. The checkout is only a demo; nothing is charged.',
    // iPhone first-run setup (base app, kept here with the other additions)
    '让待办出现在锁屏': 'Put your to-dos on the Lock Screen', 'iPhone 的锁屏上有两种碎碎清单：一直在的小组件，和有待办时出现的大卡片。亮屏后点圆圈就能完成。': 'There are two ways on the iPhone Lock Screen: a widget that is always there, and a large card that appears when you have to-dos. Tap a circle to finish.',
    '到点提醒、计时结束会通知你，通知里能直接点“完成”。': 'Reminders and timers notify you; tap “Done” right in the notification.', '允许': 'Allow', '打开': 'Turn on', '去设置': 'Open Settings', '好了': 'Done',
    '锁屏大卡片（实时活动）': 'Lock Screen card (Live Activity)', '有待办时，锁屏和灵动岛上显示今天的清单。': "When you have to-dos, today's list shows on the Lock Screen and Dynamic Island.",
    '有待办时，锁屏和灵动岛上显示今天的清单；全部做完会自动收起。': "When you have to-dos, today's list shows on the Lock Screen and Dynamic Island; it goes away when all are done.",
    '实时活动在系统里被关掉了：点“去设置”，打开“实时活动”后回来。': 'Live Activities are off in Settings: tap “Open Settings”, turn on Live Activities, then come back.',
    '锁屏小组件': 'Lock Screen widget', '回到锁屏，长按屏幕 → 自定 → 锁定屏幕 → 点时间下面的小组件区 → 碎碎清单，选长条那一款。': 'On the Lock Screen, touch and hold → Customize → Lock Screen → tap the widget area under the time → SuiSui, and pick the wide one.',
    '锁屏设置步骤': 'Lock Screen setup', '好了，锁上手机看看': 'Done — lock your phone to see it', '好了，加一件待办后锁上手机看看': 'Done — add a to-do, then lock your phone to see it',
    '每年': 'Yearly', '今年': 'This year', '去年': 'Last year', '每年回顾': 'Yearly review', '今年回顾': 'This year', '去年回顾': 'Last year', '每月完成': 'Done per month',
    '碎片飞进画面，每套各有一种': 'Shards fly into the picture, one kind per theme', '点圆圈试试。六种完成动效，安静、利落。': 'Tap the circle. Six finish effects, quiet and crisp.',
    '碎成玻璃，落进量杯': 'Breaks into glass that falls into the glass', '碎成纸屑，写下一个字': 'Tears into paper and writes a character', '化成光点，连成星座': 'Turns into starlight and joins the constellation',
    '化成一滴颜色': 'Becomes a drop of colour', '印成一张小画': 'Prints a little picture', '变成一件家具': 'Becomes a piece of furniture', '多长一层毛': 'Grows a layer of fur',
    // wallpaper
    '锁屏和预览都用它；存到相册，也能设成手机壁纸': 'Used on the lock screen and previews; save it to set as your phone wallpaper', '保存到相册': 'Save to Photos', '壁纸没能读取，请再试一次': "Couldn't load the wallpaper — try again",
    // jar & weekly
    '碎片罐': 'Shard jar', '这一周': 'This week', '这一周还空着': 'This week is still empty', '完成一件事，画就开始长': 'Finish a task and the picture starts growing',
    '拖动罐子，或倾斜手机，碎片会滚动': 'Drag the jar or tilt your phone to roll the shards', '，第一片还在路上': ', the first shard is on its way', '这一页还空着': 'This page is still empty',
    '写得最多。做完几件，写几个字；朱圈是专注过的': 'wrote the most. One character per task; red circles mark focus time', '完成一件事，就写下第一个字': 'Finish a task to write the first character',
    '一盆清水': 'A bowl of clear water', '最浓。专注越久，晕得越大': 'was the richest. Longer focus spreads wider', '做完一件事，就滴下第一滴': 'Finish a task for the first drop',
    '空着': 'empty', '一个圈': 'a circle',
    // all-done moments
    '杯子满了。': 'The glass is full.', '收好了': 'Put away', '今日事，今日毕。': "Today's done, today.", '收笔': 'Lift the brush', '今天的星座，连好了。': "Tonight's constellation is complete.",
    '晚安': 'Good night', '晕好了。': 'The colours have spread.', '落款': 'Sign it', '印完了。': 'Printed.', '收藏': 'Keep it', '房间布置好了。': 'The room is ready.', '开灯': 'Lights on',
    '它醒了。': "It's awake.", '摸摸它': 'Pet it', '今天的事，全部完成。': 'Everything for today is done.',
    // headers (state lines)
    '满了。今天的都做完了': "Full. Today's all done", '今天是一只空杯子': 'Today is an empty glass', '今天的稿纸还空着': "Today's page is blank", '今天的星座连好了': "Tonight's constellation is complete",
    '今晚还没有星星': 'No stars yet tonight', '今天这幅，晕好了': "Today's picture has spread", '一盆清水，等第一滴墨': 'Clear water, waiting for the first drop', '今天这张，印完了': "Today's print is done",
    '做完一件，印一张': 'Finish one, print one', '房间布置好了，开灯': 'Room ready — lights on', '一间空房间': 'An empty room', '画好了，它醒了': "Drawn — it's awake", '还是一个铅笔圈': 'Still a pencil circle',
    '房间布置好了': 'Room ready', '做完一件，添一件家具': 'Finish one, add furniture', '它醒了': "It's awake", '今天的都做完了': "Today's all done", '做完一件，多画一层毛': 'Finish one, add a layer of fur',
    // pigments (晕 legend)
    '花青': 'Indigo', '胭脂': 'Rouge', '藤黄': 'Gamboge', '石青': 'Azurite', '赭石': 'Ochre',
    // sample tasks in the previews
    '把想法做出来': 'Build the idea', '整理拍摄素材': 'Sort the footage', '给家里打电话': 'Call home', '读二十页书': 'Read twenty pages', '跑步三公里': 'Run 3 km', '回复客户': 'Reply to the client'
  });
  const day = (m, d) => `${MON[+m - 1]} ${d}`;
  I.rules.unshift(
    [/^(\d+)月(\d+)日[ 　·]+星期([日一二三四五六])$/, (_, m, d, w) => `${WEEK[w]}, ${day(m, d)}`],
    [/^试用中 · 剩 (\d+) 天$/, (_, n) => `Trial · ${n} days left`], [/^试用 (\d+) 天$/, (_, n) => `Trial · ${n} days`],
    [/^免费试用 (\d+) 天$/, (_, n) => `Try free for ${n} days`],
    [/^正式版 (¥[\d.]+)（原价 (¥[\d.]+)），一次买断$/, (_, p, l) => `Full version ${p} (was ${l}), one-time purchase`],
    [/^已开始 (\d+) 天免费试用，Pro 全部可用$/, (_, n) => `Your ${n}-day free trial has started — all of Pro is on`],
    [/^随光 · (.+)$/, (_, a) => `Daylight · ${FULL[a] || a}`], [/^现在是(.+)$/, (_, a) => `Now ${NAME[a] || full(a)}`],
    [/^正在用「(.+)」$/, (_, a) => `Using ${full(a).replace(/^随光 · (.+)$/, (x, y) => `Daylight · ${FULL[y] || y}`)}`],
    [/^已换上「(.+)」$/, (_, a) => `Now using ${full(a)}`], [/^正在试穿「(.+)」$/, (_, a) => `Trying on ${full(a)}`], [/^用「(.+)」$/, (_, a) => `Use ${full(a)}`],
    [/^「(.+)」专属壁纸$/, (_, a) => `${full(a)} wallpaper`], [/^已添加倒数日「(.+)」$/, (_, a) => `Countdown added: ${a}`],
    [/^还有 (\d+) 天$/, (_, n) => `${n} days to go`], [/^已过 (\d+) 天$/, (_, n) => `${n} days ago`],
    [/^开通 Pro · (.+)$/, (_, p) => `Get Pro · ${p}`], [/^扫码付款 · (.+)$/, (_, p) => `Pay by QR · ${p}`], [/^前往爱发电付款 · (.+)$/, (_, p) => `Pay on afdian · ${p}`], [/^(.*)一次购买 · 永久使用 · 无订阅$/, (_, a) => `${a}Pay once · yours forever · no subscription`],
    [/^购买 · (.+)$/, (_, p) => `Buy · ${p}`], [/^购买兑换码 · (.+)$/, (_, p) => `Buy a code · ${p}`], [/^打开付款页 · (.+)$/, (_, p) => `Open payment page · ${p}`],
    [/^用 App Store 购买 (.+)$/, (_, p) => `Buy with the App Store ${p}`], [/^碎成(.+)$/, (_, a) => `Breaks into ${a}`],
    [/^(\d+) 件今天完成(，第一片还在路上)?$/, (_, n, e) => `${n} done today${e ? ', the first shard is on its way' : ''}`],
    [/^空杯子，(\d+) 件倒满它$/, (_, a) => `An empty glass — ${a} to fill it`], [/^今晚 (\d+) 颗星，等你点亮$/, (_, a) => `${a} stars to light tonight`], [/^(\d+) 滴颜色，等着晕开$/, (_, a) => `${a} drops waiting to spread`], [/^(\d+) 件家具，等你摆进来$/, (_, a) => `${a} pieces waiting to go in`],
    [/^满了 (\d+)%，还差 (\d+) 件$/, (_, a, b) => `${a}% full, ${b} to go`], [/^晕开了 (\d+) 滴，还有 (\d+) 滴$/, (_, a, b) => `${a} drops spread, ${b} to go`],
    [/^布置了 (\d+) 件，还差 (\d+) 件$/, (_, a, b) => `${a} pieces in, ${b} to go`], [/^布置了 (\d+) 件$/, (_, a) => `${a} pieces in`], [/^还差 (\d+) 件家具$/, (_, a) => `${a} more to place`],
    [/^毛长了 (\d+)%，还差 (\d+) 件$/, (_, a, b) => `${a}% fur, ${b} to go`], [/^毛长了 (\d+)%$/, (_, a) => `${a}% fur`], [/^还差 (\d+) 件，它就睁眼$/, (_, a) => `${a} more and it opens its eyes`],
    [/^今天亮了 (\d+) 颗星$/, (_, a) => `${a} stars lit today`], [/^做完 (\d+) 件$/, (_, a) => `${a} done`], [/^还差 (\d+) 件$/, (_, a) => `${a} to go`],
    [/^第 (\d+) 周的七间房$/, (_, a) => `Week ${a}: seven rooms`], [/^第 (\d+) 周$/, (_, a) => `Week ${a}`], [/^(\d+) 层$/, (_, a) => `${a} layers`],
    [/^周([一二三四五六日])$/, (_, a) => WEEK[a]],
    [/^(\d+) 年前$/, (_, a) => `${a} years ago`], [/^(\d{4})年$/, (_, a) => a], [/^(\d{1,2})月$/, (_, a) => MON[+a - 1] || a],
    [/^(\d+) 件家具(.*)，开灯，住进来吧。$/, (_, a, f) => `${a} pieces${tf(f)} — lights on, move in.`], [/^(\d+) 层毛(.*)，今天画完了。$/, (_, a, f) => `${a} layers of fur${tf(f)} — finished for today.`],
    [/^今天 (\d+) 件(.*)，一滴不剩。$/, (_, a, f) => `${a} today${tf(f)}, to the last drop.`], [/^(\d+) 件事(.*)，这一页写完了。$/, (_, a, f) => `${a} tasks${tf(f)} — the page is written.`],
    [/^(\d+) 颗星(.*)，晚安。$/, (_, a, f) => `${a} stars${tf(f)}. Good night.`], [/^(\d+) 滴颜色(.*)，今天这幅画干了。$/, (_, a, f) => `${a} drops${tf(f)} — today's picture has dried.`],
    [/^(\d+) 张小画(.*)，今天这张海报印好了。$/, (_, a, f) => `${a} prints${tf(f)} — today's poster is done.`], [/^(\d+) 件(.*)，都收进碎片罐了。$/, (_, a, f) => `${a} tasks${tf(f)}, all in the jar.`],
    [/^(\d+)\/(\d+) 张$/, (_, a, b) => `${a}/${b}`], [/^还差 (\d+) 张$/, (_, a) => `${a} to go`]
  );
  function tf(f) { const m = f.match(/专注 (\d+) 分钟/); return m ? `, ${m[1]} min focus` : ''; }
})();
