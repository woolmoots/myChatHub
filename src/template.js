export function renderHTML() {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>myChatHub - 多模型聚合</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { background-color: #0f172a; color: #f1f5f9; font-family: sans-serif; }
        .card { background: rgba(30, 41, 59, 0.5); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.1); }
    </style>
</head>
<body class="max-w-7xl mx-auto p-4 md:p-10">
    <header class="mb-10 flex items-center justify-between">
        <h1 class="text-2xl font-black tracking-tight text-blue-400">myChatHub <span class="text-xs font-normal text-slate-500 uppercase ml-2">v1.0</span></h1>
        <div class="text-xs text-slate-400">基于 Cloudflare Workers 部署</div>
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
                <div class="flex items-center mb-4"><span class="w-3 h-3 bg-purple-500 rounded-full mr-2"></span><h3 class="font-bold">MiniMax M2.5</h3></div>
                <div id="res-minimax" class="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap italic">等待中...</div>
            </div>
            <!-- Llama 3 -->
            <div class="card rounded-2xl p-6">
                <div class="flex items-center mb-4"><span class="w-3 h-3 bg-green-500 rounded-full mr-2"></span><h3 class="font-bold">Llama 3 (Meta)</h3></div>
                <div id="res-llama3" class="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap italic">等待中...</div>
            </div>
            <!-- Qwen -->
            <div class="card rounded-2xl p-6">
                <div class="flex items-center mb-4"><span class="w-3 h-3 bg-orange-500 rounded-full mr-2"></span><h3 class="font-bold">Qwen 1.5 (Alibaba)</h3></div>
                <div id="res-qwen" class="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap italic">等待中...</div>
            </div>
        </section>
    </main>

    <script>
        const sendBtn = document.getElementById('sendBtn');
        const promptInput = document.getElementById('prompt');
        const models = ['minimax', 'llama3', 'qwen'];

        sendBtn.onclick = async () => {
            const prompt = promptInput.value.trim();
            if (!prompt) return;

            // UI 状态重置
            sendBtn.disabled = true;
            sendBtn.innerText = '正在并行计算...';
            models.forEach(m => {
                const el = document.getElementById('res-' + m);
                el.innerText = '思考中...';
                el.classList.remove('italic');
            });

            try {
                const start = Date.now();
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt })
                });
                const data = await response.json();
                const end = Date.now();

                models.forEach(m => document.getElementById('res-' + m).innerText = data[m]);
                sendBtn.innerText = '发送请求 (耗时 ' + (end - start) + 'ms)';
            } catch (e) {
                alert('通信异常: ' + e.message);
            } finally {
                sendBtn.disabled = false;
            }
        };
    </script>
</body>
</html>
  `;
}