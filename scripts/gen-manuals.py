#!/usr/bin/env python3
"""生成使用手册和开发手册PDF"""

import os
from fpdf import FPDF

# ========== 字体配置 ==========
FONT_CJK = "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc"
FONT_MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
FONT_SANS = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_SANS_B = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_SANS_I = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"  # 无Oblique变体，复用常规
FONT_CJK_B = FONT_CJK  # 微米黑无粗体变体，复用

ASSETS_DIR = "/workspace/projects/assets"

# ========== 通用PDF类 ==========
class ManualPDF(FPDF):
    def __init__(self):
        super().__init__()
        self.add_font("cjk", "", FONT_CJK)
        self.add_font("cjk", "B", FONT_CJK_B)
        self.add_font("mono", "", FONT_MONO)
        self.add_font("sans", "", FONT_SANS)
        self.add_font("sans", "B", FONT_SANS_B)
        self.add_font("sans", "I", FONT_SANS_I)
        self.set_auto_page_break(True, margin=20)

    def header(self):
        if self.page_no() <= 1:
            return
        self.set_font("cjk", "", 7)
        self.set_text_color(150, 150, 150)
        self.cell(0, 8, "开放智慧助教 (Open Teacher)", align="L")
        self.cell(0, 8, f"第 {self.page_no()} 页", align="R", new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(200, 200, 200)
        self.line(15, 13, self.w - 15, 13)
        self.ln(3)

    def footer(self):
        pass

    def cover_page(self, title, subtitle, info_lines):
        self.add_page()
        self.ln(50)
        # 装饰线
        self.set_draw_color(100, 116, 139)
        self.set_line_width(1)
        self.line(30, 60, self.w - 30, 60)
        # 标题
        self.set_font("cjk", "B", 28)
        self.set_text_color(30, 41, 59)
        self.cell(0, 18, title, align="C", new_x="LMARGIN", new_y="NEXT")
        self.ln(4)
        # 副标题
        self.set_font("cjk", "", 16)
        self.set_text_color(100, 116, 139)
        self.cell(0, 12, subtitle, align="C", new_x="LMARGIN", new_y="NEXT")
        # 装饰线
        self.set_draw_color(100, 116, 139)
        self.set_line_width(1)
        self.line(30, self.get_y() + 6, self.w - 30, self.get_y() + 6)
        self.ln(20)
        # 信息
        self.set_font("cjk", "", 11)
        self.set_text_color(80, 80, 80)
        for line in info_lines:
            self.cell(0, 8, line, align="C", new_x="LMARGIN", new_y="NEXT")

    def chapter_title(self, num, title):
        self.add_page()
        self.set_font("cjk", "B", 18)
        self.set_text_color(30, 41, 59)
        text = f"第{num}章  {title}" if num else title
        self.cell(0, 14, text, new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(100, 116, 139)
        self.set_line_width(0.8)
        self.line(15, self.get_y() + 2, self.w - 15, self.get_y() + 2)
        self.ln(8)

    def section_title(self, title):
        self.ln(4)
        self.set_font("cjk", "B", 13)
        self.set_text_color(50, 60, 80)
        self.cell(0, 10, title, new_x="LMARGIN", new_y="NEXT")
        self.ln(1)

    def subsection_title(self, title):
        self.ln(2)
        self.set_font("cjk", "B", 11)
        self.set_text_color(70, 80, 100)
        self.cell(0, 8, title, new_x="LMARGIN", new_y="NEXT")
        self.ln(1)

    def body_text(self, text):
        self.set_font("cjk", "", 10)
        self.set_text_color(40, 40, 40)
        self.multi_cell(0, 6.5, text)
        self.ln(2)

    def bullet_list(self, items, indent=8):
        self.set_font("cjk", "", 10)
        self.set_text_color(40, 40, 40)
        for item in items:
            x = self.get_x()
            self.set_x(x + indent)
            self.multi_cell(self.w - 15 - x - indent, 6.5, f"  - {item}")
            self.ln(1)
        self.ln(2)

    def numbered_list(self, items, indent=8):
        self.set_font("cjk", "", 10)
        self.set_text_color(40, 40, 40)
        for i, item in enumerate(items, 1):
            x = self.get_x()
            self.set_x(x + indent)
            self.multi_cell(self.w - 15 - x - indent, 6.5, f"  {i}. {item}")
            self.ln(1)
        self.ln(2)

    def info_box(self, title, text):
        self.set_fill_color(240, 245, 250)
        y_start = self.get_y()
        self.set_font("cjk", "B", 10)
        self.set_text_color(30, 60, 110)
        self.set_x(20)
        self.cell(self.w - 40, 7, f"  {title}", fill=True, new_x="LMARGIN", new_y="NEXT")
        self.set_font("cjk", "", 9.5)
        self.set_text_color(50, 50, 70)
        self.set_x(20)
        self.multi_cell(self.w - 40, 6, f"  {text}", fill=True)
        self.ln(4)

    def simple_table(self, headers, rows, col_widths):
        """简单表格，自动换行"""
        # Header
        self.set_font("cjk", "B", 9)
        self.set_fill_color(50, 60, 80)
        self.set_text_color(255, 255, 255)
        for h, w in zip(headers, col_widths):
            self.cell(w, 7, f" {h}", border=1, fill=True)
        self.ln()
        # Rows
        self.set_font("cjk", "", 8)
        self.set_text_color(40, 40, 40)
        for row in rows:
            # Calculate max height needed
            max_lines = 1
            for cell_text, w in zip(row, col_widths):
                char_per_line = max(1, int(w / 2.2))
                lines = (len(cell_text) + char_per_line - 1) // char_per_line
                max_lines = max(max_lines, lines)
            row_h = max(7, max_lines * 5)
            if self.get_y() + row_h > self.h - 25:
                self.add_page()
            y0 = self.get_y()
            x0 = self.get_x()
            for cell_text, w in zip(row, col_widths):
                self.rect(x0, y0, w, row_h)
                self.set_xy(x0 + 1, y0 + 1)
                self.multi_cell(w - 2, 4.5, cell_text)
                x0 += w
            self.set_xy(15, y0 + row_h)
        self.set_x(15)  # 确保表格后重置x位置

    def code_block(self, text):
        self.set_fill_color(245, 247, 250)
        self.set_font("cjk", "", 8)  # 使用中文字体以支持中文代码注释
        self.set_text_color(60, 60, 60)
        lines = text.strip().split("\n")
        for line in lines:
            if self.get_y() > self.h - 25:
                self.add_page()
            self.set_x(20)
            self.cell(self.w - 40, 4.5, f"  {line[:100]}", fill=True, new_x="LMARGIN", new_y="NEXT")
        self.ln(4)


# ================================================================
#  使用手册
# ================================================================
def generate_user_manual():
    pdf = ManualPDF()
    pdf.set_title("开放智慧助教 使用手册")
    pdf.set_author("Open Teacher Team")

    # ---- 封面 ----
    pdf.cover_page(
        "开放智慧助教",
        "使用手册",
        ["Open Teacher - 基于知识库的智能语音教学助手",
         "", "版本 1.0", "2025年4月"]
    )

    # ---- 目录 ----
    pdf.add_page()
    pdf.set_font("cjk", "B", 18)
    pdf.set_text_color(30, 41, 59)
    pdf.cell(0, 14, "目  录", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)
    toc_items = [
        ("第一章", "系统简介"),
        ("第二章", "快速开始"),
        ("第三章", "管理员操作"),
        ("第四章", "教师操作"),
        ("第五章", "学生操作"),
        ("第六章", "常见问题"),
    ]
    pdf.set_font("cjk", "", 12)
    pdf.set_text_color(40, 40, 40)
    for ch, title in toc_items:
        pdf.cell(0, 9, f"  {ch}  {title}", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)

    # ---- 第一章 系统简介 ----
    pdf.chapter_title("一", "系统简介")

    pdf.section_title("1.1 系统概述")
    pdf.body_text(
        "开放智慧助教（Open Teacher）是一个基于教师个人知识库的智能语音交互教学系统，"
        "面向非全日制成人学生，解决工学矛盾下的师生交流不足问题。每位教师可以创建专属的数字助教，"
        "将自己的教学经验、知识体系和教学风格数字化，实现7x24小时个性化语音辅导。"
    )

    pdf.section_title("1.2 核心特色")
    pdf.bullet_list([
        "语音实时对话：基于Web Audio API的语音交互，支持自动语音识别、AI回复语音播报",
        "价值观领域约束：AI助教只回答与教师专业领域相关的问题，拒绝回答无关或不适当内容",
        "学生记忆系统：记住每位学生的知识掌握情况和学习偏好，实现因材施教、越教越懂学生",
        "教师专属知识库：每位教师上传自己的教学资料，AI基于教师的知识体系回答问题",
        "数字人形象与音频波纹：使用教师真实照片作为数字人形象，语音播报时展示音频波纹动画，直观反馈播放状态",
        "多角色管理：管理员、教师、学生三种角色，权限隔离，数据安全",
    ])

    pdf.section_title("1.3 用户角色")
    pdf.subsection_title("管理员")
    pdf.body_text("负责系统运维和账号管理，包括创建教师账号、管理学生账号、启用/禁用用户。")
    pdf.subsection_title("教师")
    pdf.body_text("创建和管理自己的AI助教，包括设置教学档案、上传知识库、配置数字人形象。")
    pdf.subsection_title("学生")
    pdf.body_text("选择助教进行学习，通过语音或文字与AI助教交互，获得个性化辅导。")

    # ---- 第二章 快速开始 ----
    pdf.chapter_title("二", "快速开始")

    pdf.section_title("2.1 系统访问")
    pdf.body_text("在浏览器中打开系统网址即可访问。系统支持PC端和手机端浏览器，推荐使用Chrome、Edge、Safari最新版本。")
    pdf.info_box("提示", "手机浏览器扫码可直接打开系统，无需安装任何App。首次使用语音功能时，浏览器会请求麦克风权限，请点击允许。")

    pdf.section_title("2.2 使用流程概览")
    pdf.body_text("系统的完整使用流程如下：")
    pdf.numbered_list([
        "管理员登录后台，创建教师账号（设置用户名和密码）",
        "教师使用管理员分配的账号登录，完成4步设置向导",
        "学生输入姓名，选择已配置好的助教，开始学习",
        "学生通过语音或文字与AI助教交互，获得个性化辅导",
    ])

    # ---- 第三章 管理员操作 ----
    pdf.chapter_title("三", "管理员操作")

    pdf.section_title("3.1 管理员登录")
    pdf.body_text("在登录页面点击「管理员入口」，输入管理员账号和密码。默认管理员账号：admin，默认密码：admin123。")
    pdf.info_box("安全提示", "首次登录后请及时修改默认密码，确保系统安全。")

    pdf.section_title("3.2 教师账号管理")
    pdf.subsection_title("创建教师账号")
    pdf.numbered_list([
        "在管理面板的「教师管理」标签页，点击「创建教师」按钮",
        "填写教师姓名、设置登录用户名和密码",
        "点击确认，系统自动创建教师账号",
        "将用户名和密码告知对应教师",
    ])

    pdf.subsection_title("启用/禁用教师")
    pdf.body_text("在教师列表中，通过开关按钮控制教师账号的启用状态。禁用后该教师无法登录，其助教也不会对学生显示。")

    pdf.subsection_title("删除教师")
    pdf.body_text("删除教师将同时删除其所有关联数据（知识库、学生记忆、对话记录等），此操作不可撤销，请谨慎操作。")

    pdf.section_title("3.3 学生账号管理")
    pdf.body_text("在「学生管理」标签页可以查看所有学生，支持启用/禁用和删除操作。禁用后该学生无法登录系统。")

    # ---- 第四章 教师操作 ----
    pdf.chapter_title("四", "教师操作")

    pdf.section_title("4.1 教师登录")
    pdf.body_text("在登录页面选择「教师登录」，输入管理员分配的用户名和密码。首次登录将自动进入设置向导。")

    pdf.section_title("4.2 设置向导（首次登录）")
    pdf.body_text("首次登录需完成4步设置，完成后学生才能看到您的助教：")

    pdf.subsection_title("Step 1：基本信息")
    pdf.body_text("填写姓名、职称和所授科目。这些信息将展示给学生，帮助他们选择助教。")

    pdf.subsection_title("Step 2：授课风格")
    pdf.body_text("填写专业领域、教学风格描述和引导性问题。教学风格描述将影响AI的回复方式，例如\"善于用生活例子解释抽象概念\"。引导性问题是学生在没有明确提问时，AI主动引导讨论的话题。")
    pdf.info_box("快速模板", "系统提供物理教师、数学教师、英语教师、AI计算机教师四种预设模板，可一键填入后修改。")

    pdf.subsection_title("Step 3：上传数字人头像")
    pdf.body_text("上传一张个人照片作为数字人形象。建议使用正面免冠照，背景简洁。照片将作为AI助教的头像展示给学生，语音播报时会在头像周围展示音频波纹动画。")

    pdf.subsection_title("Step 4：初始化知识库")
    pdf.body_text("选择添加知识库内容的方式：")
    pdf.bullet_list([
        "文本添加：直接输入教学资料文本",
        "链接导入：输入网页URL，系统自动抓取内容",
        "文件上传：上传txt、md、csv、json、html、xml格式文件（单文件不超过5MB）",
        "示例资料：一键导入系统预置的各学科示例教学资料",
    ])

    pdf.section_title("4.3 管理面板")
    pdf.body_text("设置向导完成后进入管理面板，包含三个标签页：")

    pdf.subsection_title("助教档案")
    pdf.body_text("查看和编辑教师档案信息，包括基本信息、授课风格、引导问题。修改后点击保存即可生效。")

    pdf.subsection_title("知识库")
    pdf.body_text("管理教学知识库内容，支持以下操作：")
    pdf.bullet_list([
        "添加文本：输入标题和内容，点击添加",
        "添加链接：输入网页URL，系统自动解析并导入",
        "上传文件：拖拽或选择文件上传",
        "搜索知识：输入关键词，查看相关知识库内容",
        "添加示例：一键导入各学科示例教学资料",
    ])

    pdf.subsection_title("学生记忆")
    pdf.body_text("查看学生的学习记忆数据，包括：")
    pdf.bullet_list([
        "学生画像：学习风格、兴趣偏好、性格特点",
        "知识掌握：各知识点的掌握程度（已掌握/学习中/薄弱）",
        "对话记录：历史对话摘要和关键时刻",
        "教学策略：对每位学生有效/无效的教学方法",
    ])

    pdf.section_title("4.4 声音与数字人设置")
    pdf.body_text("在对话界面点击设置图标，可以调整：")
    pdf.bullet_list([
        "语音选择：选择AI助教的音色（男教师/女教师等）",
        "语速调节：调整语音播报的速度",
        "音量调节：调整语音播报的音量",
    ])

    # ---- 第五章 学生操作 ----
    pdf.chapter_title("五", "学生操作")

    pdf.section_title("5.1 学生登录")
    pdf.body_text("在登录页面输入姓名，点击登录。系统会展示所有已配置完成的助教列表，每个助教显示头像、姓名、科目和简介。点击选择一位助教即可进入学习。")
    pdf.info_box("提示", "同一姓名在不同助教下有独立的学习记忆，互不影响。这意味着不同科目的AI助教会分别记住你在该科目的学习情况。")

    pdf.section_title("5.2 语音交互")
    pdf.subsection_title("开始对话")
    pdf.body_text("点击界面中央的电话按钮，系统请求麦克风权限后即可开始语音对话。对着麦克风说话，AI助教会自动识别语音并回复。")

    pdf.subsection_title("对话流程")
    pdf.numbered_list([
        "点击电话按钮，进入通话状态",
        "AI助教根据你的学习记忆主动打招呼",
        "直接说话提问，系统自动检测语音起止",
        "AI检索知识库，生成回答并语音播报",
        "播报结束后自动回到聆听状态，等待下一次提问",
        "通话结束后点击挂断按钮退出",
    ])

    pdf.subsection_title("手动打断")
    pdf.body_text("AI正在播报时，界面会显示醒目的停止按钮。点击后AI立即停止播报，回到聆听状态，你可以重新提问。")

    pdf.subsection_title("语音状态指示")
    pdf.bullet_list([
        "聆听中：麦克风图标脉冲动画，表示正在监听",
        "思考中：等待AI生成回复",
        "播报中：音频波纹动画环绕数字人形象，显示停止按钮",
    ])

    pdf.section_title("5.3 文字对话")
    pdf.body_text("在底部输入框中输入问题，按回车或点击发送按钮。AI助教会以文字形式回复，同时可点击语音按钮收听语音播报。")

    pdf.section_title("5.4 辅助图示")
    pdf.body_text("当AI助教解释复杂概念时，可能会建议生成辅助图示。点击确认后，系统将自动生成相关示意图，帮助理解抽象概念。")

    pdf.section_title("5.5 学习记忆")
    pdf.body_text("系统会自动记住你的学习情况：")
    pdf.bullet_list([
        "已掌握的知识点：AI不会再重复讲解基础概念",
        "正在学习的知识点：AI会巩固和补充，不需要从零开始",
        "薄弱的知识点：AI会重点讲解，放慢节奏，用更直观的方式",
        "你的学习偏好：AI会优先使用你喜欢的讲解方式",
    ])
    pdf.info_box("提示", "当你对某个知识点说\"懂了\"时，AI会出一道验证测试，只有通过测试才会标记为已掌握，确保真正掌握。")

    # ---- 第六章 常见问题 ----
    pdf.chapter_title("六", "常见问题")

    faqs = [
        ("Q: 浏览器提示麦克风权限被拒绝怎么办？",
         "A: 请在浏览器地址栏左侧点击锁图标，找到麦克风权限，改为允许，然后刷新页面重试。"),
        ("Q: 语音识别不准确怎么办？",
         "A: 请尽量在安静的环境中使用，说话时保持正常语速和音量。距离麦克风约30厘米效果最佳。"),
        ("Q: AI回答了与专业无关的问题？",
         "A: 系统设置了价值观领域约束，AI只回答与教师专业相关的问题。如果遇到回答不当的情况，请向教师反馈以便优化知识库。"),
        ("Q: 学生记忆数据会丢失吗？",
         "A: 所有学习记忆数据保存在云端数据库，不会因关闭浏览器而丢失。下次登录同一助教，AI会自动加载你的学习记忆。"),
        ("Q: 一个教师可以有多少学生？",
         "A: 系统不限制学生数量，任何学生都可以选择已配置好的助教进行学习。"),
        ("Q: 手机端可以使用语音功能吗？",
         "A: 可以。在手机浏览器中打开系统网址，点击通话按钮即可使用语音功能，需允许麦克风权限。"),
        ("Q: 忘记教师登录密码怎么办？",
         "A: 请联系管理员重置密码。管理员可在后台的教师管理中重置密码。"),
        ("Q: 上传的文件格式不支持怎么办？",
         "A: 目前支持txt、md、csv、json、html、xml格式。其他格式请先转换为支持的格式后上传。"),
    ]

    for q, a in faqs:
        pdf.set_font("cjk", "B", 10)
        pdf.set_text_color(30, 60, 110)
        pdf.set_x(15)
        pdf.multi_cell(pdf.w - 30, 6.5, q)
        pdf.set_font("cjk", "", 10)
        pdf.set_text_color(40, 40, 40)
        pdf.set_x(15)
        pdf.multi_cell(pdf.w - 30, 6.5, a)
        pdf.ln(3)

    # 保存
    path = os.path.join(ASSETS_DIR, "使用手册.pdf")
    pdf.output(path)
    size = os.path.getsize(path) / 1024
    print(f"使用手册已保存: {path} ({size:.1f} KB, {pdf.page_no()} 页)")


# ================================================================
#  开发手册
# ================================================================
def generate_dev_manual():
    pdf = ManualPDF()
    pdf.set_title("开放智慧助教 开发手册")
    pdf.set_author("Open Teacher Team")

    # ---- 封面 ----
    pdf.cover_page(
        "开放智慧助教",
        "开发手册",
        ["Open Teacher - 基于知识库的智能语音教学助手",
         "", "版本 1.0", "2025年4月"]
    )

    # ---- 目录 ----
    pdf.add_page()
    pdf.set_font("cjk", "B", 18)
    pdf.set_text_color(30, 41, 59)
    pdf.cell(0, 14, "目  录", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)
    toc_items = [
        ("第一章", "项目架构"),
        ("第二章", "技术栈与依赖"),
        ("第三章", "核心模块详解"),
        ("第四章", "API接口文档"),
        ("第五章", "数据库设计"),
        ("第六章", "AI集成规范"),
        ("第七章", "部署与运维"),
    ]
    pdf.set_font("cjk", "", 12)
    pdf.set_text_color(40, 40, 40)
    for ch, title in toc_items:
        pdf.cell(0, 9, f"  {ch}  {title}", new_x="LMARGIN", new_y="NEXT")

    # ---- 第一章 项目架构 ----
    pdf.chapter_title("一", "项目架构")

    pdf.section_title("1.1 整体架构")
    pdf.body_text(
        "项目采用前后端一体的 Next.js App Router 架构。前端基于 React 19 实现交互界面，"
        "后端通过 API Routes（Route Handlers）提供 RESTful 接口，集成 Coze 平台的 LLM、ASR、TTS、"
        "知识库和图片生成等 AI 能力。数据持久化使用 Supabase（PostgreSQL），文件存储使用 S3 兼容对象存储。"
    )

    pdf.section_title("1.2 目录结构")
    pdf.code_block("""\
src/
  app/                          # Next.js App Router
    layout.tsx                  # 根布局（全局样式、Toaster）
    page.tsx                    # 主页面（数字教学+语音交互）
    globals.css                 # 全局样式（Tailwind+主题变量）
    api/                        # API 路由
      chat/route.ts             # 智能对话（核心）
      audio/{asr,tts,proxy}/    # 语音识别/合成/代理
      knowledge/{add,upload,search}/ # 知识库管理
      memory/{recall,update,profile}/ # 学生记忆系统
      image/{design,generate,status}/ # 图片生成
      teacher/route.ts          # 教师管理
      teacher/avatar/route.ts   # 头像上传
      admin/route.ts            # 管理员后台
  components/                   # React 组件
    LoginOverlay.tsx            # 登录页
    TeacherDashboard.tsx        # 教师管理面板
    AdminDashboard.tsx          # 管理员后台
    DigitalHuman.tsx            # 数字人展示组件（教师照片+音频波纹动画）
    VoiceSettings.tsx           # 语音设置
    StudentIdentity.tsx         # 学生身份管理
    KnowledgeManager.tsx        # 知识库管理
    ui/                         # shadcn/ui 组件库
  lib/                          # 工具库
    utils.ts                    # 通用工具函数
    cache.ts                    # LRU 缓存
    image-task-queue.ts         # 图片异步任务队列
  storage/database/             # 数据库
    supabase-client.ts          # Supabase 客户端
    shared/schema.ts            # 数据表 Schema
    shared/relations.ts         # 表关系定义
  hooks/                        # 自定义 Hooks
    use-mobile.ts               # 移动端检测""")

    pdf.section_title("1.3 请求流程")
    pdf.body_text("以语音对话为例，核心请求流程为：")
    pdf.numbered_list([
        "前端 AudioContext 捕获 PCM 音频 -> WAV 编码",
        "POST /api/audio/asr 语音识别 -> 返回文字",
        "POST /api/chat 发送文字 -> 并行加载教师档案+记忆+知识库 -> LLM流式生成",
        "流式文本按标点切分 -> POST /api/audio/tts 逐句合成语音",
        "TTS音频预解码为AudioBuffer -> 有序队列播放",
        "异步 POST /api/memory/update -> LLM分析对话更新记忆",
    ])

    # ---- 第二章 技术栈 ----
    pdf.chapter_title("二", "技术栈与依赖")

    pdf.section_title("2.1 核心技术栈")
    pdf.simple_table(["类别", "技术", "说明"], [
        ["前端框架", "Next.js 16", "App Router, React 19, TypeScript 5"],
        ["UI组件", "shadcn/ui", "基于 Radix UI, Tailwind CSS 4"],
        ["后端框架", "Next.js API Routes", "Route Handlers, Server Components"],
        ["数据库", "Supabase (PG)", "Drizzle ORM, 实时订阅"],
        ["对象存储", "S3 兼容存储", "头像上传, 签名URL访问"],
        ["AI平台", "Coze SDK", "LLM/ASR/TTS/知识库/图片生成"],
        ["LLM", "豆包/DeepSeek", "流式对话, 知识检索增强"],
        ["语音", "Coze ASR/TTS", "WAV格式, 多音色, 语速调节"],
        ["嵌入", "Coze Embedding", "语义向量检索 (RAG)"],
    ], [45, 55, 80])

    pdf.section_title("2.2 关键依赖包")
    pdf.simple_table(["包名", "用途"], [
        ["coze-coding-dev-sdk", "Coze平台AI能力SDK（LLM/ASR/TTS/知识库/图片/嵌入）"],
        ["@supabase/supabase-js", "Supabase客户端，数据库CRUD和实时订阅"],
        ["drizzle-orm", "类型安全的ORM，Schema定义和查询构建"],
        ["sonner", "Toast通知组件，操作反馈提示"],
        ["qrcode.react", "二维码生成组件（登录页扫码访问）"],
        ["lucide-react", "图标库"],
    ], [55, 125])

    # ---- 第三章 核心模块 ----
    pdf.chapter_title("三", "核心模块详解")

    pdf.section_title("3.1 语音交互管道 (page.tsx)")
    pdf.body_text(
        "语音交互是系统最核心最复杂的模块，基于 Web Audio API 构建持久化音频管道。核心组件包括："
    )
    pdf.subsection_title("音频管道架构")
    pdf.code_block("""\
AudioContext (持久化)
  ├── GainNode (回声防护: speaking时gain=0)
  ├── AnalyserNode (VAD音量检测 + 音频波纹动画)
  └── ScriptProcessorNode (PCM采集 -> WAV)""")

    pdf.subsection_title("关键机制")
    pdf.bullet_list([
        "回声防护：TTS播放时将GainNode.gain设为0，彻底阻止麦克风捕获AI语音回传ASR",
        "VAD检测：基于音量阈值+动态校准（25分位数）+静音超时，首轮灵敏度优化（1.3x倍率）",
        "音频波纹动画：TTS播报期间，AnalyserNode实时分析音频频谱数据，驱动数字人周围的波纹动画，直观反馈语音播放状态",
        "TTS预解码：speakSentence获取TTS URI后立即fetch+decodeAudioData预解码为AudioBuffer",
        "有序播放队列：ttsSeqRef/ttsNextPlayRef/ttsResultMapRef确保语音严格按文字顺序播放",
        "短句合并：<8字短句暂不发送TTS，等待累积更多内容，超时1s或>15字强制发送",
        "手动打断：speaking状态显示脉冲停止按钮，点击后递增ttsSessionIdRef使飞行中TTS失效",
        "Ref同步模式：所有回调通过ref.current读取最新状态，避免闭包陷阱",
    ])

    pdf.section_title("3.2 智能对话 (chat/route.ts)")
    pdf.subsection_title("并行化加载")
    pdf.body_text(
        "Chat API接收请求后，并行加载教师档案、学生记忆和知识库上下文，相比串行加载减少200~500ms延迟。"
        "同时引入LRU缓存（教师档案5min、记忆1min、知识库3min），重复查询零延迟。"
    )
    pdf.subsection_title("价值观领域约束")
    pdf.body_text(
        "系统提示词中包含严格的领域约束规则：AI只回答与教师专业领域相关的问题，"
        "拒绝回答闲聊、娱乐、政治等无关内容。区别于通用AI的\"有问必答\"，确保教育场景的安全性。"
    )
    pdf.subsection_title("流式输出")
    pdf.body_text(
        "对话API默认使用SSE协议流式输出。LLM生成文本按标点切分为句子，逐句请求TTS合成，"
        "实现\"边生成边播报\"的体验。文本预处理自动去除Markdown格式，确保语音播报自然流畅。"
    )

    pdf.section_title("3.3 学生记忆系统")
    pdf.subsection_title("三阶段工作流")
    pdf.numbered_list([
        "对话前：调用 /api/memory/recall 检索学生画像、知识掌握、对话历史、教学策略，生成三档分类摘要注入系统提示词",
        "对话中：AI根据记忆个性化回复（已掌握不重复、薄弱点重点讲、使用学生喜欢的讲解方式）",
        "对话后：异步调用 /api/memory/update，LLM自动分析对话提取知识点掌握度、教学策略、学生画像更新",
    ])
    pdf.subsection_title("知识掌握三档评价")
    pdf.body_text(
        "系统通过LLM自动分析学生对话内容，根据学生对问题的回复评价知识点掌握程度，"
        "将知识点分为三档，每档对应不同的教学策略："
    )
    pdf.simple_table(["档位", "mastery_level范围", "教学策略"], [
        ["已掌握", ">= 0.6", "不重复讲解基础概念，可进阶讨论和拓展"],
        ["学习中", "0.3 ~ 0.5", "有了解但未完全掌握，巩固补充不需从零开始"],
        ["薄弱", "< 0.3", "理解困难，重点讲解放慢节奏用直观方式"],
    ], [35, 55, 90])
    pdf.ln(2)
    pdf.subsection_title("掌握度评分机制")
    pdf.body_text("当LLM分析对话内容后，根据学生的表现对mastery_level数值进行调整：")
    pdf.simple_table(["评价类型", "触发条件", "mastery_level变化规则"], [
        ["mastered（已掌握）", "学生通过验证测试（答对问题）", "已有记录直接设为0.8；新建时设为0.7"],
        ["practice（练习中）", "学生说懂了但未测试，或一般性练习", "+0.1（上限0.6，不超过已掌握阈值）"],
        ["confused（困惑）", "学生仍然困惑或答错问题", "-0.1（下限0）"],
    ], [40, 55, 85])
    pdf.ln(2)
    pdf.info_box("验证测试机制",
        "当学生表示\"懂了\"时，AI必须出验证测试题，只有通过测试才会将知识点标记为已掌握（mastery设为0.8），"
        "确保学生真正掌握而非虚报。这是区别于简单关键词匹配的核心评价机制。")
    pdf.ln(2)
    pdf.subsection_title("重复记录合并")
    pdf.body_text(
        "LLM分析可能产生重复知识点记录，系统采用三级模糊匹配自动合并："
        "精确匹配 -> subtopic关键词匹配 -> topic+subtopic全文关键词匹配。"
        "匹配到最佳记录后，扫描所有同topic或subtopic关键词重叠的记录作为重复，"
        "合并practice_count后删除，确保每个知识点只保留一条记录。"
    )
    pdf.subsection_title("数据隔离")
    pdf.body_text(
        "所有记忆数据按 teacher_id 隔离。同一学生在不同教师下有独立画像和知识掌握记录。"
        "学生ID由 name+teacherId 哈希生成，确保稳定唯一。"
    )

    pdf.section_title("3.4 图片生成异步化")
    pdf.body_text(
        "图片生成采用异步任务队列模式：提交任务->立即返回task_id->后台执行LLM设计prompt->图片生成->前端轮询获取结果。"
        "内存任务队列（image-task-queue.ts）管理任务生命周期，支持并发执行，结果缓存5分钟。"
        "前端包含同步降级兜底，确保兼容性。"
    )

    # ---- 第四章 API接口 ----
    pdf.chapter_title("四", "API接口文档")

    pdf.section_title("4.1 接口总览")
    pdf.simple_table(["方法", "路径", "功能", "关键参数"], [
        ["POST", "/api/chat", "智能对话", "message, teacher_id, student_id"],
        ["POST", "/api/audio/asr", "语音识别", "audio_url(audio/WAV)"],
        ["POST", "/api/audio/tts", "语音合成", "text, speaker, speed"],
        ["GET", "/api/audio/proxy", "音频代理", "url(代理TTS)"],
        ["POST", "/api/knowledge/add", "添加知识", "title, content/url"],
        ["POST", "/api/knowledge/upload", "上传文件", "FormData: file"],
        ["POST", "/api/knowledge/search", "搜索知识", "query, table_name"],
        ["POST", "/api/memory/recall", "记忆检索", "student_id, teacher_id"],
        ["POST", "/api/memory/update", "记忆更新", "student_id, messages"],
        ["*", "/api/memory/profile", "学生画像", "GET/POST/DELETE"],
        ["POST", "/api/teacher", "教师管理", "action: login/update"],
        ["GET", "/api/teacher", "教师信息", "id/空(列表)"],
        ["POST", "/api/image/generate", "图片生成", "prompt/messages+async"],
        ["GET", "/api/image/status", "任务状态", "task_id"],
        ["GET/POST", "/api/admin", "管理员", "action: login/toggle"],
    ], [30, 55, 40, 55])

    pdf.section_title("4.2 核心 API 详解")
    pdf.subsection_title("POST /api/chat - 智能对话")
    pdf.body_text("请求体：")
    pdf.code_block('{\n  "message": "学生提问内容",\n  "teacher_id": "教师ID",\n  "student_id": "学生ID",\n  "session_id": "会话ID"\n}')
    pdf.body_text("响应：SSE流式输出，Content-Type: text/event-stream。每条事件为JSON对象，包含role和content字段。")
    pdf.body_text("内部流程：并行加载教师档案+记忆+知识库 -> 拼接系统提示词（含价值观约束） -> LLM流式生成 -> 异步触发记忆更新。")

    pdf.subsection_title("POST /api/memory/recall - 记忆检索")
    pdf.body_text("请求体：")
    pdf.code_block('{\n  "student_id": "学生ID",\n  "teacher_id": "教师ID"\n}')
    pdf.body_text("响应：返回记忆摘要文本，包含学生画像、知识掌握三档分类、对话历史摘要、教学策略。该摘要直接注入对话系统提示词。")

    pdf.subsection_title("POST /api/memory/update - 记忆更新")
    pdf.body_text("请求体：")
    pdf.code_block('{\n  "student_id": "学生ID",\n  "teacher_id": "教师ID",\n  "messages": [\n    {"role":"user","content":"..."},\n    {"role":"assistant","content":"..."}\n  ]\n}')
    pdf.body_text(
        "内部流程：将对话内容发送给LLM分析，提取知识点掌握度（mastered/practice/confused三档）、"
        "教学策略（effective/ineffective）、学生画像更新。模糊匹配与自动合并重复知识点记录。"
    )

    # ---- 第五章 数据库设计 ----
    pdf.chapter_title("五", "数据库设计")

    pdf.section_title("5.1 数据表总览")
    pdf.body_text("系统使用Supabase（PostgreSQL）数据库，通过Drizzle ORM管理Schema。核心数据表如下：")
    pdf.simple_table(["表名", "用途"], [
        ["teacher_profile", "教师档案（姓名/科目/风格/知识库/头像/设置完成标志）"],
        ["student_profile", "学生画像（学习风格/兴趣偏好，按teacher_id隔离）"],
        ["knowledge_mastery", "知识掌握追踪（三档评价，按teacher_id隔离）"],
        ["conversation_log", "对话记录（摘要/关键时刻，按teacher_id隔离）"],
        ["teaching_strategy", "教学策略记忆（有效/无效方法，按teacher_id隔离）"],
        ["admin_account", "管理员账号（用户名/密码）"],
    ], [50, 130])

    pdf.section_title("5.2 核心表结构")
    pdf.subsection_title("teacher_profile")
    pdf.code_block("""\
字段              类型          说明
id               serial        主键
name             varchar(128)  教师姓名
password         varchar(256)  登录密码
username         varchar(128)  登录用户名
title            varchar(128)  职称
subjects         text          所授科目
expertise        text          专业领域
teaching_style   text          教学风格描述
guiding_questions text         引导性问题
avatar_url       text          头像URL
avatar_key       text          S3存储key
knowledge_table  varchar(128)  专属知识库表名
is_setup_complete boolean      设置向导是否完成
is_enabled       boolean       账号是否启用
created_at       timestamp     创建时间""")

    pdf.subsection_title("knowledge_mastery")
    pdf.code_block("""\
字段              类型          说明
id               varchar(36)   主键(UUID)
student_id       varchar(64)   学生ID
subject          varchar(64)   科目
topic            varchar(128)  知识主题
subtopic         varchar(128)  子主题
mastery_level    real          掌握程度(0~1, >=0.6已掌握/0.3~0.5学习中/<0.3薄弱)
practice_count   integer       练习次数
correct_rate     real          正确率
weak_points      text          薄弱点
strong_points    text          优势点
last_practice    timestamp     最近练习时间
created_at       timestamp     创建时间
updated_at       timestamp     更新时间""")

    pdf.section_title("5.3 知识库隔离机制")
    pdf.body_text(
        "每位教师拥有独立的知识库表，表名为教师ID（如 teacher_张三）。知识库的添加、搜索和对话功能"
        "都使用各自的专属表，确保数据完全隔离。系统同时兼容旧表名 teacher_knowledge_base。"
    )

    # ---- 第六章 AI集成 ----
    pdf.chapter_title("六", "AI集成规范")

    pdf.section_title("6.1 Coze SDK使用规范")
    pdf.bullet_list([
        "coze-coding-dev-sdk 必须在后端API路由中使用，严禁在客户端代码中直接调用",
        "必须使用 HeaderUtils.extractForwardHeaders 转发请求头",
        "所有AI调用需包含try-catch错误处理",
        "对话API默认使用流式输出（SSE协议）",
    ])

    pdf.section_title("6.2 LLM集成")
    pdf.subsection_title("系统提示词结构")
    pdf.code_block("""\
[角色定义] 你是{教师姓名}老师的AI助教...
[价值观约束] 你只能回答与{教师专业领域}相关的问题...
[记忆上下文] 学生画像/知识掌握/教学策略摘要
[交互规则] 已掌握不重复/薄弱重点讲/说懂了必须验证测试...
[口语化要求] 使用口语化表达，不使用Markdown格式...""")

    pdf.subsection_title("流式输出")
    pdf.body_text(
        "使用Coze SDK的chat.stream方法获取流式响应，通过ReadableStream逐步输出。"
        "前端通过fetch的body.getReader()读取，实现打字机式渲染。"
    )

    pdf.section_title("6.3 知识库集成 (RAG)")
    pdf.body_text(
        "知识库采用检索增强生成（RAG）架构：教师上传文本/文件/URL -> Coze Embedding向量化 -> "
        "语义检索增强对话。Chat API自动检索相关知识库内容，结合LLM生成回答，确保AI基于教师"
        "自己的知识体系而非通用知识回答问题。"
    )

    pdf.section_title("6.4 ASR/TTS集成")
    pdf.bullet_list([
        "ASR：接收WAV格式音频（PCM 16bit 16kHz），返回识别文字。区分\"无语音\"(success:false, reason:no_speech)和格式错误",
        "TTS：支持多音色(speaker白名单验证)，可调语速和音量。失败自动回退默认speaker",
        "音频代理：/api/audio/proxy解决CORS问题，支持TTS音频流式播放",
    ])

    pdf.section_title("6.5 缓存策略")
    pdf.body_text("LRU缓存配置：")
    pdf.bullet_list([
        "教师档案：5分钟TTL，按teacher_id缓存",
        "学生记忆：1分钟TTL，按student_id+teacher_id缓存",
        "知识库搜索：3分钟TTL，按query+table_name缓存",
        "TTS音频：按text+speaker缓存AudioBuffer（前端内存缓存）",
    ])

    # ---- 第七章 部署 ----
    pdf.chapter_title("七", "部署与运维")

    pdf.section_title("7.1 环境变量")
    pdf.code_block("""\
COZE_WORKSPACE_PATH       # 项目工作目录
COZE_PROJECT_DOMAIN_DEFAULT # 对外访问域名
DEPLOY_RUN_PORT            # 服务监听端口(5000)
COZE_PROJECT_ENV           # DEV/PROD
NEXT_PUBLIC_SUPABASE_URL   # Supabase URL
NEXT_PUBLIC_SUPABASE_ANON_KEY # Supabase匿名密钥""")

    pdf.section_title("7.2 构建与启动")
    pdf.code_block("""\
pnpm install               # 安装依赖
pnpm run build             # 生产构建
pnpm run start             # 启动生产服务(端口5000)
pnpm run dev               # 开发模式(热更新)""")

    pdf.section_title("7.3 数据库初始化")
    pdf.body_text(
        "系统首次启动时自动创建所需数据表和管理员账号（admin/admin123）。"
        "数据库Schema通过Drizzle ORM管理，定义在 src/storage/database/shared/schema.ts 中。"
    )

    pdf.section_title("7.4 开发规范")
    pdf.subsection_title("Ref同步模式")
    pdf.body_text(
        "为避免useCallback闭包捕获旧状态值，采用ref同步模式：所有需要跨回调共享的状态都创建对应的ref，"
        "在渲染阶段直接赋值同步（voiceSettingsRef.current = voiceSettings），"
        "回调内部通过ref.current读取最新值。"
    )
    pdf.subsection_title("Hydration防范")
    pdf.body_text(
        "严禁在JSX渲染逻辑中直接使用typeof window、Date.now()、Math.random()等动态数据，"
        "必须使用use client配合useEffect+useState确保动态内容仅在客户端挂载后渲染。"
    )
    pdf.subsection_title("包管理")
    pdf.body_text("仅允许使用pnpm作为包管理器，严禁使用npm或yarn。")

    # 保存
    path = os.path.join(ASSETS_DIR, "开发手册.pdf")
    pdf.output(path)
    size = os.path.getsize(path) / 1024
    print(f"开发手册已保存: {path} ({size:.1f} KB, {pdf.page_no()} 页)")


# ================================================================
#  主流程
# ================================================================
if __name__ == "__main__":
    generate_user_manual()
    generate_dev_manual()
    print("\n全部完成!")
