import { NextRequest, NextResponse } from 'next/server';
import { TTSClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { cached, CacheKeys } from '@/lib/cache';

export const maxDuration = 60;

// SDK 官方支持的完整 speaker 列表
const VALID_SPEAKERS = [
  // 通用
  'zh_female_xiaohe_uranus_bigtts',
  'zh_female_vv_uranus_bigtts',
  'zh_male_m191_uranus_bigtts',
  'zh_male_taocheng_uranus_bigtts',
  // 有声书/朗读
  'zh_female_xueayi_saturn_bigtts',
  // 视频配音
  'zh_male_dayi_saturn_bigtts',
  'zh_female_mizai_saturn_bigtts',
  'zh_female_jitangnv_saturn_bigtts',
  'zh_female_meilinvyou_saturn_bigtts',
  'zh_female_santongyongns_saturn_bigtts',
  'zh_male_ruyayichen_saturn_bigtts',
  // 角色扮演
  'saturn_zh_female_keainvsheng_tob',
  'saturn_zh_female_tiaopigongzhu_tob',
  'saturn_zh_male_shuanglangshaonian_tob',
  'saturn_zh_male_tiancaitongzhuo_tob',
  'saturn_zh_female_cancan_tob',
];

export async function POST(request: NextRequest) {
  try {
    const { 
      text, 
      speaker = 'zh_female_xiaohe_uranus_bigtts',
      uid = 'teacher_bot_user',
      audioFormat = 'mp3',
      sampleRate = 24000,
      speechRate = 0,
      loudnessRate = 0
    } = await request.json();
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);

    if (!text) {
      return NextResponse.json(
        { error: '请提供要合成的文本' },
        { status: 400 }
      );
    }

    // 验证 speaker 是否有效
    const validSpeaker = VALID_SPEAKERS.includes(speaker) ? speaker : 'zh_female_xiaohe_uranus_bigtts';

    const safeSpeechRate = Math.round(speechRate ?? 0);
    const safeLoudnessRate = Math.round(loudnessRate ?? 0);

    // TTS 缓存：相同文本+speaker+语速生成相同音频，缓存30分钟
    const cacheKey = CacheKeys.tts(text, validSpeaker, safeSpeechRate);

    const result = await cached(cacheKey, 30 * 60 * 1000, async () => {
      const config = new Config();
      const client = new TTSClient(config, customHeaders);

      try {
        const response = await client.synthesize({
          uid,
          text,
          speaker: validSpeaker,
          audioFormat: audioFormat as 'mp3' | 'pcm' | 'ogg_opus',
          sampleRate: sampleRate as 8000 | 16000 | 22050 | 24000 | 32000 | 44100 | 48000,
          speechRate: safeSpeechRate,
          loudnessRate: safeLoudnessRate,
        });

        return { audioUri: response.audioUri, audioSize: response.audioSize };
      } catch (apiError) {
        console.warn('TTS API调用失败(speaker=%s)：', validSpeaker, apiError);

        // 如果使用自定义 speaker 失败，尝试使用默认 speaker
        if (validSpeaker !== 'zh_female_xiaohe_uranus_bigtts') {
          try {
            const fallbackResponse = await client.synthesize({
              uid,
              text,
              speaker: 'zh_female_xiaohe_uranus_bigtts',
              audioFormat: audioFormat as 'mp3' | 'pcm' | 'ogg_opus',
              sampleRate: sampleRate as 8000 | 16000 | 22050 | 24000 | 32000 | 44100 | 48000,
              speechRate: safeSpeechRate,
              loudnessRate: safeLoudnessRate,
            });

            return { audioUri: fallbackResponse.audioUri, audioSize: fallbackResponse.audioSize };
          } catch {
            throw apiError;
          }
        }

        throw apiError;
      }
    });

    return NextResponse.json({
      success: true,
      audioUri: result.audioUri,
      audioSize: result.audioSize,
    });
  } catch (error) {
    console.error('语音合成错误:', error);
    return NextResponse.json(
      { error: '语音合成失败' },
      { status: 500 }
    );
  }
}
