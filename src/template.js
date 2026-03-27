export function renderHTML() {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AiChatHub - 多模型聚合</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { background-color: #0f172a; color: #f1f5f9; font-family: sans-serif; }
        .card { background: rgba(30, 41, 59, 0.5); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.1); }
    </style>
</head>
<body class="max-w-7xl mx-auto p-4 md:p-10">
    <header class="mb-10 flex items-center justify-between">
        <h1 class="text-2xl font-black tracking-tight text-blue-400">AiChatHub <span class="text-xs font-normal text-slate-500 uppercase ml-2">v2.0</span></h1>
        <div class="text-xs text-slate-400">基于 Cloudflare Workers 部署 <br> develop by czw</div>
    </header>

    <main>
        <!-- 输入区 -->
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

        <!-- 结果区 -->
        <section class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- MiniMax -->
            <div class="card rounded-2xl p-6">
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center"><span class="w-3 h-3 bg-purple-500 rounded-full mr-2"></span><h3 class="font-bold">MiniMax M2.7</h3></div>
                    <span id="time-minimax" class="text-xs text-slate-500"></span>
                </div>
                <div id="res-minimax" class="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">等待输入...</div>
            </div>
            <!-- kimi -->
            <div class="card rounded-2xl p-6">
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center"><span class="w-3 h-3 bg-green-500 rounded-full mr-2"></span><h3 class="font-bold">kimi-k2.5</h3></div>
                    <span id="time-kimi" class="text-xs text-slate-500"></span>
                </div>
                <div id="res-kimi" class="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">等待输入...</div>
            </div>
            <!-- GLM -->
            <div class="card rounded-2xl p-6">
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center"><span class="w-3 h-3 bg-orange-500 rounded-full mr-2"></span><h3 class="font-bold">GLM 4.7 flash</h3></div>
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

        // 每个模型的独立状态
        const modelStatus = {};
        models.forEach(m => modelStatus[m] = { done: false, elapsed: 0 });

        sendBtn.onclick = async () => {
            const prompt = promptInput.value.trim();
            if (!prompt) return;

            // UI 状态重置
            sendBtn.disabled = true;
            sendBtn.innerText = '正在计算...';
            models.forEach(m => {
                document.getElementById('res-' + m).innerText = '思考中...';
                document.getElementById('time-' + m).innerText = '';
                modelStatus[m] = { done: false, elapsed: 0 };
            });

            try {
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt })
                });

                const reader = response.body.getReader();
                const decoder = new TextDecoder();

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const text = decoder.decode(value);
                    // 解析 SSE 事件 (可能一次收到多行)
                    const lines = text.split('\n');
                    for (const line of lines) {
                        if (!line.startsWith('data: ')) continue;
                        const msg = JSON.parse(line.slice(6));

                        if (msg.allDone) {
                            sendBtn.disabled = false;
                            sendBtn.innerText = '发送请求';
                            continue;
                        }

                        const { model, result, elapsed } = msg;
                        modelStatus[model].done = true;
                        modelStatus[model].elapsed = elapsed;

                        document.getElementById('res-' + model).innerText = result;
                        document.getElementById('time-' + model).innerText = elapsed + 'ms';

                        // 检查是否全部完成
                        const allDone = models.every(m => modelStatus[m].done);
                        if (allDone) {
                            sendBtn.disabled = false;
                            sendBtn.innerText = '发送请求';
                        }
                    }
                }
            } catch (e) {
                alert('通信异常: ' + e.message);
                sendBtn.disabled = false;
                sendBtn.innerText = '发送请求';
            }
        };
    </script>
</body>
</html>
  `;
}