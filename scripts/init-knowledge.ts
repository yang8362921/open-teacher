import { KnowledgeClient, Config, KnowledgeDocument, DataSourceType } from 'coze-coding-dev-sdk';

const sampleTeachingMaterials = [
  {
    title: '数学教学要点 - 代数基础',
    content: `代数是数学的一个重要分支，主要研究数与数之间的关系和运算规律。在教学中，要重点讲解：

1. 变量的概念和使用
   - 变量是用来表示未知量的符号，通常用字母x、y、z等表示
   - 变量可以代表任意数值，是代数的基础概念

2. 代数式的化简
   - 合并同类项：将相同变量的项合并
   - 去括号法则：括号前是正号，去括号后符号不变；括号前是负号，去括号后符号改变
   - 分配律：a(b+c)=ab+ac

3. 方程的求解方法
   - 一元一次方程：ax+b=0，解为x=-b/a
   - 移项法则：将项从一边移到另一边要改变符号
   - 等式两边同时加减乘除相同的数（除数不为零），等式仍然成立

4. 函数的图像和性质
   - 一次函数：y=kx+b，图像是直线
   - 斜率k决定直线的倾斜程度
   - 截距b是直线与y轴的交点

教学建议：多举生活中的例子，让学生理解代数的实用性。`,
  },
  {
    title: '物理教学 - 牛顿运动定律',
    content: `牛顿运动定律是经典力学的基础，包括：

第一定律（惯性定律）：
- 物体在不受外力或所受合力为零时，保持静止或匀速直线运动状态
- 惯性是物体保持原有运动状态的性质
- 质量是惯性大小的量度

第二定律（加速度定律）：
- 物体的加速度与所受合力成正比，与质量成反比
- 公式：F = ma
- 力的单位是牛顿（N），1N=1kg·m/s²
- 加速度的方向与合力方向相同

第三定律（作用与反作用定律）：
- 两个物体之间的作用力和反作用力大小相等、方向相反
- 作用力和反作用力作用在同一直线上
- 作用力和反作用力同时产生、同时消失
- 注意：作用力和反作用力作用在不同物体上，不能抵消

教学要点：
- 通过实验演示帮助学生理解
- 强调定律的适用条件（宏观、低速、惯性系）
- 结合生活实例分析问题`,
  },
  {
    title: '语文教学 - 现代文阅读技巧',
    content: `现代文阅读是语文学习的重要内容，掌握以下技巧可以提高阅读理解能力：

1. 整体感知
   - 先通读全文，了解文章大意
   - 把握文章的结构和思路
   - 注意文章的标题、开头和结尾

2. 理解词句含义
   - 结合上下文理解词语的特定含义
   - 注意修辞手法的运用
   - 分析关键句子的深层含义

3. 分析文章结构
   - 划分段落层次
   - 理解段落之间的逻辑关系
   - 把握文章的线索

4. 概括中心思想
   - 找出文章的主题句
   - 分析作者的写作目的
   - 用简洁的语言概括主要内容

5. 鉴赏评价
   - 分析文章的写作特色
   - 评价作者的观点态度
   - 结合自身经验谈感悟

常见题型及答题思路：
- 概括题：时间+地点+人物+事件
- 赏析题：手法+内容+效果
- 理解题：表层含义+深层含义

教学建议：让学生多练习，养成圈点批注的阅读习惯。`,
  },
  {
    title: '英语教学 - 词汇记忆方法',
    content: `词汇是英语学习的基础，掌握科学的记忆方法可以事半功倍：

1. 词根词缀记忆法
   - 常见前缀：un-（不）、re-（再）、pre-（前）
   - 常见后缀：-ful（形容词）、-ly（副词）、-tion（名词）
   - 通过词根推测词义

2. 联想记忆法
   - 音形义结合记忆
   - 编写小故事或口诀
   - 利用图片帮助记忆

3. 语境记忆法
   - 在句子中记忆单词
   - 阅读中积累词汇
   - 用新词造句

4. 间隔重复记忆
   - 艾宾浩斯遗忘曲线
   - 及时复习巩固
   - 制定合理的复习计划

5. 分类记忆法
   - 按话题分类（家庭、学校、职业等）
   - 按词性分类（名词、动词、形容词等）
   - 按主题分类（旅游、环保、科技等）

实用技巧：
- 准备单词本，随身携带
- 利用碎片时间记忆
- 多听多说多读多写
- 在实际运用中巩固

教学建议：培养学生持续积累的习惯，每天坚持记忆10-15个单词。`,
  },
  {
    title: '化学教学 - 元素周期表',
    content: `元素周期表是化学学习的重要工具，需要重点掌握：

元素周期表的结构：
- 周期：共7个周期，1-3为短周期，4-7为长周期
- 族：共18个纵列，分为主族（A族）、副族（B族）、VIII族和0族
- 同一周期：电子层数相同，从左到右原子序数递增
- 同一主族：最外层电子数相同，化学性质相似

元素性质的递变规律：
- 原子半径：同周期从左到右逐渐减小，同主族从上到下逐渐增大
- 金属性：同周期从左到右逐渐减弱，同主族从上到下逐渐增强
- 非金属性：同周期从左到右逐渐增强，同主族从上到下逐渐减弱
- 化合价：主族元素最高正价=族序数（O、F除外）

重要元素：
- 氢（H）：最轻的元素，宇宙中含量最多
- 氧（O）：地壳中含量最多的元素
- 碳（C）：有机物的基础元素
- 钠（Na）：活泼金属，与水剧烈反应
- 铁（Fe）：应用最广泛的金属

记忆口诀：
- 第一周期：氢氦
- 第二周期：锂铍硼碳氮氧氟氖
- 第三周期：钠镁铝硅磷硫氯氩

教学建议：让学生理解规律而不是死记硬背，多做练习题巩固。`,
  },
];

async function initKnowledgeBase() {
  console.log('开始初始化教学知识库...\n');

  const config = new Config();
  const client = new KnowledgeClient(config);

  const chunkConfig = {
    separator: '\n\n',
    max_tokens: 1000,
    remove_extra_spaces: true,
  };

  for (let i = 0; i < sampleTeachingMaterials.length; i++) {
    const material = sampleTeachingMaterials[i];
    console.log(`正在添加: ${material.title}`);

    try {
      const documents: KnowledgeDocument[] = [
        {
          source: DataSourceType.TEXT,
          raw_data: `# ${material.title}\n\n${material.content}`,
        },
      ];

      const response = await client.addDocuments(
        documents,
        'teacher_knowledge_base',
        chunkConfig
      );

      if (response.code === 0) {
        console.log(`✓ 成功添加: ${material.title}`);
        console.log(`  文档ID: ${response.doc_ids?.join(', ')}\n`);
      } else {
        console.log(`✗ 添加失败: ${material.title}`);
        console.log(`  错误: ${response.msg}\n`);
      }
    } catch (error) {
      console.log(`✗ 添加出错: ${material.title}`);
      console.log(`  错误: ${error}\n`);
    }

    // 延迟避免请求过快
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('知识库初始化完成！');
}

initKnowledgeBase().catch(console.error);
