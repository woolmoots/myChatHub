const extractModelText = (result, fallbackText) => {
  return (
    result?.response ||
    result?.text ||
    result?.choices?.[0]?.message?.content ||
    fallbackText
  );
};

async function runCloudflareModel(env, modelName, prompt, fallbackText) {
  try {
    const result = await env.AI.run(modelName, {
      messages: [{ role: 'user', content: prompt }],
      stream: false,
    });
    return extractModelText(result, fallbackText);
  } catch (error) {
    return `❌ 调用异常: ${error.message}`;
  }
}

export const MODEL_CONFIGS = [
  {
    id: 'llama',
    title: 'Llama 3.1 8B',
    dotClass: 'bg-purple-500',
    run: (prompt, env) =>
      runCloudflareModel(env, '@cf/meta/llama-3.1-8b-instruct', prompt, 'Llama 未返回内容'),
  },
  {
    id: 'kimi',
    title: 'Kimi K2.5',
    dotClass: 'bg-green-500',
    run: (prompt, env) =>
      runCloudflareModel(env, '@cf/moonshotai/kimi-k2.5', prompt, '❌ 无法解析 Kimi 的返回结果'),
  },
  {
    id: 'glm',
    title: 'GLM 4.7 Flash',
    dotClass: 'bg-orange-500',
    run: (prompt, env) =>
      runCloudflareModel(env, '@cf/zai-org/glm-4.7-flash', prompt, 'GLM 未返回内容'),
  },
];
