import { NextRequest, NextResponse } from 'next/server';
import { KnowledgeClient, Config, HeaderUtils, KnowledgeDocument, DataSourceType } from 'coze-coding-dev-sdk';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

export const maxDuration = 60;

const DEFAULT_TABLE_NAME = 'coze_doc_knowledge';

/** 支持的文件扩展名 */
const TEXT_EXTS = ['.txt', '.md', '.csv', '.json', '.html', '.xml'];
const DOCX_EXTS = ['.docx'];
const PDF_EXTS = ['.pdf'];
const ALL_SUPPORTED_EXTS = [...TEXT_EXTS, ...DOCX_EXTS, ...PDF_EXTS];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const tableName = formData.get('tableName') as string;
    
    if (!tableName) {
      return NextResponse.json({ error: '必须指定 tableName（知识库表名）' }, { status: 400 });
    }

    if (!file) {
      return NextResponse.json({ error: '请提供文件' }, { status: 400 });
    }

    // 检查文件大小
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `文件大小超过限制（最大 5MB），当前 ${Math.round(file.size / 1024)}KB` }, { status: 400 });
    }

    // 检查文件类型
    const fileName = file.name || '';
    const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
    
    if (!ALL_SUPPORTED_EXTS.includes(ext)) {
      return NextResponse.json({ 
        error: `不支持的文件类型: ${ext || '未知'}。支持: ${ALL_SUPPORTED_EXTS.join(', ')}。注意: .doc 格式不支持，请转换为 .docx` 
      }, { status: 400 });
    }

    // .doc 格式不支持（mammoth 只支持 .docx）
    if (ext === '.doc') {
      return NextResponse.json({ 
        error: '不支持 .doc 格式（旧版 Word），请将文件另存为 .docx 格式后重新上传' 
      }, { status: 400 });
    }

    // 读取文件内容
    let content = '';
    try {
      if (DOCX_EXTS.includes(ext)) {
        // .docx 文件：使用 mammoth 提取文本
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const result = await mammoth.extractRawText({ buffer });
        content = result.value;
        if (result.messages && result.messages.length > 0) {
          console.warn('[UPLOAD] Word 解析警告:', result.messages);
        }
      } else if (PDF_EXTS.includes(ext)) {
        // PDF 文件：使用 pdf-parse 提取文本
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const result = await new PDFParse(buffer).getText();
      } else {
        // 纯文本类文件
        content = await file.text();
      }
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error('[UPLOAD] 文件解析失败:', errMsg);
      
      // 根据文件类型给出针对性提示
      if (DOCX_EXTS.includes(ext)) {
        return NextResponse.json({ 
          error: `Word 文件解析失败，文件可能已损坏或不是有效的 .docx 格式。建议：1) 用 Word 重新另存为 .docx；2) 或将内容复制后使用"添加文本"方式上传。错误: ${errMsg}` 
        }, { status: 400 });
      }
      if (PDF_EXTS.includes(ext)) {
        return NextResponse.json({ 
          error: `PDF 文件解析失败，文件可能已损坏或是扫描件（图片PDF无法提取文字）。建议：1) 确保是文字版PDF；2) 或将内容复制后使用"添加文本"方式上传。错误: ${errMsg}` 
        }, { status: 400 });
      }
      return NextResponse.json({ 
        error: `文件读取失败: ${errMsg}` 
      }, { status: 400 });
    }

    if (!content.trim()) {
      return NextResponse.json({ 
        error: '文件内容为空，可能是扫描件PDF（图片无文字层）或空文件' 
      }, { status: 400 });
    }

    // 添加文件名作为标题前缀
    const documentContent = `[文件: ${fileName}]\n\n${content}`;

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new KnowledgeClient(config, customHeaders);

    const documents: KnowledgeDocument[] = [{
      source: DataSourceType.TEXT,
      raw_data: documentContent,
    }];

    const chunkConfig = {
      separator: '\n\n',
      max_tokens: 800,
      remove_extra_spaces: true,
    };

    console.log('[UPLOAD] 上传文件:', fileName, '到表:', tableName, '内容长度:', content.length);
    const response = await client.addDocuments(documents, tableName, chunkConfig);

    if (response.code === 0) {
      return NextResponse.json({
        success: true,
        docIds: response.doc_ids,
        message: `文件 "${fileName}" 添加成功`,
        fileName,
        fileSize: file.size,
      });
    } else {
      return NextResponse.json(
        { error: response.msg || '添加文档失败' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('文件上传错误:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
