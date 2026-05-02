const PptxGenJS = require('pptxgenjs');

const pptx = new PptxGenJS();
pptx.layout = 'LAYOUT_16x9';
pptx.author = 'Open Teacher Team';
pptx.title = '开放智慧助教 - 创AI案例演示';

// ============ 颜色定义 ============
const C = {
  titleBar: '2D3436',      // 深灰标题栏
  titleText: 'FFFFFF',     // 白色标题字
  bg: 'F8F5F0',            // 暖白背景
  accent: '636E72',        // 灰蓝强调
  accentLight: 'B2BEC3',   // 浅灰
  text: '2D3436',          // 正文深灰
  textLight: '636E72',     // 正文浅灰
  highlight: 'D4A574',     // 暖色高亮
  card: 'FFFFFF',          // 卡片白
  cardBorder: 'DFE6E9',    // 卡片边框
  placeholder: 'B2BEC3',   // 占位区
  placeholderBorder: '636E72',
  coverBg: '2D3436',       // 封面深色背景
};

// ============ 辅助函数 ============
function addTitleBar(slide, title) {
  slide.addShape(pptx.shapes.RECTANGLE, {
    x: 0, y: 0, w: '100%', h: 0.85,
    fill: { color: C.titleBar }
  });
  slide.addText(title, {
    x: 0.6, y: 0.15, w: 12, h: 0.6,
    fontSize: 24, fontFace: 'Microsoft YaHei',
    color: C.titleText, bold: true
  });
}

function addScreenshotPlaceholder(slide, x, y, w, h, description) {
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x, y, w, h,
    rectRadius: 0.1,
    line: { color: C.placeholderBorder, width: 1.5, dashType: 'dash' },
    fill: { color: C.bg }
  });
  slide.addText(`【请插入：${description}】`, {
    x, y, w, h,
    fontSize: 12, fontFace: 'Microsoft YaHei',
    color: C.placeholder, align: 'center', valign: 'middle'
  });
}

function addDiagramImage(slide, imgPath, x, y, w, h) {
  try {
    slide.addImage({ path: imgPath, x, y, w, h });
  } catch(e) {
    // Fallback to placeholder
    addScreenshotPlaceholder(slide, x, y, w, h, '技术示意图');
  }
}

// ============ Slide 1: 封面 ============
const s1 = pptx.addSlide();
s1.addShape(pptx.shapes.RECTANGLE, {
  x: 0, y: 0, w: '100%', h: '100%',
  fill: { color: C.coverBg }
});
s1.addText('开放智慧助教', {
  x: 0.8, y: 1.5, w: 11.5, h: 1.2,
  fontSize: 40, fontFace: 'Microsoft YaHei',
  color: C.titleText, bold: true
});
s1.addText('基于教师知识库的智能语音交互教学系统', {
  x: 0.8, y: 2.8, w: 11.5, h: 0.8,
  fontSize: 22, fontFace: 'Microsoft YaHei',
  color: C.accentLight
});
s1.addShape(pptx.shapes.RECTANGLE, {
  x: 0.8, y: 4.0, w: 3, h: 0.03,
  fill: { color: C.highlight }
});
s1.addText('参赛类别：创AI赋能教学\nXX大学继续教育学院\n团队成员：李明  王芳  陈刚', {
  x: 0.8, y: 4.4, w: 11.5, h: 1.8,
  fontSize: 16, fontFace: 'Microsoft YaHei',
  color: C.accentLight, lineSpacingMultiple: 1.5
});

// ============ Slide 2: 案例概述 ============
const s2 = pptx.addSlide();
s2.background = { fill: C.bg };
addTitleBar(s2, '案例概述');
s2.addText(
  '在成人高等教育领域，非全日制成人学生普遍面临工学矛盾——工作日全职上班，难以到校与教师常态化交流，课后遇到问题无人解答。同时，成人学生基础普遍薄弱，学习需求差异大，需要更细致耐心和个性化的指导，但教师精力有限难以顾及每位学生。此外，现有AI辅导产品缺乏价值观引导约束，可能回答与教学无关甚至不当的内容，且每次对话从零开始，无法记住学生的知识掌握情况。', {
  x: 0.6, y: 1.1, w: 12.2, h: 2.5,
  fontSize: 15, fontFace: 'Microsoft YaHei',
  color: C.text, lineSpacingMultiple: 1.6, valign: 'top'
});
s2.addText(
  '本系统——"开放智慧助教"，借助国产大模型和智能体开发平台，让每位教师创建专属知识库和教学风格的数字助教，为成人学生提供7×24小时语音辅导，引入学生记忆系统实现"记住学生、因材施教"，并内置价值观领域约束机制守护教育安全。', {
  x: 0.6, y: 3.6, w: 12.2, h: 1.8,
  fontSize: 15, fontFace: 'Microsoft YaHei',
  color: C.text, lineSpacingMultiple: 1.6, valign: 'top'
});
// 技术栈标签
const techTags = ['国产大模型(豆包/DeepSeek)', 'Coze智能体平台', 'Web Audio API', 'RAG语义检索', 'Supabase数据库'];
techTags.forEach((tag, i) => {
  s2.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 0.6 + i * 2.5, y: 5.7, w: 2.3, h: 0.45,
    rectRadius: 0.05,
    fill: { color: C.titleBar },
  });
  s2.addText(tag, {
    x: 0.6 + i * 2.5, y: 5.7, w: 2.3, h: 0.45,
    fontSize: 10, fontFace: 'Microsoft YaHei',
    color: C.titleText, align: 'center', valign: 'middle'
  });
});

// ============ Slide 3: 实现功能总览 ============
const s3 = pptx.addSlide();
s3.background = { fill: C.bg };
addTitleBar(s3, '实现功能总览');

const features = [
  { num: '一', title: '语音实时交互', desc: '实时语音问答+回声防护+TTS预解码+短句合并+手动打断' },
  { num: '二', title: '价值观领域约束', desc: 'AI只回答专业问题，超范围礼貌引导，守护教育安全' },
  { num: '三', title: '学生记忆系统', desc: '四维追踪+知识掌握评价+学习诊断与建议，因材施教' },
  { num: '四', title: '知识库管理', desc: '文本/URL/文件上传，RAG语义检索增强对话' },
  { num: '五', title: '教师管理与数字人', desc: '4步设置向导+管理面板+真人照片+音频波纹动画' },
];

features.forEach((f, i) => {
  const row = Math.floor(i / 2);
  const col = i % 2;
  const x = 0.6 + col * 6.2;
  const y = 1.2 + row * 1.7;

  s3.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x, y, w: 5.8, h: 1.4,
    rectRadius: 0.1,
    fill: { color: C.card },
    line: { color: C.cardBorder, width: 0.75 }
  });
  s3.addText(`${f.num}、${f.title}`, {
    x: x + 0.3, y: y + 0.15, w: 5.2, h: 0.5,
    fontSize: 16, fontFace: 'Microsoft YaHei',
    color: C.text, bold: true
  });
  s3.addText(f.desc, {
    x: x + 0.3, y: y + 0.65, w: 5.2, h: 0.6,
    fontSize: 12, fontFace: 'Microsoft YaHei',
    color: C.textLight, lineSpacingMultiple: 1.3
  });
});

// ============ Slide 4: 语音实时交互系统 ============
const s4 = pptx.addSlide();
s4.background = { fill: C.bg };
addTitleBar(s4, '一、语音实时交互系统');

s4.addText('基于Web Audio API构建持久化麦克风管道，实现实时语音检测闭环', {
  x: 0.6, y: 1.1, w: 12, h: 0.5,
  fontSize: 14, fontFace: 'Microsoft YaHei', color: C.text
});
s4.addText('麦克风 → VAD → ASR → LLM+RAG → TTS → 音频波纹动画', {
  x: 0.6, y: 1.7, w: 12, h: 0.5,
  fontSize: 16, fontFace: 'Microsoft YaHei', color: C.highlight, bold: true
});

const voiceInnovations = [
  '回声防护：TTS播放时静音麦克风(gain=0)，杜绝AI语音回传被误识别',
  'TTS预解码：预解码AudioBuffer队列播放，消除段间延迟实现无缝语音',
  '短句合并：<8字短句暂不发送TTS，减少无效请求，提升语音连贯性',
  '手动打断：脉冲停止按钮，即时中断TTS恢复麦克风',
];
voiceInnovations.forEach((item, i) => {
  s4.addText(`● ${item}`, {
    x: 0.8, y: 2.5 + i * 0.45, w: 11.5, h: 0.4,
    fontSize: 13, fontFace: 'Microsoft YaHei', color: C.text
  });
});

addDiagramImage(s4, 'assets/ppt-voice-flow.png', 2.5, 4.4, 8, 1.4);
addScreenshotPlaceholder(s4, 1.5, 5.95, 10, 0.8, '语音对话界面截图（含数字人+音频波纹动画+音量指示器）');

// ============ Slide 5: 价值观领域约束 ============
const s5 = pptx.addSlide();
s5.background = { fill: C.bg };
addTitleBar(s5, '二、价值观领域约束机制');

s5.addText('系统核心设计原则：AI助教只回答专业领域问题', {
  x: 0.6, y: 1.1, w: 6, h: 0.5,
  fontSize: 15, fontFace: 'Microsoft YaHei', color: C.text, bold: true
});

const constraints = [
  '系统提示词严格限制：只回答与教师专业领域和知识库相关的问题',
  '超出范围时礼貌说明："这个问题超出了我的专业范围，我们继续聊XX吧"',
  '教师档案明确限定专业范围，AI严格按档案定义身份',
  '区别于通用AI"有问必答"，坚守教育者角色，守护教学安全',
];
constraints.forEach((item, i) => {
  s5.addText(`● ${item}`, {
    x: 0.8, y: 1.8 + i * 0.55, w: 5.5, h: 0.5,
    fontSize: 13, fontFace: 'Microsoft YaHei', color: C.text, lineSpacingMultiple: 1.2
  });
});

addScreenshotPlaceholder(s5, 6.8, 1.2, 5.8, 5.0, '价值观约束对话截图\n（如学生问天气被拒绝\n并引导回学科内容）');

// ============ Slide 6: 学生记忆系统 - 总览 ============
const s6 = pptx.addSlide();
s6.background = { fill: C.bg };
addTitleBar(s6, '三、学生记忆系统 — 总览');

s6.addText('核心能力："记住学生、因材施教"，按教师完全隔离', {
  x: 0.6, y: 1.1, w: 12, h: 0.4,
  fontSize: 14, fontFace: 'Microsoft YaHei', color: C.text, bold: true
});

const memoryPoints = [
  '四大数据维度：学生画像 | 知识掌握 | 对话记录 | 教学策略',
  '三阶段工作流：对话前检索 → 对话中个性化 → 对话后自动更新',
  '两大核心功能：知识掌握评价机制 + 学习诊断与建议',
];
memoryPoints.forEach((item, i) => {
  s6.addText(item, {
    x: 0.8, y: 1.6 + i * 0.4, w: 11, h: 0.35,
    fontSize: 13, fontFace: 'Microsoft YaHei', color: C.text
  });
});

addDiagramImage(s6, 'assets/ppt-memory-overview.png', 2.0, 2.7, 9, 2.8);
addScreenshotPlaceholder(s6, 1.5, 5.7, 10, 0.9, '教师管理面板-学生记忆总览截图（知识掌握三档列表+对话历史+教学策略）');

// ============ Slide 7: 知识掌握评价 ============
const s7 = pptx.addSlide();
s7.background = { fill: C.bg };
addTitleBar(s7, '三、学生记忆系统 — 知识掌握评价');

s7.addText('系统在对话中主动提出验证问题，根据学生回答评价掌握程度', {
  x: 0.6, y: 1.1, w: 12, h: 0.4,
  fontSize: 14, fontFace: 'Microsoft YaHei', color: C.text
});

const masteryPoints = [
  '三档分类：已掌握(≥0.6) / 学习中(0.3~0.5) / 薄弱(<0.3)',
  '评价规则：验证通过→0.8 | 说懂未测试→+0.1 | 困惑答错→-0.1',
  '学生说"懂了"必须出验证测试，通过才标记已掌握',
  '知识点模糊匹配与自动合并：避免同一知识点重复记录',
];
masteryPoints.forEach((item, i) => {
  s7.addText(`● ${item}`, {
    x: 0.8, y: 1.6 + i * 0.42, w: 11, h: 0.38,
    fontSize: 13, fontFace: 'Microsoft YaHei', color: C.text
  });
});

addDiagramImage(s7, 'assets/ppt-mastery.png', 1.5, 3.4, 10, 1.8);
addScreenshotPlaceholder(s7, 1.5, 5.5, 10, 1.1, '验证测试对话截图（学生说懂了→AI出验证题→学生答对/答错）');

// ============ Slide 8: 学习诊断与建议 ============
const s8 = pptx.addSlide();
s8.background = { fill: C.bg };
addTitleBar(s8, '三、学生记忆系统 — 学习诊断与建议');

s8.addText('对话后LLM自动分析对话内容，提取问题并生成建议', {
  x: 0.6, y: 1.1, w: 12, h: 0.4,
  fontSize: 14, fontFace: 'Microsoft YaHei', color: C.text
});
s8.addText('发现的问题 → 学习建议 → 全部注入AI上下文，指导下一次对话', {
  x: 0.6, y: 1.6, w: 12, h: 0.4,
  fontSize: 14, fontFace: 'Microsoft YaHei', color: C.highlight, bold: true
});

// 两列布局
s8.addText('发现的问题（自动提取）', {
  x: 0.6, y: 2.2, w: 5.5, h: 0.4,
  fontSize: 14, fontFace: 'Microsoft YaHei', color: C.text, bold: true
});
const problems = [
  '学生困惑点：对话中识别的难点和误区',
  '知识薄弱项：连续答错或理解困难的知识点',
  '错误概念：如"混淆了速度和加速度概念"',
];
problems.forEach((item, i) => {
  s8.addText(`● ${item}`, {
    x: 0.8, y: 2.7 + i * 0.4, w: 5.3, h: 0.35,
    fontSize: 12, fontFace: 'Microsoft YaHei', color: C.text
  });
});

s8.addText('学习建议（自动生成）', {
  x: 6.8, y: 2.2, w: 5.5, h: 0.4,
  fontSize: 14, fontFace: 'Microsoft YaHei', color: C.text, bold: true
});
const suggestions = [
  '下次学习方向：基于薄弱点推荐后续学习内容',
  '有效方法推荐：记住对学生最有效的讲解方式',
  '突破点巩固：已取得进展的知识点需继续强化',
];
suggestions.forEach((item, i) => {
  s8.addText(`● ${item}`, {
    x: 7.0, y: 2.7 + i * 0.4, w: 5.3, h: 0.35,
    fontSize: 12, fontFace: 'Microsoft YaHei', color: C.text
  });
});

addDiagramImage(s8, 'assets/ppt-diagnosis.png', 1.5, 3.9, 10, 1.6);
addScreenshotPlaceholder(s8, 1.5, 5.7, 10, 0.9, '教师管理面板-学生记忆详情截图（困惑点+学习建议）');

// ============ Slide 9: 知识库管理 ============
const s9 = pptx.addSlide();
s9.background = { fill: C.bg };
addTitleBar(s9, '四、知识库管理');

s9.addText('教师专属知识库，RAG语义检索增强对话', {
  x: 0.6, y: 1.1, w: 6, h: 0.4,
  fontSize: 14, fontFace: 'Microsoft YaHei', color: C.text, bold: true
});

const kbFeatures = [
  '文本添加：直接输入教学内容到知识库',
  '链接导入：输入URL自动抓取网页内容',
  '文件上传：支持 .txt .md .csv .json .html .xml .docx .pdf（≤5MB）',
  '一键示例：预置物理/数学/英语等教学示例资料',
  '语义搜索：基于向量检索，精准匹配相关内容',
  '知识库隔离：每位教师独立知识库表，互不干扰',
];
kbFeatures.forEach((item, i) => {
  s9.addText(`● ${item}`, {
    x: 0.8, y: 1.7 + i * 0.5, w: 5.5, h: 0.45,
    fontSize: 13, fontFace: 'Microsoft YaHei', color: C.text
  });
});

addScreenshotPlaceholder(s9, 6.8, 1.2, 5.8, 5.0, '知识库管理界面截图\n（添加文本/上传文件/语义搜索）');

// ============ Slide 10: 教师管理与数字人 ============
const s10 = pptx.addSlide();
s10.background = { fill: C.bg };
addTitleBar(s10, '五、教师管理与数字人');

s10.addText('4步设置向导（首次登录自动引导）', {
  x: 0.6, y: 1.1, w: 6, h: 0.4,
  fontSize: 14, fontFace: 'Microsoft YaHei', color: C.text, bold: true
});

const setupSteps = [
  'Step 1：填写基本信息（姓名、科目、角色）',
  'Step 2：设置授课风格、专业领域、引导问题',
  'Step 3：上传数字人头像（照片+音频波纹动画）',
  'Step 4：初始化知识库（一键导入示例资料）',
];
setupSteps.forEach((item, i) => {
  s10.addText(item, {
    x: 0.8, y: 1.6 + i * 0.45, w: 5.5, h: 0.4,
    fontSize: 13, fontFace: 'Microsoft YaHei', color: C.text
  });
});

s10.addText('管理面板（设置完成后）', {
  x: 0.6, y: 3.6, w: 6, h: 0.4,
  fontSize: 14, fontFace: 'Microsoft YaHei', color: C.text, bold: true
});
s10.addText('助教档案编辑 | 知识库管理 | 学生记忆查看', {
  x: 0.8, y: 4.1, w: 5.5, h: 0.4,
  fontSize: 13, fontFace: 'Microsoft YaHei', color: C.text
});

addScreenshotPlaceholder(s10, 6.8, 1.2, 5.8, 5.0, '教师设置向导/管理面板界面截图');

// ============ Slide 11: 应用情况 ============
const s11 = pptx.addSlide();
s11.background = { fill: C.bg };
addTitleBar(s11, '应用情况');

s11.addText('应用案例', {
  x: 0.6, y: 1.1, w: 6, h: 0.4,
  fontSize: 15, fontFace: 'Microsoft YaHei', color: C.text, bold: true
});
s11.addText(
  '成人高校物理教师李老师，在管理员创建账号后，登录系统5分钟完成4步设置：填写姓名和角色、设置专业领域"力学、电磁学"和教学风格"善于用生活例子解释、讲解节奏偏慢偏细"、上传个人照片、一键导入物理示例资料。完成后学生即可在登录页看到"李老师"助教。', {
  x: 0.6, y: 1.6, w: 6.5, h: 2.0,
  fontSize: 12, fontFace: 'Microsoft YaHei', color: C.text, lineSpacingMultiple: 1.4, valign: 'top'
});
s11.addText(
  '在工厂上班的王同学只能在下班后学习，他登录系统选择"李老师"助教，点击电话按钮即可语音对话。AI助教根据记忆主动回顾上次学习进度，直接说话提问即可。对于基础薄弱的内容，AI自动放慢节奏、用直观方式讲解。当他问"今天天气怎么样"，AI礼貌引导回物理问题。', {
  x: 0.6, y: 3.6, w: 6.5, h: 2.0,
  fontSize: 12, fontFace: 'Microsoft YaHei', color: C.text, lineSpacingMultiple: 1.4, valign: 'top'
});

s11.addText('应用成效', {
  x: 0.6, y: 5.7, w: 6, h: 0.35,
  fontSize: 14, fontFace: 'Microsoft YaHei', color: C.text, bold: true
});
const effects = [
  '突破时空限制：碎片时间获得语音辅导，缓解工学矛盾',
  '个性化教学：记住知识掌握情况和学习偏好，因材施教',
  '价值观约束：AI严格聚焦专业领域，守护教育安全底线',
  '教师知识数字化：教学经验和风格被AI助教永久保留',
];
effects.forEach((item, i) => {
  s11.addText(`● ${item}`, {
    x: 0.8, y: 6.1 + i * 0.3, w: 6, h: 0.28,
    fontSize: 11, fontFace: 'Microsoft YaHei', color: C.text
  });
});

addScreenshotPlaceholder(s11, 7.5, 1.1, 5.2, 4.5, '学生使用场景截图\n（登录选助教/语音对话）');

// ============ Slide 12: 创新与展望 ============
const s12 = pptx.addSlide();
s12.background = { fill: C.bg };
addTitleBar(s12, '创新点与展望');

s12.addText('核心创新', {
  x: 0.6, y: 1.1, w: 6, h: 0.4,
  fontSize: 15, fontFace: 'Microsoft YaHei', color: C.text, bold: true
});
const innovations = [
  '价值观导向的领域约束：区别于通用AI"有问必答"，坚守教育者角色',
  '回声防护方案：浏览器环境下gain=0静音策略，零硬件解决语音回声',
  '学生记忆驱动因材施教：四维追踪+自动注入，实现"越教越懂学生"',
  '教师知识库深度融入：保留个人教学特色，而非使用通用机器人',
];
innovations.forEach((item, i) => {
  s12.addText(`● ${item}`, {
    x: 0.8, y: 1.6 + i * 0.55, w: 11.5, h: 0.5,
    fontSize: 14, fontFace: 'Microsoft YaHei', color: C.text
  });
});

s12.addShape(pptx.shapes.RECTANGLE, {
  x: 0.6, y: 3.9, w: 12, h: 0.02,
  fill: { color: C.accentLight }
});

s12.addText('未来展望', {
  x: 0.6, y: 4.1, w: 6, h: 0.4,
  fontSize: 15, fontFace: 'Microsoft YaHei', color: C.text, bold: true
});
const outlooks = [
  '引入深度学习VAD模型，提升嘈杂环境鲁棒性（如通勤场景）',
  '增加手写输入、公式识别、拍照提问等多模态交互',
  '加强数据加密与未成年人信息保护合规性',
];
outlooks.forEach((item, i) => {
  s12.addText(`● ${item}`, {
    x: 0.8, y: 4.6 + i * 0.55, w: 11.5, h: 0.5,
    fontSize: 14, fontFace: 'Microsoft YaHei', color: C.text
  });
});

// ============ Slide 13: 感谢 ============
const s13 = pptx.addSlide();
s13.addShape(pptx.shapes.RECTANGLE, {
  x: 0, y: 0, w: '100%', h: '100%',
  fill: { color: C.coverBg }
});
s13.addText('谢谢！', {
  x: 1, y: 2.0, w: 11.5, h: 1.2,
  fontSize: 44, fontFace: 'Microsoft YaHei',
  color: C.titleText, bold: true, align: 'center'
});
s13.addText('欢迎体验开放智慧助教', {
  x: 1, y: 3.3, w: 11.5, h: 0.8,
  fontSize: 20, fontFace: 'Microsoft YaHei',
  color: C.accentLight, align: 'center'
});

// ============ 生成文件 ============
const outPath = 'assets/演示PPT.pptx';
pptx.writeFile({ fileName: outPath })
  .then(() => console.log(`PPT saved to ${outPath}`))
  .catch(err => console.error('Error:', err));
