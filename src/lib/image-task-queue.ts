/**
 * 图片生成异步任务队列
 * - 提交任务立即返回 task_id
 * - 后台执行 design → generate 流程
 * - 前端轮询 /api/image/status?task_id=xxx 获取结果
 */

interface ImageTask {
  id: string;
  status: 'pending' | 'designing' | 'generating' | 'completed' | 'failed';
  messages: Array<{ role: string; content: string }>;
  result?: {
    imageUrl?: string;
    design?: { type: string; concept: string; reasoning: string };
  };
  error?: string;
  createdAt: number;
  completedAt?: number;
}

/** 内存任务存储（单实例部署足够） */
const taskStore = new Map<string, ImageTask>();

/** 定期清理过期任务（超过 30 分钟） */
const TASK_TTL = 30 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [id, task] of taskStore) {
    if (now - task.createdAt > TASK_TTL) {
      taskStore.delete(id);
    }
  }
}, 60 * 1000);

/** 生成唯一 task_id */
function genTaskId(): string {
  return 'img_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** 提交图片生成任务 */
export function submitImageTask(messages: Array<{ role: string; content: string }>): string {
  const taskId = genTaskId();
  const task: ImageTask = {
    id: taskId,
    status: 'pending',
    messages,
    createdAt: Date.now(),
  };
  taskStore.set(taskId, task);

  // 异步执行（不阻塞调用方）
  executeImageTask(task).catch(err => {
    task.status = 'failed';
    task.error = err instanceof Error ? err.message : '未知错误';
    task.completedAt = Date.now();
    console.error('[IMAGE-TASK] 任务失败:', taskId, err);
  });

  return taskId;
}

/** 查询任务状态 */
export function getImageTaskStatus(taskId: string): ImageTask | undefined {
  return taskStore.get(taskId);
}

/** 异步执行图片生成流程 */
async function executeImageTask(task: ImageTask): Promise<void> {
  const port = process.env.DEPLOY_RUN_PORT || 5000;

  // 第一步：LLM 分析 → 设计图示方案
  task.status = 'designing';
  console.log('[IMAGE-TASK] 开始设计:', task.id);

  const designResp = await fetch(`http://localhost:${port}/api/image/design`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: task.messages }),
  });
  const designData = await designResp.json();

  if (!designData.success || !designData.imagePrompt) {
    throw new Error(designData.error || '图示设计失败');
  }

  // 第二步：生成图片
  task.status = 'generating';
  console.log('[IMAGE-TASK] 开始生图:', task.id);

  const imgResp = await fetch(`http://localhost:${port}/api/image/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: designData.imagePrompt }),
  });
  const imgData = await imgResp.json();

  if (!imgData.success || !imgData.imageUrls?.[0]) {
    throw new Error(imgData.error || '图片生成失败');
  }

  // 完成
  task.status = 'completed';
  task.result = {
    imageUrl: imgData.imageUrls[0],
    design: designData.design,
  };
  task.completedAt = Date.now();
  console.log('[IMAGE-TASK] 完成:', task.id, { duration: `${((task.completedAt - task.createdAt) / 1000).toFixed(1)}s` });
}
