/**
 * Next.js Instrumentation
 * 服务启动时自动执行数据库初始化（建表 + 默认管理员账号）
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // 仅在 Node.js 运行时执行（跳过 Edge Runtime）
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { initializeDatabase } = await import('@/storage/database/init-database');
      await initializeDatabase();
    } catch (err) {
      console.error('[Instrumentation] 数据库初始化异常:', err);
    }
  }
}
