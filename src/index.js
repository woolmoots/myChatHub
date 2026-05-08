import { renderHTML } from './template.js';
import { MODEL_CONFIGS } from './models.js';

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
            await Promise.all(
              MODEL_CONFIGS.map((config) => sendResult(config.id, () => config.run(prompt, env)))
            );
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

    return new Response(renderHTML(MODEL_CONFIGS), {
      headers: { 'Content-Type': 'text/html;charset=UTF-8' },
    });
  },
};
