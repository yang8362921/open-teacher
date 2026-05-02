import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

export const maxDuration = 60;

const DESIGN_SYSTEM_PROMPT = `你是一位教学可视化设计专家。你的任务是：根据学生的困惑，分析如何用图示最好地解释这个知识点。

请按以下步骤思考并输出：
1. 识别学生困惑的核心概念
2. 判断最适合的图示类型（思维导图/流程图/结构图/对比图/示意图/因果图等）
3. 设计图示应包含的关键元素、标签、箭头、分区
4. 说明为什么这种图示能帮助学生理解

输出格式（严格遵守，每项一行）：
图示类型：[类型名称]
核心概念：[概念名称]  
设计思路：[2-3句话解释为什么这种图示有效]
IMAGE_PROMPT：[详细的描述，用于AI生成教学图示。关键要求：
- 必须包含"所有文字标签和标注必须使用中文"这个指令
- 用英文描述整体结构和布局，但具体标签文字用中文给出
- 至少60个单词，必须包含图示类型、标注内容（中文）、箭头/连线关系、配色、布局
- 示例格式：Educational diagram, all text labels must be in Chinese (中文). [结构描述]. Labels: "力", "质量", "加速度". ...
- 关键词：educational diagram, all labels in Chinese, labeled, clean layout, white background, infographic style]`;

export async function POST(request: NextRequest) {
  try {
    const { messages: contextMessages } = await request.json();

    if (!contextMessages || !Array.isArray(contextMessages) || contextMessages.length === 0) {
      return NextResponse.json({ error: '请提供对话上下文' }, { status: 400 });
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    // 构建对话上下文
    const contextSummary = contextMessages
      .slice(-6)
      .map((m: { role: string; content: string }) => `${m.role === 'user' ? '学生' : '老师'}: ${m.content.slice(0, 200)}`)
      .join('\n');

    // 用流式调用但收集完整结果
    const stream = client.stream([
      { role: 'system', content: DESIGN_SYSTEM_PROMPT },
      { role: 'user', content: `请分析以下对话中学生困惑的知识点，设计最佳的教学图示方案：\n\n${contextSummary}` },
    ], {
      model: 'doubao-seed-2-0-lite-260215',
      temperature: 0.3,
    });

    let fullText = '';
    for await (const chunk of stream) {
      if (chunk.content) {
        fullText += chunk.content.toString();
      }
    }

    if (!fullText.trim()) {
      return NextResponse.json({ error: '设计分析失败' }, { status: 500 });
    }

    // 提取 IMAGE_PROMPT 部分
    const promptMatch = fullText.match(/IMAGE_PROMPT[：:]\s*([\s\S]+)/);
    const imagePrompt = promptMatch ? promptMatch[1].trim() : '';

    if (!imagePrompt || imagePrompt.length < 20) {
      return NextResponse.json({ error: '未能生成有效的图示描述', raw: fullText }, { status: 500 });
    }

    console.log('[IMAGE-DESIGN] 设计完成', { promptLength: imagePrompt.length });

    return NextResponse.json({
      success: true,
      design: {
        type: fullText.match(/图示类型[：:]\s*(.+)/)?.[1]?.trim() || '',
        concept: fullText.match(/核心概念[：:]\s*(.+)/)?.[1]?.trim() || '',
        reasoning: fullText.match(/设计思路[：:]\s*([\s\S]+?)(?=IMAGE_PROMPT)/)?.[1]?.trim() || '',
      },
      imagePrompt,
    });
  } catch (error) {
    console.error('[IMAGE-DESIGN] 设计异常:', error);
    return NextResponse.json({ error: '图示设计服务异常' }, { status: 500 });
  }
}
