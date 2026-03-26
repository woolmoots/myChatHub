import { renderHTML } from './template.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. 处理 API 请求：前端发出的对话请求
    if (request.method === "POST" && url.pathname === "/api/chat") {
      const { prompt } = await request.json();

      try {
        // 使用 Promise.allSettled 并行请求，互不干扰
        const results = await Promise.allSettled([
          // 调用你的 MiniMax M2.5
          fetchMiniMax(prompt, env.MINIMAX_API_KEY),
          // 调用 CF 内置的 Llama 3
          env.AI.run('@cf/meta/llama-3-8b-instruct', { prompt }).then(r => r.response),
          // 调用 CF 内置的 通义千问 1.5
          env.AI.run('@cf/qwen/qwen1.5-7b-chat-awq', { prompt }).then(r => r.response)
        ]);

        return new Response(JSON.stringify({
          minimax: results[0].status === 'fulfilled' ? results[0].value : "请求失败",
          llama3: results[1].status === 'fulfilled' ? results[1].value : "请求失败",
          qwen: results[2].status === 'fulfilled' ? results[2].value : "请求失败",
        }), { headers: { "Content-Type": "application/json" } });

      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
      }
    }

    // 2. 默认返回：前端 HTML 页面
    return new Response(renderHTML(), {
      headers: { "Content-Type": "text/html;charset=UTF-8" },
    });
  },
};

// MiniMax API 调用细节
async function fetchMiniMax(prompt, apiKey) {
  if (!apiKey) return "错误: 缺少 MINIMAX_API_KEY，请在控制台 Variables 中设置。";
  
  try {
    const response = await fetch("https://api.minimax.chat/v1/text/chatcompletion_v2", {
      method: "POST",
      headers: { 
        "Authorization": `Bearer ${apiKey}`, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({
        model: "abab6.5s-chat", // ⚠️ 请确认你的 plan 是这个模型
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!response.ok) {
      const errorDetail = await response.text();
      return `MiniMax 报错 (${response.status}): ${errorDetail}`;
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (e) {
    return "MiniMax 网络请求异常: " + e.message;
  }
}