#!/usr/bin/env node
/**
 * Tiny eval runner: posts each prompt to the live /api/chat endpoint, parses
 * the SSE stream, and asserts the expectations declared in prompts.json.
 *
 *   BASE_URL=https://hack.rzs-it.ro node evals/run.mjs
 */
import { readFile } from "node:fs/promises";

const BASE_URL = process.env.BASE_URL ?? "https://hack.rzs-it.ro";
const file = new URL("./prompts.json", import.meta.url);
const prompts = JSON.parse(await readFile(file, "utf8"));

async function runOne(p) {
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "user", content: p.prompt }] }),
  });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  const seenToolIds = new Set();
  const tools = [];
  let text = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      let evt;
      try { evt = JSON.parse(line.slice(6).trim()); } catch { continue; }
      // Each tool block emits tool_call_start twice (streaming + final input).
      // Dedup by id so step count is accurate.
      if (evt.kind === "tool_call_start" && !seenToolIds.has(evt.id)) {
        seenToolIds.add(evt.id);
        tools.push(evt.name);
      } else if (evt.kind === "text") text += evt.delta;
    }
  }
  const checks = [];
  for (const t of p.expects.must_call_tools ?? []) {
    checks.push({ ok: tools.includes(t), msg: `must call ${t} (got: ${tools.join(",")||"none"})` });
  }
  for (const t of p.expects.must_not_call_tools ?? []) {
    checks.push({ ok: !tools.includes(t), msg: `must NOT call ${t}` });
  }
  for (const word of p.expects.must_not_hallucinate ?? []) {
    checks.push({ ok: !text.toLowerCase().includes(word.toLowerCase()), msg: `must not mention "${word}"` });
  }
  if (p.expects.max_steps != null) {
    checks.push({ ok: tools.length <= p.expects.max_steps, msg: `<=${p.expects.max_steps} steps (got ${tools.length})` });
  }
  return { id: p.id, tools, checks };
}

let passed = 0, failed = 0;
for (const p of prompts) {
  process.stdout.write(`[${p.id}] `);
  try {
    const r = await runOne(p);
    let allOk = true;
    for (const c of r.checks) { if (!c.ok) allOk = false; }
    if (allOk) { passed++; console.log(`\x1b[32mPASS\x1b[0m  tools=[${r.tools.join(",")}]`); }
    else {
      failed++;
      console.log(`\x1b[31mFAIL\x1b[0m`);
      for (const c of r.checks) if (!c.ok) console.log(`   - ${c.msg}`);
    }
  } catch (e) {
    failed++;
    console.log(`\x1b[31mERROR\x1b[0m ${e.message}`);
  }
}
console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed === 0 ? 0 : 1);
