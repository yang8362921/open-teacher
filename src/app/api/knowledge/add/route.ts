import { NextRequest, NextResponse } from 'next/server';
import { KnowledgeClient, Config, HeaderUtils, KnowledgeDocument, DataSourceType } from 'coze-coding-dev-sdk';

export const maxDuration = 60;

/** 统一的知识库表名 */
const DEFAULT_TABLE_NAME = 'coze_doc_knowledge';

export async function POST(request: NextRequest) {
  try {
    const { content, url, tableName } = await request.json();
    
    if (!tableName) {
      return NextResponse.json({ error: '必须指定 tableName（知识库表名）' }, { status: 400 });
    }
    
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);

    const config = new Config();
    const client = new KnowledgeClient(config, customHeaders);

    const documents: KnowledgeDocument[] = [];
    
    if (content) {
      documents.push({
        source: DataSourceType.TEXT,
        raw_data: content,
      });
    }
    
    if (url) {
      documents.push({
        source: DataSourceType.URL,
        url: url,
      });
    }

    if (documents.length === 0) {
      return NextResponse.json(
        { error: '请提供 content 或 url' },
        { status: 400 }
      );
    }

    const chunkConfig = {
      separator: '\n\n',
      max_tokens: 800,
      remove_extra_spaces: true,
    };

    const response = await client.addDocuments(documents, tableName, chunkConfig);

    if (response.code === 0) {
      return NextResponse.json({
        success: true,
        docIds: response.doc_ids,
        message: '文档添加成功',
      });
    } else {
      return NextResponse.json(
        { error: response.msg || '添加文档失败' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('添加知识库文档错误:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
