import { NextRequest, NextResponse } from 'next/server';
import { ImageGenerationClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { submitImageTask } from '@/lib/image-task-queue';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, messages, async: asyncMode } = body;

    // 异步模式：提交任务队列
    if (asyncMode && messages && Array.isArray(messages)) {
      const taskId = submitImageTask(messages);
      return NextResponse.json({ success: true, task_id: taskId });
    }

    // 同步模式：直接生成
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json(
        { error: '请提供图片描述' },
        { status: 400 }
      );
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new ImageGenerationClient(config, customHeaders);

    const response = await client.generate({
      prompt: prompt.trim(),
      size: '2560x1440',
      watermark: false,
    });

    const helper = client.getResponseHelper(response);

    if (helper.success && helper.imageUrls.length > 0) {
      console.log('[IMAGE] 图片生成成功', { count: helper.imageUrls.length });
      return NextResponse.json({
        success: true,
        imageUrls: helper.imageUrls,
      });
    } else {
      console.warn('[IMAGE] 图片生成失败:', helper.errorMessages);
      return NextResponse.json(
        { error: '图片生成失败', details: helper.errorMessages },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[IMAGE] 图片生成异常:', error);
    return NextResponse.json(
      { error: '图片生成服务异常' },
      { status: 500 }
    );
  }
}
