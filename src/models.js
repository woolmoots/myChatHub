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

async function runCloudflareInputModel(env, modelName, prompt, fallbackText, instructions) {
  try {
    const result = await env.AI.run(modelName, {
      instructions,
      input: prompt,
    });
    return extractModelText(result, fallbackText);
  } catch (error) {
    return `❌ 调用异常: ${error.message}`;
  }
}

export const MODEL_CONFIGS = [
  {
    id: 'llama4',
    title: 'Llama 4 Scout',
    dotClass: 'bg-purple-500',
    run: (prompt, env) =>
      runCloudflareModel(
        env,
        '@cf/meta/llama-4-scout-17b-16e-instruct',
        prompt,
        'Llama 4 Scout 未返回内容'
      ),
  },
  {
    id: 'kimi',
    title: 'Kimi K2.5',
    dotClass: 'bg-green-500',
    run: (prompt, env) =>
      runCloudflareModel(env, '@cf/moonshotai/kimi-k2.5', prompt, '❌ 无法解析 Kimi 的返回结果'),
  },
  {
    id: 'gptoss',
    title: 'GPT-OSS 120B',
    dotClass: 'bg-orange-500',
    run: (prompt, env) =>
      runCloudflareInputModel(
        env,
        '@cf/openai/gpt-oss-120b',
        prompt,
        'GPT-OSS 120B 未返回内容',
        'You are a concise assistant.'
      ),
  },
];
