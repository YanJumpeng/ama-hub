export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
    const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

    const response = await fetch(
      `${supabaseUrl}/rest/v1/ama_records?status=eq.计划中&order=date.asc`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    );
    const records = await response.json();

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    // 本周范围（周一到周日）
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() + 1);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const weekStartStr = weekStart.toISOString().slice(0, 10);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);

    const thisWeek = records.filter(r => r.date >= weekStartStr && r.date <= weekEndStr);
    const upcoming = records.filter(r => r.date > weekEndStr).slice(0, 5);

    if (!records.length) {
      return res.status(200).json({ message: '没有待办 AMA' });
    }

    const fmt = (r) => {
      const daysLeft = Math.ceil((new Date(r.date) - today) / 86400000);
      const dot = daysLeft <= 3 ? '🔴' : daysLeft <= 7 ? '🟡' : '🟢';
      const time = r.time ? ` ${r.time}` : '';
      const owner = r.owner ? `\n👤 ${r.owner}` : '';
      const platform = r.platform ? ` · ${r.platform}` : '';
      return `${dot} *${r.project_name}*${r.episode ? ` #${r.episode}` : ''}${platform}\n📅 ${r.date}${time}${owner}\n💬 ${r.theme || '主题待定'}`;
    };

    let message = `📋 *大树财经 AMA 周计划*\n${weekStartStr} ～ ${weekEndStr}\n`;

    if (thisWeek.length) {
      message += `\n*本周计划（${thisWeek.length}场）*\n\n`;
      message += thisWeek.map(fmt).join('\n\n');
    } else {
      message += `\n本周暂无计划 AMA ✨`;
    }

    if (upcoming.length) {
      message += `\n\n*后续安排*\n`;
      message += upcoming.map(r => `▸ ${r.date} ${r.project_name}${r.episode ? ` #${r.episode}` : ''} — ${r.theme || '主题待定'}`).join('\n');
    }

    message += `\n\n👉 [查看 AMA 档案库](https://ama-hub.vercel.app)`;

    const tgRes = await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
        }),
      }
    );

    const tgData = await tgRes.json();
    if (!tgData.ok) throw new Error(tgData.description);

    return res.status(200).json({ success: true, thisWeek: thisWeek.length, upcoming: upcoming.length });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
