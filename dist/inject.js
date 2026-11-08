/* 自注入引擎：把 persona / stack / sysBlock / tail 压进一条消息的 context。
 * 官方 API 约束：SendAnswer.context ≤ 20,000 字符（所有插件合计 50,000）。
 * 顺序：persona → stack → sys → tail（人设优先保留，堆叠按层装填）。
 */
const HARD_LIMIT = 20000;
const SEP = '\n\n';

function blocks(parts) {
  const out = [];
  const push = (kind, id, text) => {
    const s = String(text == null ? '' : text).trim();
    if (s) out.push({ kind, id: id || '', text: s });
  };
  push('persona', 'persona', parts.persona);
  const layers = Array.isArray(parts.stackLayers) ? parts.stackLayers : [];
  if (layers.length) {
    for (const l of layers) push('stack', l.id, l.text);
  } else if (parts.stack) {
    push('stack', 'stack', parts.stack);
  }
  push('sys', 'sys', parts.sys);
  push('tail', 'tail', parts.tail);
  return out;
}

function compose(parts, limit) {
  const cap = Math.max(1000, Math.min(HARD_LIMIT, Number(limit) || HARD_LIMIT));
  const all = blocks(parts);
  const persona = all.filter(b => b.kind === 'persona');
  const stack = all.filter(b => b.kind === 'stack');
  const tail = all.filter(b => b.kind === 'tail');
  const sys = all.filter(b => b.kind === 'sys');

  const kept = [];
  const dropped = [];
  let used = 0;
  const cost = s => s.length + (kept.length ? SEP.length : 0);
  const take = b => { kept.push(b); used += cost(b.text); };

  // 1) sys + tail 先占（短、决定行为边界）
  for (const b of sys) { if (used + cost(b.text) <= cap) take(b); else { dropped.push(b); } }
  for (const b of tail) { if (used + cost(b.text) <= cap) take(b); else { dropped.push(b); } }

  // 2) 人设：够就整段，不够就按字符硬切（切点不落在半个代理对上）
  let personaCut = 0;
  for (const b of persona) {
    const room = cap - used - (kept.length ? SEP.length : 0);
    if (room <= 0) { dropped.push(b); continue; }
    if (b.text.length <= room) take(b);
    else {
      let cut = b.text.slice(0, room);
      const lastCode = cut.charCodeAt(cut.length - 1);
      if (lastCode >= 0xd800 && lastCode <= 0xdbff) cut = cut.slice(0, -1);
      personaCut = b.text.length - cut.length;
      take({ kind: 'persona', id: b.id, text: cut });
    }
  }

  // 3) 堆叠：按层装填，装不下的整层丢弃（不切半层）
  for (const b of stack) {
    if (used + cost(b.text) <= cap) take(b); else dropped.push(b);
  }

  // 4) 输出按语义顺序重排
  const order = { persona: 0, stack: 1, sys: 2, tail: 3 };
  kept.sort((a, b) => (order[a.kind] - order[b.kind]));
  const text = kept.map(b => b.text).join(SEP);

  return {
    text,
    len: text.length,
    cap,
    keptLayers: kept.filter(b => b.kind === 'stack').map(b => b.id),
    droppedLayers: dropped.filter(b => b.kind === 'stack').map(b => b.id),
    personaCut,
    personaLen: persona.reduce((n, b) => n + b.text.length, 0),
    truncated: text.length < all.reduce((n, b) => n + b.text.length + SEP.length, -SEP.length)
  };
}

module.exports = { compose, HARD_LIMIT };
