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
    const response = await env.AI.run('@cf/moonshotai/kimi-k2.5', {
      messages: [{ role: "user", content: prompt }],
      stream: false
    });

    // 1. 强制解析：不管是 Response 对象、流、还是普通对象，统统转成 JSON 对象
    let result;
    if (response instanceof Response || (response && typeof response.json === 'function')) {
      result = await response.json();
    } else if (response instanceof ReadableStream || (response && response.getReader)) {
      // 处理流式返回
      const reader = response.getReader();
      const decoder = new TextDecoder();
      let text = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value);
      }
      try { result = JSON.parse(text); } catch(e) { result = { response: text }; }
    } else {
      result = response;
    }

    // 2. 深度防御式提取 (针对你发给我的那个结构)
    // 路径：result -> choices[0] -> message -> content
    if (result && result["choices"] && result["choices"][0] && result["choices"][0]["message"]) {
      const msg = result["choices"][0]["message"];
      const content = msg["content"] || "";
      const reasoning = msg["reasoning_content"] || "";
      
      if (reasoning && content) {
        return `【思考】\n${reasoning}\n\n【回答】\n${content}`;
      }
      if (content) return content;
    }

    // 3. 兜底路径：标准 CF 格式
    if (result && result.response) return result.response;
    if (result && result.text) return result.text;

    // 4. 终极自救：如果还是拿不到特定字段，直接把整个对象转成字符串返回，绝不返回 undefined
    if (result) {
      return "解析未命中特定字段，原始数据：" + JSON.stringify(result);
    }

    return "❌ Kimi 返回了完全空的结果 (null)";

  } catch (e) {
    return "❌ Kimi 执行异常: " + e.message;
  }
}