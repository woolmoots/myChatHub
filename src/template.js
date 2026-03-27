export function renderHTML() {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AiChatHub - 多模型聚合</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap" rel="stylesheet">
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { background-color: #0f172a; color: #f1f5f9; font-family: sans-serif; }
        .card { background: rgba(30, 41, 59, 0.5); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.1); }
        .signature { font-family: "Great Vibes", cursive; letter-spacing: 0.04em; }
    </style>
</head>
<body class="max-w-7xl mx-auto p-4 md:p-10">
    <header class="mb-10 flex items-center justify-between">
        <h1 class="text-2xl font-black tracking-tight text-blue-400">AiChatHub <span class="text-xs font-normal text-slate-500 uppercase ml-2">v2.0</span></h1>
        <div class="text-right text-xs text-slate-400">
            <div>基于 Cloudflare Workers 部署</div>
            <div class="signature text-xl text-slate-300/90">develop by czw</div>
        </div>
    </header>

    <main>
        <section class="mb-10">
            <div class="relative">
                <textarea id="prompt" rows="4"
                    class="w-full bg-slate-800 border-2 border-slate-700 rounded-2xl p-5 text-lg shadow-2xl focus:border-blue-500 focus:outline-none transition-all"
                    placeholder="在这里输入你的指令，所有模型将同时为你作答..."></textarea>
                <button id="sendBtn"
                    class="absolute bottom-4 right-4 bg-blue-600 hover:bg-blue-500 px-8 py-3 rounded-xl font-bold transition-all shadow-lg active:scale-95">
                    发送请求
                </button>
            </div>
        </section>

        <section class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div class="card rounded-2xl p-6">
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center"><span class="w-3 h-3 bg-purple-500 rounded-full mr-2"></span><h3 class="font-bold">MiniMax M2.7</h3></div>
                    <span id="time-minimax" class="text-xs text-slate-500"></span>
                </div>
                <div id="res-minimax" class="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">等待输入...</div>
            </div>
            <div class="card rounded-2xl p-6">
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center"><span class="w-3 h-3 bg-green-500 rounded-full mr-2"></span><h3 class="font-bold">Kimi K2.5</h3></div>
                    <span id="time-kimi" class="text-xs text-slate-500"></span>
                </div>
                <div id="res-kimi" class="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">等待输入...</div>
            </div>
            <div class="card rounded-2xl p-6">
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center"><span class="w-3 h-3 bg-orange-500 rounded-full mr-2"></span><h3 class="font-bold">GLM 4.7 Flash</h3></div>
                    <span id="time-glm" class="text-xs text-slate-500"></span>
                </div>
                <div id="res-glm" class="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">等待输入...</div>
            </div>
        </section>
    </main>

    <script>
        const sendBtn = document.getElementById('sendBtn');
        const promptInput = document.getElementById('prompt');
        const models = ['minimax', 'kimi', 'glm'];

        const resetUI = () => {
            models.forEach((model) => {
                document.getElementById('res-' + model).innerText = '思考中...';
                document.getElementById('time-' + model).innerText = '';
            });
        };

        const finishUI = () => {
            sendBtn.disabled = false;
            sendBtn.innerText = '发送请求';
        };

        const formatElapsed = (elapsed) => {
            if (elapsed < 1000) {
                return elapsed + 'ms';
            }

            const seconds = Math.floor(elapsed / 1000);
            const milliseconds = elapsed % 1000;
            return seconds + 's ' + milliseconds + 'ms';
        };

        const startUI = () => {
            sendBtn.disabled = true;
            sendBtn.innerText = '正在计算...';
            resetUI();
        };

        sendBtn.onclick = async () => {
            const prompt = promptInput.value.trim();
            if (!prompt) return;

            startUI();

            try {
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt })
                });

                if (!response.ok) {
                    throw new Error('请求失败，状态码: ' + response.status);
                }

                if (!response.body) {
                    throw new Error('响应体为空');
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const events = buffer.split('\\n\\n');
                    buffer = events.pop() || '';

                    for (const event of events) {
                        const line = event.split('\\n').find((item) => item.startsWith('data: '));
                        if (!line) continue;

                        const msg = JSON.parse(line.slice(6));
                        if (msg.allDone) {
                            finishUI();
                            continue;
                        }

                        const { model, result, elapsed } = msg;
                        if (!models.includes(model)) continue;

                        document.getElementById('res-' + model).innerText = result;
                        document.getElementById('time-' + model).innerText = formatElapsed(elapsed);
                    }
                }

                finishUI();
            } catch (e) {
                alert('通信异常: ' + e.message);
                finishUI();
            }
        };

        promptInput.addEventListener('keydown', (event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !sendBtn.disabled) {
                sendBtn.click();
            }
        });
    </script>
</body>
</html>
  `;
}
