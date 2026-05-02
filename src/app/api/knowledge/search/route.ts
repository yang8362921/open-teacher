import { NextRequest, NextResponse } from 'next/server';
import { KnowledgeClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

export const maxDuration = 60;

/** 统一的知识库表名 */
const DEFAULT_TABLE_NAME = 'coze_doc_knowledge';

export async function POST(request: NextRequest) {
  try {
    const { query, tableName, tableNames, topK = 5, minScore = 0.0 } = await request.json();
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);

    if (!query) {
      return NextResponse.json(
        { error: '请提供搜索查询' },
        { status: 400 }
      );
    }

    const config = new Config();
    const client = new KnowledgeClient(config, customHeaders);

    // 支持单个 tableName 或数组 tableNames
    let searchTables: string[];
    if (tableName) {
      searchTables = [tableName];
      console.log('[KNOWLEDGE SEARCH] 搜索指定表:', tableName);
    } else if (tableNames && tableNames.length > 0) {
      searchTables = tableNames;
      console.log('[KNOWLEDGE SEARCH] 搜索多表:', tableNames);
    } else {
      // 未指定知识库表，返回空结果（避免跨教师数据泄露）
      console.log('[KNOWLEDGE SEARCH] 未指定tableName，拒绝搜索');
      return NextResponse.json({ success: true, results: [], message: '未指定知识库表' });
    }
    
    const response = await client.search(query, searchTables, topK, minScore);

    if (response.code === 0) {
      return NextResponse.json({
        success: true,
        results: response.chunks.map(chunk => ({
          content: chunk.content,
          score: chunk.score,
          docId: chunk.doc_id,
        })),
      });
    } else {
      return NextResponse.json(
        { error: response.msg || '搜索失败' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('搜索知识库错误:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
