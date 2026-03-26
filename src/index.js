import { renderHTML } from './template.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/api/chat") {
      const { prompt } = await request.json();

      try {
        const results = await Promise.allSettled([
          // 1. MiniMax M2.5 (使用最新 OpenAI 兼容接口)
          fetchMiniMax(prompt, env.MINIMAX_API_KEY),
          // 2. Cloudflare Llama 3
          env.AI.run('@cf/meta/llama-3-8b-instruct', { prompt }).then(r => r.response),
          // 3. Cloudflare Qwen 1.5 (修正后的路径)
          env.AI.run('@cf/qwen/qwen1.5-7b-chat-awq', { prompt }).then(r => r.response)
        ]);

        return new Response(JSON.stringify({
          minimax: results[0].status === 'fulfilled' ? results[0].value : "MiniMax请求失败",
          llama3: results[1].status === 'fulfilled' ? results[1].value : "Llama请求失败",
          qwen: results[2].status === 'fulfilled' ? results[2].value : "Qwen请求失败",
        }), { headers: { "Content-Type": "application/json" } });

      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
      }
    }

    return new Response(renderHTML(), {
      headers: { "Content-Type": "text/html;charset=UTF-8" },
    });
  },
};

// --- MiniMax 调用函数 (OpenAI 兼容模式) ---
async function fetchMiniMax(prompt, apiKey) {
  if (!apiKey) return "未在后台配置 MINIMAX_API_KEY";

  try {
    // 使用最新官方推荐的域名和 OpenAI 兼容路径
    const response = await fetch("https://api.minimax.chat/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        // MiniMax M2.5 建议使用 abab6.5s-chat 或 abab7-chat (具体看你的 plan)
        model: "MiniMax-M2.7", 
        messages: [
          { role: "system", content: "你是一个专业的AI助手" },
          { role: "user", content: prompt }
        ]
      })
    });

    const data = await response.json();

    // 如果接口返回了报错信息 (MiniMax 的 base_resp 结构)
    if (data.base_resp && data.base_resp.status_code !== 0) {
      return `❌ API报错: [${data.base_resp.status_code}] ${data.base_resp.status_msg}`;
    }

    // 标准 OpenAI 结构解析
    if (data.choices && data.choices[0] && data.choices[0].message) {
      return data.choices[0].message.content;
    }

    return "❌ 接口返回异常，原始数据: " + JSON.stringify(data);

  } catch (err) {
    return "❌ 网络请求链路异常: " + err.message;
  }
}