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
    // 1. 发起请求
    const response = await env.AI.run('@cf/moonshotai/kimi-k2.5', {
      messages: [{ role: "user", content: prompt }],
      stream: false
    });

    // --- 核心修复：检查并解析 Response 对象 ---
    let result;
    
    // 如果 response 是一个 Response 对象（即拥有 .json() 方法）
    if (response instanceof Response || typeof response.json === 'function') {
      result = await response.json();
    } else {
      // 否则说明它已经是一个解析好的 JS 对象
      result = response;
    }

    // 调试打印：这次你应该能看到完整的 JSON 字符串了
    console.log("Kimi 最终解析结果:", JSON.stringify(result));

    // 2. 按照 OpenAI 标准结构提取内容
    if (result && result.choices && result.choices.length > 0) {
      const message = result.choices[0].message;
      if (message && message.content) {
        return message.content;
      }
    }

    // 3. 兜底解析：如果 Cloudflare 以后改回了标准 .response 格式
    if (result.response) return result.response;

    return "❌ 无法解析 Kimi 返回的字段，结构为: " + JSON.stringify(result);

  } catch (e) {
    // 捕获可能的解析错误或网络错误
    return "❌ Kimi 执行异常: " + e.message;
  }
}