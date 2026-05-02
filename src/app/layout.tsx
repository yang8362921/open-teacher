import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: '开放智慧助教 | Open Teacher',
    template: '%s | 开放智慧助教',
  },
  description:
    '开放智慧助教（Open Teacher）—— 基于AI的智能教学助手，支持语音问答、知识库管理和个性化教学辅导。',
  keywords: [
    '开放智慧助教',
    'Open Teacher',
    'AI数字教师',
    '智能教学',
    '语音问答',
    '知识库',
  ],
  authors: [{ name: 'Open Teacher' }],
  generator: 'Coze Code',
  icons: {
    icon: '/favicon.png',
  },
  openGraph: {
    title: '开放智慧助教 | Open Teacher',
    description:
      '开放智慧助教 —— AI智能教学助手，让每个学生都有专属辅导老师。',
    locale: 'zh_CN',
    type: 'website',
  },
  // twitter: {
  //   card: 'summary_large_image',
  //   title: 'Coze Code | Your AI Engineer is Here',
  //   description:
  //     'Build and deploy full-stack applications through AI conversation. No env setup, just flow.',
  //   // images: [''],
  // },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.COZE_PROJECT_ENV === 'DEV';

  return (
    <html lang="en">
      <body className={`antialiased`}>
        {isDev && <Inspector />}
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
