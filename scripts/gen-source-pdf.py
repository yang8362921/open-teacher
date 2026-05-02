#!/usr/bin/env python3
"""Generate PDF from project source code with Unicode (Chinese) support."""

import os
import datetime
from fpdf import FPDF

PROJECT_ROOT = "/workspace/projects"
OUTPUT_PATH = os.path.join(PROJECT_ROOT, "assets", "项目源代码.pdf")

# Font paths
FONT_CJK = "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc"
FONT_MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
FONT_MONO_B = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"
FONT_SANS = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_SANS_B = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_SANS_I = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Oblique.ttf"

# Source files to include (ordered by business logic)
SOURCE_FILES = [
    # Config
    "next.config.ts",
    "tsconfig.json",
    "package.json",
    # App entry
    "src/app/globals.css",
    "src/app/layout.tsx",
    "src/app/page.tsx",
    "src/app/robots.ts",
    # API - Chat (core)
    "src/app/api/chat/route.ts",
    "src/app/api/chat/messages/route.ts",
    # API - Audio
    "src/app/api/audio/asr/route.ts",
    "src/app/api/audio/tts/route.ts",
    "src/app/api/audio/proxy/route.ts",
    # API - Knowledge
    "src/app/api/knowledge/add/route.ts",
    "src/app/api/knowledge/upload/route.ts",
    "src/app/api/knowledge/search/route.ts",
    # API - Memory
    "src/app/api/memory/recall/route.ts",
    "src/app/api/memory/update/route.ts",
    "src/app/api/memory/profile/route.ts",
    # API - Teacher
    "src/app/api/teacher/route.ts",
    "src/app/api/teacher/avatar/route.ts",
    # API - Admin
    "src/app/api/admin/route.ts",
    # API - Image
    "src/app/api/image/design/route.ts",
    "src/app/api/image/generate/route.ts",
    "src/app/api/image/status/route.ts",
    # Lib
    "src/lib/utils.ts",
    "src/lib/cache.ts",
    "src/lib/image-task-queue.ts",
    # Server
    "src/server.ts",
    # Storage/Database
    "src/storage/database/supabase-client.ts",
    "src/storage/database/shared/schema.ts",
    "src/storage/database/shared/relations.ts",
    "src/storage/database/init-database.ts",
    # Instrumentation
    "src/instrumentation.ts",
    # API - Setup
    "src/app/api/setup/route.ts",
    # Hooks
    "src/hooks/use-mobile.ts",
    # Components - Business
    "src/components/LoginOverlay.tsx",
    "src/components/DigitalHuman.tsx",
    "src/components/VoiceSettings.tsx",
    "src/components/StudentIdentity.tsx",
    "src/components/StudentMemoryPanel.tsx",
    "src/components/KnowledgeManager.tsx",
    "src/components/TeacherDashboard.tsx",
    "src/components/AdminDashboard.tsx",
    # Components - UI (shadcn)
    "src/components/ui/accordion.tsx",
    "src/components/ui/alert.tsx",
    "src/components/ui/alert-dialog.tsx",
    "src/components/ui/avatar.tsx",
    "src/components/ui/badge.tsx",
    "src/components/ui/button.tsx",
    "src/components/ui/button-group.tsx",
    "src/components/ui/card.tsx",
    "src/components/ui/checkbox.tsx",
    "src/components/ui/collapsible.tsx",
    "src/components/ui/dialog.tsx",
    "src/components/ui/drawer.tsx",
    "src/components/ui/dropdown-menu.tsx",
    "src/components/ui/empty.tsx",
    "src/components/ui/field.tsx",
    "src/components/ui/form.tsx",
    "src/components/ui/input.tsx",
    "src/components/ui/input-group.tsx",
    "src/components/ui/input-otp.tsx",
    "src/components/ui/kbd.tsx",
    "src/components/ui/label.tsx",
    "src/components/ui/menubar.tsx",
    "src/components/ui/navigation-menu.tsx",
    "src/components/ui/popover.tsx",
    "src/components/ui/progress.tsx",
    "src/components/ui/radio-group.tsx",
    "src/components/ui/resizable.tsx",
    "src/components/ui/scroll-area.tsx",
    "src/components/ui/select.tsx",
    "src/components/ui/separator.tsx",
    "src/components/ui/sheet.tsx",
    "src/components/ui/sidebar.tsx",
    "src/components/ui/skeleton.tsx",
    "src/components/ui/slider.tsx",
    "src/components/ui/sonner.tsx",
    "src/components/ui/spinner.tsx",
    "src/components/ui/switch.tsx",
    "src/components/ui/table.tsx",
    "src/components/ui/tabs.tsx",
    "src/components/ui/textarea.tsx",
    "src/components/ui/toggle.tsx",
    "src/components/ui/toggle-group.tsx",
    "src/components/ui/tooltip.tsx",
]


class SourceCodePDF(FPDF):
    def __init__(self):
        super().__init__(orientation="P", unit="mm", format="A4")
        self.set_auto_page_break(auto=True, margin=15)
        self.current_file = ""
        self.line_height = 3.8

        # Register Unicode fonts
        self.add_font("cjk", "", FONT_CJK, uni=True)
        self.add_font("mono", "", FONT_MONO, uni=True)
        self.add_font("mono", "B", FONT_MONO_B, uni=True)
        self.add_font("sans", "", FONT_SANS, uni=True)
        self.add_font("sans", "B", FONT_SANS_B, uni=True)
        self.add_font("sans", "I", FONT_SANS_I, uni=True)

    def header(self):
        if self.page_no() == 1:
            return
        self.set_font("sans", "I", 7)
        self.set_text_color(140, 140, 140)
        self.cell(0, 6, f"Open Teacher Source Code | {self.current_file}", align="L")
        self.ln(8)

    def footer(self):
        self.set_y(-12)
        self.set_font("sans", "I", 7)
        self.set_text_color(140, 140, 140)
        self.cell(0, 10, f"- {self.page_no()} -", align="C")

    def add_cover_page(self, total_files, total_lines):
        self.add_page()
        self.ln(50)
        self.set_font("cjk", "", 28)
        self.set_text_color(51, 51, 51)
        self.cell(0, 15, "开放智慧助教", align="C")
        self.ln(14)
        self.set_font("sans", "B", 18)
        self.set_text_color(80, 80, 80)
        self.cell(0, 10, "Open Teacher", align="C")
        self.ln(14)
        self.set_font("cjk", "", 13)
        self.set_text_color(100, 100, 100)
        self.cell(0, 10, "项目源代码文档", align="C")
        self.ln(25)

        self.set_font("cjk", "", 10)
        self.set_text_color(80, 80, 80)

        info = [
            ("项目名称", "开放智慧助教 - 智能语音交互教学系统"),
            ("技术框架", "Next.js 16 + React 19 + TypeScript 5"),
            ("UI 组件", "shadcn/ui + Tailwind CSS 4"),
            ("AI 能力", "Coze SDK (LLM + ASR + TTS + Knowledge)"),
            ("数据库", "Supabase (PostgreSQL)"),
            ("源码文件数", str(total_files)),
            ("代码总行数", f"{total_lines:,}"),
            ("生成时间", datetime.datetime.now().strftime("%Y-%m-%d %H:%M")),
        ]

        for label, value in info:
            self.set_x(35)
            self.set_font("cjk", "", 10)
            self.cell(30, 7, f"{label}:", align="R")
            self.set_font("cjk", "", 10)
            self.cell(0, 7, f"  {value}")
            self.ln(8)

        self.ln(20)
        self.set_font("cjk", "", 8)
        self.set_text_color(160, 160, 160)
        self.cell(0, 6, "自动生成的项目源代码PDF，用于代码审查和归档。", align="C")

    def add_toc(self, files_with_lines):
        self.add_page()
        self.set_font("cjk", "", 16)
        self.set_text_color(51, 51, 51)
        self.cell(0, 10, "目  录", align="C")
        self.ln(12)

        current_section = ""
        section_num = 0

        for filepath, lines in files_with_lines:
            # Determine section
            if filepath in ("next.config.ts", "tsconfig.json", "package.json"):
                section = "项目配置"
            elif filepath.startswith("src/app/api/"):
                section = "API 路由"
            elif filepath.startswith("src/components/ui/"):
                section = "UI 组件库 (shadcn/ui)"
            elif filepath.startswith("src/components/"):
                section = "业务组件"
            elif filepath.startswith("src/lib/"):
                section = "工具库"
            elif filepath.startswith("src/storage/"):
                section = "数据库/存储"
            elif filepath.startswith("src/hooks/"):
                section = "Hooks"
            elif filepath.startswith("src/app/") and filepath.endswith((".ts", ".tsx", ".css")):
                section = "应用入口/页面"
            else:
                section = "其他"

            if section != current_section:
                current_section = section
                section_num += 1
                self.ln(3)
                self.set_font("cjk", "", 11)
                self.set_text_color(51, 51, 51)
                self.cell(0, 6, f"{section_num}. {section}")
                self.ln(6)
                self.set_font("mono", "", 8)
                self.set_text_color(80, 80, 80)

            self.set_x(18)
            self.cell(0, 5, f"{filepath}  ({lines} lines)")
            self.ln(5)

    def add_source_file(self, filepath, content):
        self.current_file = filepath
        self.add_page()

        # File path header
        self.set_font("mono", "B", 10)
        self.set_text_color(51, 51, 51)
        self.set_fill_color(235, 235, 235)
        self.cell(0, 8, f"  {filepath}", fill=True)
        self.ln(10)

        # Source code
        lines = content.split("\n")

        for i, line in enumerate(lines, 1):
            # Check if we need a new page
            if self.get_y() > 275:
                self.add_page()
                self.set_font("sans", "I", 7)
                self.set_text_color(140, 140, 140)
                self.cell(0, 5, f"(continued) {filepath}")
                self.ln(7)

            # Line number
            self.set_font("mono", "", 7)
            self.set_text_color(170, 170, 170)
            ln_str = f"{i:>4}  "
            self.set_x(8)
            self.cell(11, self.line_height, ln_str)

            # Code content - use CJK font to handle Chinese characters
            display_line = line[:110] if len(line) > 110 else line
            display_line = display_line.replace("\t", "    ")

            # Determine color based on line content
            stripped = display_line.strip()
            if stripped.startswith("//") or stripped.startswith("#") or stripped.startswith("*"):
                self.set_text_color(130, 130, 130)  # Comments - gray
            elif stripped.startswith("import ") or stripped.startswith("export "):
                self.set_text_color(0, 90, 160)  # Imports - blue
            elif any(stripped.startswith(kw) for kw in ("const ", "let ", "var ", "type ", "interface ")):
                self.set_text_color(30, 100, 30)  # Declarations - dark green
            elif any(stripped.startswith(kw) for kw in ("async ", "function ", "return ")):
                self.set_text_color(140, 60, 0)  # Functions - brown
            else:
                self.set_text_color(40, 40, 40)

            # Use CJK font for code (supports both Chinese and Latin)
            self.set_font("cjk", "", 7)
            self.cell(0, self.line_height, display_line)
            self.ln(self.line_height)


def main():
    pdf = SourceCodePDF()

    # First pass: collect file info for TOC
    files_with_lines = []
    total_lines = 0

    for filepath in SOURCE_FILES:
        full_path = os.path.join(PROJECT_ROOT, filepath)
        if os.path.exists(full_path):
            with open(full_path, "r", encoding="utf-8", errors="replace") as f:
                content = f.read()
            line_count = len(content.split("\n"))
            files_with_lines.append((filepath, line_count))
            total_lines += line_count
        else:
            print(f"  SKIP (not found): {filepath}")

    # Cover page
    pdf.add_cover_page(len(files_with_lines), total_lines)

    # Table of contents
    pdf.add_toc(files_with_lines)

    # Source files
    for idx, (filepath, _) in enumerate(files_with_lines):
        full_path = os.path.join(PROJECT_ROOT, filepath)
        with open(full_path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
        pdf.add_source_file(filepath, content)
        print(f"  [{idx+1}/{len(files_with_lines)}] {filepath}")

    # Save
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    pdf.output(OUTPUT_PATH)
    print(f"\nPDF saved: {OUTPUT_PATH}")
    print(f"Size: {os.path.getsize(OUTPUT_PATH) / 1024:.1f} KB")
    print(f"Pages: {pdf.page_no()}")


if __name__ == "__main__":
    main()
