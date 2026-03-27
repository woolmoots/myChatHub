import { renderHTML } from './template.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/api/chat') {
      const { prompt } = await request.json();

      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          const encode = (msg) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(msg)}\n\n`));
          };

          const sendResult = async (model, fn) => {
            const startedAt = Date.now();

            try {
              const result = await fn();
              encode({ model, result, elapsed: Date.now() - startedAt });
            } catch (error) {
              encode({
                model,
                result: `❌ ${error.message}`,
                elapsed: Date.now() - startedAt,
              });
            }
          };

          try {
            await Promise.all([
              sendResult('minimax', () => fetchMiniMax(prompt, env.MINIMAX_API_KEY)),
              sendResult('kimi', () => runKimi(prompt, env)),
              sendResult('glm', async () => {
                const result = await env.AI.run('@cf/zai-org/glm-4.7-flash', {
                  messages: [{ role: 'user', content: prompt }],
                });

                return (
                  result.response ||
                  result.text ||
                  result.choices?.[0]?.message?.content ||
                  'GLM 未返回内容'
                );
              }),
            ]);
          } finally {
            encode({ allDone: true });
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    return new Response(renderHTML(), {
      headers: { 'Content-Type': 'text/html;charset=UTF-8' },
    });
  },
};

async function fetchMiniMax(prompt, apiKey) {
  if (!apiKey) return '未在后台配置 MINIMAX_API_KEY';

  try {
    const response = await fetch('https://api.minimax.chat/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'MiniMax-M2.7',
        messages: [
          { role: 'system', content: '你是一个专业的 AI 助手' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    const data = await response.json();

    if (data.base_resp && data.base_resp.status_code !== 0) {
      return `❌ API 报错: [${data.base_resp.status_code}] ${data.base_resp.status_msg}`;
    }

    if (data.choices?.[0]?.message?.content) {
      const text = data.choices[0].message.content;
      if (typeof text !== 'string') return text;

      return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    }

    return `❌ 接口返回异常，原始数据: ${JSON.stringify(data)}`;
  } catch (error) {
    return `❌ MiniMax 调用异常: ${error.message}`;
  }
}

async function runKimi(prompt, env) {
  try {
    const result = await env.AI.run('@cf/moonshotai/kimi-k2.5', {
      messages: [{ role: 'user', content: prompt }],
      stream: false,
    });

    if (result?.choices?.[0]?.message?.content) {
      return result.choices[0].message.content;
    }

    if (result?.response) {
      return result.response;
    }

    console.log('Kimi 返回结构无法识别', JSON.stringify(result));
    return '❌ 无法解析 Kimi 的返回结果';
  } catch (error) {
    return `❌ Kimi 调用异常: ${error.message}`;
  }
}
