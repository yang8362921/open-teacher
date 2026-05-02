import { NextRequest, NextResponse } from 'next/server';
import { ASRClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { url, base64Data, uid = 'teacher_bot_user' } = await request.json();
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);

    if (!url && !base64Data) {
      return NextResponse.json(
        { error: '请提供音频 URL 或 base64Data' },
        { status: 400 }
      );
    }

    const config = new Config();
    const client = new ASRClient(config, customHeaders);

    const requestParams: { uid: string; url?: string; base64Data?: string } = { uid };
    if (url) {
      requestParams.url = url;
    }
    if (base64Data) {
      requestParams.base64Data = base64Data;
    }

    try {
      const result = await client.recognize(requestParams);

      return NextResponse.json({
        success: true,
        text: result.text,
        duration: result.duration,
        utterances: result.utterances,
      });
    } catch (apiError: unknown) {
      // ASR SDK 业务错误：区分"无语音"和真正的错误
      const errMsg = apiError instanceof Error ? apiError.message : String(apiError);
      const isNoSpeech = errMsg.includes('silence audio') || errMsg.includes('no valid speech') || errMsg.includes('empty audio');

      if (isNoSpeech) {
        // 音频中没有检测到语音 → 返回成功但无文本（前端可优雅处理）
        console.warn('[ASR] 未检测到语音:', errMsg);
        return NextResponse.json({
          success: false,
          text: '',
          reason: 'no_speech',
        });
      }

      // 其他 ASR 错误（格式不支持等）→ 抛出到外层 catch
      throw apiError;
    }
  } catch (error) {
    console.error('语音识别错误:', error);
    return NextResponse.json(
      { error: '语音识别失败' },
      { status: 500 }
    );
  }
}
