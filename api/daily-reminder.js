export default async function handler(req, res) {
  // 验证是 Vercel Cron 调用（安全校验）
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // 1. 从 Supabase 查询「计划中」的 AMA
    const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
    const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

    const response = await fetch(
      `${supabaseUrl}/rest/v1/ama_records?status=eq.计划中&order=date.asc`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    );

    const records = await response.json();

    if (!records.length) {
      return res.status(200).json({ message: '没有待办 AMA' });
    }

    // 2. 组装 Telegram 消息
    const today = new Date().toISOString().slice(0, 10);
    const lines = records.map(r => {
      const daysLeft = Math.ceil(
        (new Date(r.date) - new Date(today)) / (1000 * 60 * 60 * 24)
      );
      const urgency = daysLeft <= 3 ? '🔴' : daysLeft <= 7 ? '🟡' : '🟢';
      return `${urgency} *${r.project_name}*${r.episode ? ` 第${r.episode}期` : ''}\n📅 ${r.date}（${daysLeft > 0 ? `${daysLeft}天后` : daysLeft === 0 ? '今天！' : `已过期${Math.abs(daysLeft)}天`}）\n主题：${r.theme || '待定'}`;
    });

    const message = `📋 *AMA 待办提醒*\n大树财经 · ${today}\n\n${lines.join('\n\n')}\n\n👉 [查看档案库](https://ama-hub.vercel.app)`;

    // 3. 推送到 Telegram
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    const tgRes = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'Markdown',
          disable_web_page_preview: false,
        }),
      }
    );

    const tgData = await tgRes.json();
    if (!tgData.ok) throw new Error(tgData.description);

    return res.status(200).json({ success: true, sent: records.length });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
