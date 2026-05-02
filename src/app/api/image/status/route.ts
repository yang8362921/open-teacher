import { NextRequest, NextResponse } from 'next/server';
import { getImageTaskStatus } from '@/lib/image-task-queue';

/**
 * 图片生成任务状态查询
 * GET /api/image/status?task_id=xxx
 */
export async function GET(request: NextRequest) {
  const taskId = request.nextUrl.searchParams.get('task_id');

  if (!taskId) {
    return NextResponse.json({ error: '请提供 task_id' }, { status: 400 });
  }

  const task = getImageTaskStatus(taskId);

  if (!task) {
    return NextResponse.json({ error: '任务不存在或已过期' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    task_id: task.id,
    status: task.status,
    result: task.result || null,
    error: task.error || null,
  });
}
