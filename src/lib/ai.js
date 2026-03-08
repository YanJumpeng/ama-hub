async function callClaude(systemPrompt, userPrompt) {
  const res = await fetch('/api/claude', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || '调用 AI 失败');
  return data.content[0].text;
}

// 1. 根据项目信息生成 AMA 问题
export async function generateQuestions({ projectName, theme, notes, history }) {
  const historyContext = history?.length
    ? `\n\n历史 AMA 参考（避免重复）：\n${history.slice(0, 3).map(r => `- ${r.theme}：${r.questions?.slice(0, 200)}`).join('\n')}`
    : '';

  return callClaude(
    `你是 Tree Finance 大树财经的 Web3 内容编辑，擅长设计专业、有深度、能引发讨论的 AMA 问题。
风格要求：问题要有层次感，从项目背景→核心产品→市场策略→未来规划递进，语气专业但不晦涩，适合中文 Web3 社区。
直接输出问题列表，每个问题单独一行，编号格式：1. 2. 3. 不需要其他解释。`,
    `项目名：${projectName}
本期主题：${theme || '项目介绍与近期进展'}
背景备注：${notes || '无'}${historyContext}

请生成 8-10 个 AMA 问题。`
  );
}

// 2. 生成宣传文案（中文，适合 Telegram/微信群）
export async function generatePromo({ projectName, theme, date, kols, questions }) {
  return callClaude(
    `你是 Tree Finance 大树财经的运营，负责写 AMA 预热推文和社群宣传文案。
风格：简洁有力，带一点 Web3 氛围感，包含关键信息，结尾带行动号召。
输出两个版本：1) Telegram/Twitter 英文版（100字内）2) 微信/中文社群版（150字内）`,
    `项目：${projectName}
主题：${theme}
时间：${date}
嘉宾KOL：${kols || '待定'}
核心问题预告（选2-3个）：${questions?.slice(0, 300) || '精彩议题'}

请输出宣传文案。`
  );
}

// 3. 月度/季度/年度 AI 总结
export async function generateSummary(records, period = 'monthly') {
  if (!records?.length) return '暂无数据，请先录入 AMA 记录。';

  const now = new Date();
  let filtered = records;
  let periodLabel = '';

  if (period === 'monthly') {
    const ym = now.toISOString().slice(0, 7);
    filtered = records.filter(r => r.date?.startsWith(ym));
    periodLabel = `${ym} 月度`;
  } else if (period === 'quarterly') {
    const q = Math.floor(now.getMonth() / 3);
    const year = now.getFullYear();
    filtered = records.filter(r => {
      if (!r.date) return false;
      const m = new Date(r.date).getMonth();
      return new Date(r.date).getFullYear() === year && Math.floor(m / 3) === q;
    });
    periodLabel = `${year} Q${q + 1} 季度`;
  } else {
    filtered = records.filter(r => r.date?.startsWith(String(now.getFullYear())));
    periodLabel = `${now.getFullYear()} 年度`;
  }

  if (!filtered.length) return `${periodLabel}暂无 AMA 记录。`;

  const detail = filtered.map(r =>
    `[${r.date}${r.time ? ' ' + r.time : ''}] ${r.project_name} 第${r.episode || '-'}期\n状态：${r.status} | 平台：${r.platform || '-'} | 负责人：${r.owner || '-'}\n主题：${r.theme || '-'}\nKOL：${r.kols?.replace(/\n/g, '、') || '-'}`
  ).join('\n\n');

  const stats = {
    total: filtered.length,
    done: filtered.filter(r => r.status === '已完成').length,
    platforms: [...new Set(filtered.map(r => r.platform).filter(Boolean))].join('、'),
    projects: [...new Set(filtered.map(r => r.project_name))].join('、'),
  };

  return callClaude(
    `你是 Tree Finance 大树财经的运营总监，负责撰写 AMA 运营总结报告。
报告风格：专业、简洁、数据驱动，要有实质性洞察，适合团队内部复盘和向管理层汇报。
结构：总体概况 → 亮点回顾 → 问题与不足 → 下期建议`,
    `以下是 ${periodLabel} AMA 运营数据：

总场次：${stats.total}场 | 已完成：${stats.done}场 | 完成率：${Math.round(stats.done / stats.total * 100)}%
涉及项目：${stats.projects}
使用平台：${stats.platforms || '未记录'}

详细记录：
${detail}

请生成 ${periodLabel}总结报告。`
  );
}

// 4. 分析历史 AMA，给出优化建议
export async function analyzeHistory(records) {
  if (!records?.length) return '暂无足够历史数据，请先录入至少 3 条 AMA 记录。';

  const summary = records.slice(0, 10).map(r =>
    `[${r.date}] ${r.project_name}（${r.status}）\n主题：${r.theme}\n问题数：${r.questions?.split('\n').length || 0}\nKOL：${r.kols?.slice(0, 80)}`
  ).join('\n\n');

  return callClaude(
    `你是 Web3 内容策略分析师，擅长从 AMA 历史数据中找规律、给出可落地的改进建议。
分析维度：题材分布、节奏规律、KOL 策略、问题质量模式。
输出格式：结构清晰的中文分析报告，要有具体洞察，不要废话。`,
    `以下是 Tree Finance 近期 AMA 历史记录：\n\n${summary}\n\n请给出深度分析和 3-5 条优化建议。`
  );
}
