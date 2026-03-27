import { renderHTML } from './template.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/api/chat") {
      const { prompt } = await request.json();

      try {
        const results = await Promise.allSettled([
          // 1. MiniMax M2.7 (使用最新 OpenAI 兼容接口)
          fetchMiniMax(prompt, env.MINIMAX_API_KEY),
          // 2. Cloudflare kimi-k2.5
          runKimi(prompt, env),
          // 3. Cloudflare glm
          env.AI.run('@cf/zai-org/glm-4.7-flash', {
            messages: [{ role: "user", content: prompt }]
          }).then(r => r.response || r.text || r.choices?.[0]?.message?.content || "GLM未返回内容")
        ]);

        return new Response(JSON.stringify({
          minimax: results[0].status === 'fulfilled' ? results[0].value : "MiniMax请求失败",
          kimi: results[1].status === 'fulfilled' ? results[1].value : "kimi请求失败",
          glm: results[2].status === 'fulfilled' ? results[2].value : "glm请求失败",
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
        // MiniMax M2.7
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

async function runKimi(prompt, env) {
  try {
    const result = await env.AI.run('@cf/moonshotai/kimi-k2.5', {
      messages: [{ role: "user", content: prompt }],
      stream: false
    });

    // --- 核心修复：针对你提供的 JSON 结构进行解析 ---
    if (result && result.choices && result.choices.length > 0) {
      const message = result.choices[0].message;
      if (message && message.content) {
        return message.content; // 👈 这就是你要的 "You entered 1..."
      }
    }

    // 备选解析：如果 Cloudflare 未来把结构简化了
    if (result.response) return result.response;

    // 调试：如果还是拿不到，把结构打出来看看
    console.log("解析失败，当前结构:", JSON.stringify(result));
    return "❌ 无法解析 Kimi 的返回结构";

  } catch (e) {
    return "❌ Kimi 调用异常: " + e.message;
  }
}