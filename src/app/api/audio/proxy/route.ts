import { NextRequest, NextResponse } from 'next/server';

/**
 * 音频代理：将外部 TTS 音频 URL 代理为同源响应，
 * 解决 createMediaElementSource / decodeAudioData 的 CORS 限制。
 * 这样 refAnalyser 才能读到 TTS 播放数据，实现回声消除。
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: 'url parameter is required' }, { status: 400 });
  }

  // 安全校验：只代理音频相关 URL
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return NextResponse.json({ error: 'Invalid URL protocol' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'AI-Teacher-AudioProxy/1.0' },
      signal: AbortSignal.timeout(15000), // 15s 超时
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Upstream returned ${response.status}` },
        { status: response.status }
      );
    }

    const contentType = response.headers.get('content-type') || 'audio/mpeg';
    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, immutable',
        'Content-Length': buffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error('[AUDIO-PROXY] fetch failed:', error);
    return NextResponse.json({ error: 'Proxy fetch failed' }, { status: 502 });
  }
}
