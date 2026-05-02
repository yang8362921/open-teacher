const {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, TabStopPosition, TabStopType,
  convertInchesToTwip, LevelFormat, UnderlineType
} = require('docx');
const fs = require('fs');

// 字号映射：中文字号 → half-point
const FONT_SIZE = {
  ch_xiaoer: 36,   // 小二 = 18pt = 36 half-pt
  ch_san: 30,      // 三号 = 15pt = 30 half-pt
  ch_si: 24,       // 四号 = 14pt = 28 half-pt (not used here)
};

// 行间距28磅 = 28 * 20 = 560 twips
const LINE_SPACING = 560;

// 字体
const FONT_HEITI = '黑体';
const FONT_KAITI = '楷体_GB2312';
const FONT_FANGSONG = '仿宋_GB2312';
const FONT_XIAOBIAOSONG = '方正小标宋简体';

function makeTitle(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { line: LINE_SPACING, before: 200, after: 200 },
    children: [
      new TextRun({
        text,
        font: FONT_XIAOBIAOSONG,
        size: FONT_SIZE.ch_xiaoer,
        bold: true,
      }),
    ],
  });
}

function makeH1(text) {
  return new Paragraph({
    spacing: { line: LINE_SPACING, before: 160, after: 80 },
    children: [
      new TextRun({
        text,
        font: FONT_HEITI,
        size: FONT_SIZE.ch_san,
        bold: true,
      }),
    ],
  });
}

function makeH2(text) {
  return new Paragraph({
    spacing: { line: LINE_SPACING, before: 120, after: 60 },
    children: [
      new TextRun({
        text,
        font: FONT_KAITI,
        size: FONT_SIZE.ch_san,
        bold: true,
      }),
    ],
  });
}

function makeH3(text) {
  return new Paragraph({
    spacing: { line: LINE_SPACING, before: 80, after: 40 },
    children: [
      new TextRun({
        text,
        font: FONT_FANGSONG,
        size: FONT_SIZE.ch_san,
        bold: true,
      }),
    ],
  });
}

function makePara(text) {
  return new Paragraph({
    spacing: { line: LINE_SPACING },
    indent: { firstLine: convertInchesToTwip(0.59) }, // 首行缩进2字符
    children: [
      new TextRun({
        text,
        font: FONT_FANGSONG,
        size: FONT_SIZE.ch_san,
      }),
    ],
  });
}

function makeParaNoIndent(text) {
  return new Paragraph({
    spacing: { line: LINE_SPACING },
    children: [
      new TextRun({
        text,
        font: FONT_FANGSONG,
        size: FONT_SIZE.ch_san,
      }),
    ],
  });
}

function makeTableHeaderRow(cells) {
  return {
    children: cells.map(text => ({
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { line: LINE_SPACING },
          children: [new TextRun({ text, font: FONT_FANGSONG, size: FONT_SIZE.ch_san, bold: true })],
        }),
      ],
    })),
  };
}

function makeTableRow(cells) {
  return {
    children: cells.map(text => ({
      children: [
        new Paragraph({
          spacing: { line: LINE_SPACING },
          children: [new TextRun({ text, font: FONT_FANGSONG, size: FONT_SIZE.ch_san })],
        }),
      ],
    })),
  };
}

async function main() {
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(1),
            bottom: convertInchesToTwip(1),
            left: convertInchesToTwip(1.2),
            right: convertInchesToTwip(1.2),
          },
        },
      },
      children: [
        // 标题
        makeTitle('开发与应用报告'),

        // 一、开发背景
        makeH1('一、开发背景'),

        makePara('在成人高等教育领域，非全日制成人学生普遍面临工学矛盾——工作日全职上班，难以到校参加面授，与教师常态化交流严重不足。同时，成人学生基础普遍薄弱，离校多年知识遗忘严重，需要更细致耐心的讲解；学习需求差异大，知识起点各不相同；学习时间碎片化，只能在零散时段学习。传统在线答疑教师时间有限，无法持续跟踪学生认知状态，每次辅导几乎从零开始。'),

        makePara('生成式人工智能技术为构建"一人一师"的个性化辅导提供了可能，但现有AI辅导产品存在问题：通用性强专业性弱，无法融入教师个人教学风格；缺乏学生认知状态持续追踪；交互形式单一，对基础薄弱的成人学生不够友好；缺乏价值观引导约束，AI可能回答与教学无关甚至不当的内容，存在教育安全风险。'),

        makePara('基于以上痛点，我们借助国产大模型（豆包/DeepSeek）和智能体开发平台（Coze），自主开发了"开放智慧助教"——基于教师个人知识库的智能语音交互教学系统。系统让每位教师创建专属数字助教，为成人学生提供7×24小时个性化语音辅导，引入学生记忆系统实现"记住学生、因材施教"，并通过严格的领域约束机制确保AI助教始终聚焦专业教学，不回答与学科无关的问题，保障教育的正确价值导向。'),

        // 二、设计与开发
        makeH1('二、设计与开发'),

        makeH2('（一）平台/技术选择'),

        makePara('本项目的开发充分利用了生成式AI赋能开发的方式，主要技术选型如下：'),

        // 技术选型表
        {
          rows: [
            makeTableHeaderRow(['类别', '技术方案', '说明']),
            makeTableRow(['大语言模型', '豆包（Doubao）/ DeepSeek', '国产大模型，提供对话生成、知识检索能力']),
            makeTableRow(['AI开发平台', 'Coze', '国产智能体开发平台，提供SDK和API服务']),
            makeTableRow(['语音能力', 'Coze ASR + TTS', '语音识别与语音合成，支持多音色']),
            makeTableRow(['嵌入/知识库', 'Coze Embedding + 知识库API', '语义向量检索增强生成（RAG）']),
            makeTableRow(['图片生成', 'Coze Image Generation', '辅助图示智能生成']),
            makeTableRow(['前端框架', 'Next.js 16 + React 19 + TypeScript 5', '服务端渲染，App Router架构']),
            makeTableRow(['UI组件库', 'shadcn/ui + Tailwind CSS 4', '温暖亲切风格（vintage-grey配色）']),
            makeTableRow(['后端数据库', 'Supabase（PostgreSQL）', '学生记忆系统持久化']),
            makeTableRow(['对象存储', 'S3兼容存储', '教师头像等资源管理']),
          ],
          width: { size: 100, type: 'pct' },
        },

        makePara('开发过程中大量借助AI辅助编程（Vibe Coding模式），从架构设计到功能实现、从UI样式到调试排错，AI深度参与代码编写全过程，显著降低开发门槛。'),

        makeH2('（二）开发过程'),

        makeH3('1. 需求分析与架构设计'),

        makePara('针对成人学生工学矛盾，构建"教师创建知识库→学生随时选择助教→语音/文字实时交互→记忆系统持续优化"的闭环。采用前后端分离架构，后端API路由集成AI能力。'),

        makeH3('2. 教师管理与知识库开发'),

        makePara('实现教师档案体系：管理员创建账号→教师登录完成4步设置向导（信息→风格→头像→知识库）→学生可见助教列表。知识库采用RAG架构，教师上传文本/文件/URL经Coze Embedding向量化后，对话时语义检索增强生成。引入LRU缓存优化重复查询，首次对话延迟减少200~500ms。'),

        makeH3('3. 语音交互系统开发'),

        makePara('基于Web Audio API构建持久化麦克风管道，实现：实时VAD语音活动检测自动识别语音起止；回声防护——TTS播放期间静音麦克风杜绝AI语音回传ASR；TTS流式预解码——逐句请求TTS预解码为AudioBuffer，消除段间延迟；口型同步——参考信号路径驱动数字人口型动画；手动打断与短句合并优化。'),

        makeH3('4. 学生记忆系统与价值观约束开发'),

        makePara('引入五张关联表实现"记住学生、因材施教"：student_profile（画像）、knowledge_mastery（知识掌握追踪）、conversation_log（对话记录）、teaching_strategy（教学策略记忆），全部按teacher_id隔离。对话前检索记忆摘要注入系统提示词，对话后LLM自动分析提取知识点掌握度和教学策略更新。知识掌握评价机制：系统在对话中主动提出验证问题，根据学生回答自动评价掌握程度（已掌握/学习中/薄弱三档），学生表示"懂了"时必须出验证测试，通过才标记已掌握。'),

        makePara('价值观约束是本系统的核心设计原则。系统提示词设置严格的"领域约束"规则：AI助教只回答与教师专业领域和知识库内容相关的问题；超出范围时礼貌说明并引导回擅长领域；坦诚面对专业边界。教师档案明确限定专业领域和擅长方向，AI严格按档案定义身份和专业范围。这一机制确保AI助教始终扮演"专业教师"角色，避免输出与学科无关或不当的内容，保障教育场景的价值导向安全。'),

        makeH2('（三）功能架构'),

        makePara('系统功能架构分为五大模块：身份与权限管理（管理员后台、教师设置向导、学生登录选助教）；数字教学核心模块（语音实时交互、回声防护与手动打断、口型同步动画、文字对话、辅助图示生成）；知识库管理（文本/URL/文件上传、语义搜索、教师档案）；学生记忆系统（画像、知识掌握追踪、对话记录、教学策略记忆、记忆摘要自动注入）；教师管理面板（档案编辑、知识库管理、学生记忆查看）。'),

        // 三、应用过程与效果
        makeH1('三、应用过程与效果'),

        makePara('本系统部署于云端，成人学生无需安装任何软件，利用手机或电脑即可在任何时间获得辅导。以成人高校物理教师李老师为例，她在管理员创建账号后，登录系统完成4步设置：填写姓名和角色、设置专业领域"力学、电磁学"和教学风格"善于用生活例子解释、讲解节奏偏慢"、上传个人照片、一键导入教学资料，整个过程约5分钟。'),

        makePara('在工厂上班的王同学只能在下班后学习，他登录系统选择"李老师"助教，点击电话按钮即可语音对话。AI助教根据记忆主动回顾上次学习进度，王同学直接说话提问，系统自动识别语音、检索知识库、生成口语化回答并语音播报。对于基础薄弱的王同学，AI助教放慢讲解节奏、用生活化类比解释概念，并在学生表示"懂了"时出题验证。如果王同学问"今天天气怎么样"等与物理无关的问题，AI助教会礼貌说明"这是我的专业领域之外，我们继续聊物理吧"，引导回学科内容。经过多次对话，系统积累学习记忆，自动调整策略——已掌握的不重复、薄弱的重点讲，实现因材施教。'),

        makePara('应用成效方面：一是突破时空限制，成人学生可在碎片时间获得语音辅导，缓解工学矛盾；二是实现个性化教学，系统记住每位学生的知识掌握情况和学习偏好；三是价值观约束保障教育安全，AI助教严格聚焦专业领域，不回答无关问题；四是教师知识数字化沉淀，教学经验和风格被AI助教永久保留，持续惠及更多学生。'),

        // 四、创新与反思
        makeH1('四、创新与反思'),

        makeH2('（一）创新点'),

        makeH3('1. 价值观导向的领域约束机制'),

        makePara('不同于通用AI"有问必答"模式，本系统在系统提示词层面设置严格领域约束：AI助教只回答与教师专业领域和知识库相关的问题，超出范围时礼貌引导回擅长领域。教师档案明确限定专业范围，AI严格按档案定义身份。这一机制确保AI始终扮演"专业教师"角色，避免输出与学科无关或不当内容，保障教育正确价值导向。'),

        makeH3('2. 语音实时交互的回声防护'),

        makePara('采用"speaking状态静音麦克风"策略，配合TTS预解码和有序队列播放，在无需外部硬件条件下彻底解决浏览器回声问题，实现流畅语音对话。'),

        makeH3('3. 学生记忆驱动的因材施教'),

        makePara('引入画像、知识掌握、对话历史、教学策略四维记忆追踪，全部按教师隔离。对话中主动验证评价掌握程度，对话后LLM自动提取记忆，对话前注入记忆摘要指导个性化回复，实现"越教越懂学生"的渐进式教学。'),

        makeH3('4. 教师知识库与AI助教深度融合'),

        makePara('教师通过知识库上传、档案编辑、教学风格设定塑造专属AI助教。对基础薄弱的成人学生，教师可设定"节奏偏慢""多用生活类比"等风格，确保AI以最适合的方式指导。'),

        makeH3('5. 全栈AI赋能开发'),

        makePara('整个项目在AI辅助下完成开发，借助Coze平台SDK快速集成LLM、ASR、TTS、知识库等能力，体现了AI赋能教育创新的可行路径。'),

        makeH2('（二）反思与改进方向'),

        makeH3('1. 语音体验仍可优化'),

        makePara('当前VAD基于音量阈值检测，在嘈杂环境中可能误触发。未来可引入基于深度学习的VAD模型（如Silero VAD），提升成人学生在通勤等场景中的使用体验。'),

        makeH3('2. 多模态交互扩展'),

        makePara('目前支持语音和文字两种方式，未来可增加手写输入、公式识别、图片拍照提问等模态，降低数学、物理等学科中公式和图形的输入门槛。'),

        makeH3('3. 协作学习支持'),

        makePara('当前为"一对一"辅导模式，未来可引入小组讨论、同伴互教等协作学习功能，帮助成人学生建立学习共同体。'),
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync('/workspace/projects/assets/开发与应用报告.docx', buffer);
  console.log('Word document generated successfully!');
}

main().catch(e => { console.error(e); process.exit(1); });
