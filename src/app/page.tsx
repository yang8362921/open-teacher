'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mic, Phone, PhoneOff, Volume2, VolumeX,
  BookOpen, User, Bot, Loader2, Send,
  AlertCircle, StopCircle, Lightbulb,
  GraduationCap, X, Image as ImageIcon,
  RotateCcw, History, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import KnowledgeManager from '@/components/KnowledgeManager';
import DigitalHuman from '@/components/DigitalHuman';
import VoiceSettingsComponent, { type VoiceSettings as VoiceSettingsType } from '@/components/VoiceSettings';
import LoginOverlay, { type LoginInfo } from '@/components/LoginOverlay';
import StudentMemoryPanel from '@/components/StudentMemoryPanel';
import TeacherDashboard from '@/components/TeacherDashboard';
import AdminDashboard from '@/components/AdminDashboard';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isPlaying?: boolean;
  imageUrl?: string;
  isGeneratingImage?: boolean;
  suggestImage?: boolean;
  imageDesc?: string;
}

/** 教师档案接口 */
interface TeacherProfile {
  id?: string;
  name: string;
  title: string;
  subjects: string;
  expertise: string;
  guidingQuestions: string;
  teachingStyle: string;
  knowledgeTable?: string;
}

const DEFAULT_TEACHER_PROFILE: TeacherProfile = {
  name: '杨老师',
  title: '合肥开放大学教师',
  subjects: '人工智能技术知识',
  expertise: '人工智能技术、机器学习、深度学习、自然语言处理、计算机视觉',
  guidingQuestions: '你想了解人工智能的哪些方面？在工作中遇到过哪些与AI相关的问题？你希望AI能帮你解决什么问题？',
  teachingStyle: '用通俗的语言和生动的实例来解释人工智能中的各种概念，让抽象的技术变得易懂实用',
};

/** 简单的 ask → answer 循环状态 */
type CallState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

const DEFAULT_VOICE_SETTINGS: VoiceSettingsType = {
  speaker: 'zh_male_m191_uranus_bigtts',
  speechRate: 5,
  loudnessRate: 0,
  pitchRate: 0,
  useDigitalHuman: true,
  customImage: '',
  silenceTimeout: 1.0,
  noiseSensitivity: 3,
  micGain: 1.0,
};

/** TTS 前预处理：去除 Markdown 格式，口语化 */
function preprocessTextForTTS(text: string): string {
  let s = text;
  s = s.replace(/^#{1,6}\s+/gm, '');
  s = s.replace(/\*{3}(.+?)\*{3}/g, '$1');
  s = s.replace(/\*{2}(.+?)\*{2}/g, '$1');
  s = s.replace(/\*(.+?)\*/g, '$1');
  s = s.replace(/`{1,3}[^`]+`{1,3}/g, (m) => m.replace(/`/g, ''));
  s = s.replace(/```[\s\S]*?```/g, '');
  s = s.replace(/^\s*(\d+)\.\s+/gm, '');
  s = s.replace(/^\s*[-*]\s+/gm, '');
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  s = s.replace(/!\[[^\]]*\]\([^)]+\)/g, '');
  s = s.replace(/^[-=]{3,}\s*$/gm, '');
  s = s.replace(/<[^>]+>/g, '');
  s = s.replace(/[•·►▸▶←→↑↓]/g, '');
  s = s.replace(/\n{2,}/g, '\n');
  s = s.replace(/  +/g, ' ');
  return s.trim();
}

/** 将 PCM Float32 缓冲数组转换为 WAV Blob（单声道 16bit） */
function createWavFromPcm(pcmBuffers: Float32Array[], sampleRate: number): Blob {
  const numChannels = 1;
  const bitsPerSample = 16;
  const totalSamples = pcmBuffers.reduce((sum, buf) => sum + buf.length, 0);
  const dataSize = totalSamples * numChannels * (bitsPerSample / 8);

  const wavBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(wavBuffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  // RIFF header
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);            // Subchunk1Size
  view.setUint16(20, 1, true);             // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true); // ByteRate
  view.setUint16(32, numChannels * (bitsPerSample / 8), true);              // BlockAlign
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  // PCM samples
  let offset = 44;
  for (const buf of pcmBuffers) {
    for (let i = 0; i < buf.length; i++) {
      const s = Math.max(-1, Math.min(1, buf[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      offset += 2;
    }
  }

  return new Blob([wavBuffer], { type: 'audio/wav' });
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [callState, setCallStateInternal] = useState<CallState>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [useKnowledge, setUseKnowledge] = useState(true);
  const [activeTab, setActiveTab] = useState('call');
  const [callDuration, setCallDuration] = useState(0);
  const [textInput, setTextInput] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [playbackAudioLevel, setPlaybackAudioLevel] = useState(0);
  const [isVoiceDetected, setIsVoiceDetected] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettingsType>(DEFAULT_VOICE_SETTINGS);
  const [vadDebug, setVadDebug] = useState({ energy: 0, threshold: 0, noise: 0 });
  const [teacherProfile, setTeacherProfile] = useState<TeacherProfile>(DEFAULT_TEACHER_PROFILE);

  // ====== 登录与角色管理 ======
  const [loginInfo, setLoginInfo] = useState<LoginInfo | null>(null);
  const [showTeacherDashboard, setShowTeacherDashboard] = useState(false);
  const [isLoginReady, setIsLoginReady] = useState(false);
  const userRole = loginInfo?.role ?? null;

  // ====== 记忆系统：学生身份 ======
  const [studentId, setStudentId] = useState<string>('');
  const studentIdRef = useRef<string>('');
  const sessionIdRef = useRef<string>('');

  // ====== 当次对话学习分析 ======
  interface LearningInsight {
    weakPoints: string[];      // 薄弱环节
    suggestions: string[];     // 学习建议
    lastUpdate: number;        // 最后更新时间戳
  }
  const [learningInsight, setLearningInsight] = useState<LearningInsight>({
    weakPoints: [],
    suggestions: [],
    lastUpdate: 0,
  });

  // ====== 历史会话 ======
  const [previousSessions, setPreviousSessions] = useState<Array<{ session_id: string; first_message: string; created_at: string; message_count: number }>>([]);
  const [viewingHistory, setViewingHistory] = useState(false); // 是否正在查看历史对话
  const messagesSavedRef = useRef(false);
  const savedMsgIdsRef = useRef<Set<string>>(new Set()); // 已保存到数据库的消息ID集合，避免重复保存

  // 实时保存新消息到数据库（增量保存，只保存尚未保存的消息）
  const saveNewMessages = useCallback(() => {
    if (!sessionIdRef.current || !studentIdRef.current) return;
    const teacherId = loginInfoRef.current?.teacherId || 'teacher_default';
    const currentMessages = messagesRef.current;
    const unsaved = currentMessages
      .filter(m => (m.role === 'user' || m.role === 'assistant') && m.content && !savedMsgIdsRef.current.has(m.id));

    if (unsaved.length === 0) return;

    // 标记为已保存（乐观更新，避免重复发送）
    for (const m of unsaved) {
      savedMsgIdsRef.current.add(m.id);
    }

    const rows = unsaved.map(m => ({
      id: m.id,
      session_id: sessionIdRef.current,
      student_id: studentIdRef.current,
      teacher_id: teacherId,
      role: m.role,
      content: m.content || '',
      message_type: m.imageUrl ? 'image' : 'text',
      image_url: m.imageUrl || null,
    }));

    fetch('/api/chat/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_batch', messages: rows, session_id: sessionIdRef.current, student_id: studentIdRef.current, teacher_id: teacherId }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.success && d.sessions) {
          setPreviousSessions(d.sessions);
        }
      })
      .catch(err => {
        // 保存失败时回滚标记，下次可重试
        for (const m of unsaved) {
          savedMsgIdsRef.current.delete(m.id);
        }
        console.warn('[CHAT] 增量保存消息失败:', err);
      });
  }, []);

  // 更新学习分析面板
  const updateLearningInsight = useCallback((mem: {
    knowledge_mastery?: {
      weak?: Array<{ topic: string; subtopic?: string; weak_points?: string }>;
      learning?: Array<{ topic: string; subtopic?: string; weak_points?: string }>;
    };
    recent_conversations?: Array<{ confusion?: string; next_steps?: string; breakthrough?: string }>;
    key_moments?: Array<{ type: string; content?: string }>;
    teaching_strategy?: {
      effective_methods?: Array<{ method: string; context?: string }>;
    };
  }) => {
    const weakPoints: string[] = [];
    const suggestions: string[] = [];

    // 从薄弱知识点提取
    if (mem?.knowledge_mastery?.weak) {
      for (const w of mem.knowledge_mastery.weak) {
        const label = w.subtopic ? `${w.topic} - ${w.subtopic}` : w.topic;
        weakPoints.push(`${label} 需要加强`);
        suggestions.push(`建议重点复习${label}`);
      }
    }
    // 从学习中的知识点提取问题
    if (mem?.knowledge_mastery?.learning) {
      for (const l of mem.knowledge_mastery.learning) {
        if (l.weak_points) {
          const label = l.subtopic ? `${l.topic} - ${l.subtopic}` : l.topic;
          weakPoints.push(`${label}: ${l.weak_points}`);
          suggestions.push(`继续巩固${label}：${l.weak_points}`);
        }
      }
    }

    // 从对话记录提取困惑和建议
    if (mem?.recent_conversations) {
      for (const conv of mem.recent_conversations) {
        if (conv.confusion) weakPoints.push(conv.confusion);
        if (conv.next_steps) suggestions.push(conv.next_steps);
        if (conv.breakthrough) suggestions.push(`继续保持: ${conv.breakthrough}`);
      }
    }

    // 从关键时刻提取
    if (mem?.key_moments) {
      for (const km of mem.key_moments) {
        if (km.type === 'confusion' && km.content) {
          weakPoints.push(km.content);
        } else if (km.type === 'breakthrough' && km.content) {
          suggestions.push(km.content);
        }
      }
    }

    // 从有效教学策略提取建议
    if (mem?.teaching_strategy?.effective_methods) {
      for (const em of mem.teaching_strategy.effective_methods) {
        suggestions.push(`${em.method}对你很有效${em.context ? '（' + em.context + '）' : ''}`);
      }
    }

    setLearningInsight({
      weakPoints: [...new Set(weakPoints)].slice(0, 5),
      suggestions: [...new Set(suggestions)].slice(0, 3),
      lastUpdate: Date.now(),
    });
  }, []);

  const generateStudentId = (name: string, _teacherId?: string) => {
    // 基于学生姓名生成稳定的 student_id（不包含 teacherId，确保同一学生跨教师 ID 一致）
    // 数据隔离由数据库查询时的 teacher_id 字段保证
    const raw = name.trim().toLowerCase();
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const char = raw.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return 'stu_' + Math.abs(hash).toString(36);
  };

  // 从数据库解析学生的 student_id（优先查找已有记录，兼容历史数据）
  const resolveStudentId = async (name: string, teacherId: string): Promise<string> => {
    try {
      const res = await fetch(`/api/memory/profile?action=resolve&name=${encodeURIComponent(name.trim())}&teacher_id=${encodeURIComponent(teacherId)}`);
      const data = await res.json();
      if (data.success && data.student_id) {
        return data.student_id; // 数据库已有记录，使用已有的 student_id
      }
    } catch { /* ignore */ }
    // 数据库无记录，生成新的 student_id
    return generateStudentId(name);
  };
  studentIdRef.current = studentId;
  // ====== Ref 同步（避免 useCallback 闭包陷阱）======
  studentIdRef.current = studentId;
  const loginInfoRef = useRef<LoginInfo | null>(null);
  loginInfoRef.current = loginInfo;

  // ====== Refs ======
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // TTS 播放队列（AudioBuffer = 已预解码，string = URI 降级）
  const playbackAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioQueueRef = useRef<(AudioBuffer | string)[]>([]);
  const isPlayingQueueRef = useRef(false);
  const currentSpeakIdRef = useRef<string>('');
  const playQueueRef = useRef<() => void>(() => {});
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 麦克风管道（通话期间持续运行）
  const persistentStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // PCM 直采（替代 MediaRecorder 切片方案，彻底避免 webm 缺容器头问题）
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const silentGainRef = useRef<GainNode | null>(null);
  const pcmPreBufferRef = useRef<Float32Array[]>([]); // 循环预缓冲（~500ms）
  const pcmCaptureRef = useRef<Float32Array[]>([]);   // 语音捕获缓冲
  const isPcmCapturingRef = useRef(false);
  const hasSpokenRef = useRef(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const msgIdRef = useRef(0);
  const vadRunningRef = useRef(false);

  // 函数 ref（VAD 回调用，避免闭包陷阱）
  const markSpeechStartRef = useRef<() => void>(() => {});
  const submitSpeechAudioRef = useRef<() => Promise<void>>(async () => {});
  const discardSpeechRef = useRef<() => void>(() => {});

  // VAD 噪声检测
  const noiseFloorRef = useRef(3);
  const smoothedEnergyRef = useRef(0);
  const calibrateStartRef = useRef(0);
  const calibrateSamplesRef = useRef<number[]>([]);
  const speechStartRef = useRef(0);
  const isConfirmedSpeechRef = useRef(false);
  const consecutiveSilenceRef = useRef(0);
  const energyBufferRef = useRef<number[]>([]);
  const confirmedSpeechFramesRef = useRef(0);

  // LLM 流结束标记
  const llmStreamDoneRef = useRef(false);
  // 飞行中 TTS 请求计数
  const pendingTTSCountRef = useRef(0);

  // 有序 TTS 队列
  const ttsSeqRef = useRef(0);            // 下一个要分配的序号
  const ttsNextPlayRef = useRef(0);       // 下一个该入队的序号
  const ttsResultMapRef = useRef<Map<number, AudioBuffer | string>>(new Map()); // seq → AudioBuffer | URI
  const ttsSessionIdRef = useRef(0);      // TTS 会话 ID，barge-in 后递增使过期响应失效

  // 播放音频分析（口型同步）— 文字对话模式使用
  const playbackAnalyserRef = useRef<AnalyserNode | null>(null);
  const playbackSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const playbackRafRef = useRef<number | null>(null);

  // TTS 参考信号路径（仅用于口型同步 — 不再做回声消除）
  // TTS 音频 → refGain → refAnalyser → destination
  const refGainRef = useRef<GainNode | null>(null);
  const refAnalyserRef = useRef<AnalyserNode | null>(null);
  const playbackBufferSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const ttsFetchAbortRef = useRef<AbortController | null>(null);

  // 状态同步 ref
  const voiceSettingsRef = useRef(voiceSettings);
  const isCallActiveRef = useRef(isCallActive);
  const isMutedRef = useRef(isMuted);
  const messagesRef = useRef(messages);
  const useKnowledgeRef = useRef(useKnowledge);
  const callStateRef = useRef<CallState>(callState);
  const teacherProfileRef = useRef(teacherProfile);

  // ====== 状态管理 ======

  const updateCallState = useCallback((newState: CallState) => {
    const prev = callStateRef.current;
    if (prev !== newState) {
      console.log('[STATE]', prev, '→', newState);
    }
    setCallStateInternal(newState);
    callStateRef.current = newState;
  }, []);

  // 同步 state → ref
  useEffect(() => {
    voiceSettingsRef.current = voiceSettings;
    isCallActiveRef.current = isCallActive;
    isMutedRef.current = isMuted;
    messagesRef.current = messages;
    useKnowledgeRef.current = useKnowledge;
    callStateRef.current = callState;
    teacherProfileRef.current = teacherProfile;
    // 仅在非 speaking 状态下更新增益（speaking 状态增益被静音）
    if (gainNodeRef.current && callStateRef.current !== 'speaking') {
      gainNodeRef.current.gain.value = voiceSettings.micGain ?? 1.0;
    }
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem('voiceSettings');
      if (saved) {
        const parsed = JSON.parse(saved);
        // 保留声音的默认设置，但头像由教师档案动态决定
        parsed.speaker = DEFAULT_VOICE_SETTINGS.speaker;
        parsed.speechRate = DEFAULT_VOICE_SETTINGS.speechRate;
        localStorage.setItem('voiceSettings', JSON.stringify(parsed));
        setVoiceSettings(prev => ({ ...prev, ...parsed }));
      } else {
        localStorage.setItem('voiceSettings', JSON.stringify(DEFAULT_VOICE_SETTINGS));
        setVoiceSettings(DEFAULT_VOICE_SETTINGS);
      }
    } catch { /* ignore */ }
    try {
      // 教师档案从服务端加载，不再强制使用默认值
      const savedTP = localStorage.getItem('teacherProfile');
      if (savedTP) {
        setTeacherProfile(JSON.parse(savedTP));
      }
    } catch { /* ignore */ }
    try {
      // 恢复登录状态
      const savedLogin = localStorage.getItem('loginInfo');
      if (savedLogin) {
        const parsed = JSON.parse(savedLogin) as LoginInfo;
        setLoginInfo(parsed);
        if (parsed.role === 'student') {
          // 从数据库解析 student_id（兼容历史数据）
          const resolveAndLoad = async () => {
            const sid = await resolveStudentId(parsed.name, parsed.teacherId || 'teacher_default');
            setStudentId(sid);
            studentIdRef.current = sid;
            setActiveTab('call');

            // 加载历史会话列表
            if (parsed.teacherId) {
              fetch('/api/chat/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'history', student_id: sid, teacher_id: parsed.teacherId }),
              })
                .then(r => r.json())
                .then(d => {
                  setPreviousSessions(d.sessions || []);
                })
                .catch(() => {});

              // 加载初始学习分析
              fetch('/api/memory/recall', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ student_id: sid, teacher_id: parsed.teacherId }),
              })
                .then(r => r.json())
                .then(d => {
                  if (d.success && d.memory) {
                    updateLearningInsight(d.memory);
                  }
                })
                .catch(() => {});
            }
          };
          resolveAndLoad();

          // 从服务端加载教师档案
          if (parsed.teacherId) {
            fetch(`/api/teacher?teacherId=${encodeURIComponent(parsed.teacherId)}`)
              .then(r => r.json())
              .then(d => {
                if (d.success && d.teacher) {
                  const t = d.teacher;
                  const newProfile: TeacherProfile = {
                    id: t.id,
                    name: t.name || '',
                    title: t.title || '',
                    subjects: t.subjects || '',
                    expertise: t.expertise || '',
                    guidingQuestions: t.guiding_questions || '',
                    teachingStyle: t.teaching_style || '',
                    knowledgeTable: t.knowledge_table,
                  };
                  setTeacherProfile(newProfile);
                  if (t.avatar_url) {
                    setVoiceSettings(prev => ({ ...prev, customImage: t.avatar_url }));
                  }
                  try { localStorage.setItem('teacherProfile', JSON.stringify(newProfile)); } catch { /* ignore */ }
                }
              })
              .catch(() => {});
          }
        } else if (parsed.role === 'teacher') {
          setShowTeacherDashboard(true);
          // 从服务端加载教师档案
          if (parsed.teacherId) {
            fetch(`/api/teacher?teacherId=${encodeURIComponent(parsed.teacherId)}`)
              .then(r => r.json())
              .then(d => {
                if (d.success && d.teacher) {
                  const t = d.teacher;
                  const newProfile: TeacherProfile = {
                    id: t.id,
                    name: t.name || '',
                    title: t.title || '',
                    subjects: t.subjects || '',
                    expertise: t.expertise || '',
                    guidingQuestions: t.guiding_questions || '',
                    teachingStyle: t.teaching_style || '',
                    knowledgeTable: t.knowledge_table,
                  };
                  setTeacherProfile(newProfile);
                  if (t.avatar_url) {
                    setVoiceSettings(prev => ({ ...prev, customImage: t.avatar_url }));
                  }
                  try { localStorage.setItem('teacherProfile', JSON.stringify(newProfile)); } catch { /* ignore */ }
                }
              })
              .catch(() => {});
          }
        }
      }
    } catch { /* ignore */ }
    setIsLoginReady(true);
  }, []);

  useEffect(() => {
    // 滚动到消息列表底部
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isCallActive) {
      callTimerRef.current = setInterval(() => setCallDuration(p => p + 1), 1000);
    } else {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
      setCallDuration(0);
    }
    return () => { if (callTimerRef.current) clearInterval(callTimerRef.current); };
  }, [isCallActive]);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const genId = () => { msgIdRef.current += 1; return msgIdRef.current.toString(); };

  // ====== 播放音频分析（口型同步 — 文字对话模式）======

  const startPlaybackAnalysis = useCallback((audio: HTMLAudioElement) => {
    try {
      const ctx = new (window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!)();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.3;
      const source = ctx.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(ctx.destination);
      playbackCtxRef.current = ctx;
      playbackAnalyserRef.current = analyser;
      playbackSourceRef.current = source;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const analyzePlayback = () => {
        if (!analyser) return;
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setPlaybackAudioLevel(Math.min(avg / 128, 1));
        playbackRafRef.current = requestAnimationFrame(analyzePlayback);
      };
      playbackRafRef.current = requestAnimationFrame(analyzePlayback);
    } catch (err) {
      console.warn('播放音频分析初始化失败:', err);
    }
  }, []);

  const stopPlaybackAnalysis = useCallback(() => {
    if (playbackRafRef.current) {
      cancelAnimationFrame(playbackRafRef.current);
      playbackRafRef.current = null;
    }
    setPlaybackAudioLevel(0);
    try {
      if (playbackBufferSourceRef.current) {
        try { playbackBufferSourceRef.current.stop(); } catch { /* already stopped */ }
        try { playbackBufferSourceRef.current.disconnect(); } catch { /* ignore */ }
        playbackBufferSourceRef.current = null;
      }
      if (ttsFetchAbortRef.current) {
        ttsFetchAbortRef.current.abort();
        ttsFetchAbortRef.current = null;
      }
      if (playbackSourceRef.current) { playbackSourceRef.current.disconnect(); playbackSourceRef.current = null; }
      if (playbackAnalyserRef.current) { playbackAnalyserRef.current.disconnect(); playbackAnalyserRef.current = null; }
      if (playbackCtxRef.current && playbackCtxRef.current.state !== 'closed') {
        playbackCtxRef.current.close();
        playbackCtxRef.current = null;
      }
    } catch { /* ignore */ }
  }, []);

  // ====== 噪声基线重置 ======

  const resetVADNoiseFloor = useCallback(() => {
    console.log('[VAD] 重置噪声基线', { old: Math.round(noiseFloorRef.current * 10) / 10 });
    noiseFloorRef.current = 3;
    energyBufferRef.current = [];
    calibrateStartRef.current = Date.now();
    calibrateSamplesRef.current = [];
  }, []);

  // ====== 统一的"播放完毕 → 回到 listening"逻辑 ======
  const tryFinishPlayback = useCallback(() => {
    if (!llmStreamDoneRef.current || pendingTTSCountRef.current > 0 || audioQueueRef.current.length > 0 || isPlayingQueueRef.current) {
      console.log('[PLAY] tryFinishPlayback 条件未满足', {
        llmDone: llmStreamDoneRef.current,
        pendingTTS: pendingTTSCountRef.current,
        queueLen: audioQueueRef.current.length,
        isPlaying: isPlayingQueueRef.current,
      });
      return;
    }
    console.log('[PLAY] 全部播放完毕，回到 listening');
    isPlayingQueueRef.current = false;

    // 语音通话模式：清理 AudioBufferSourceNode + 取消代理 fetch
    if (audioContextRef.current) {
      if (playbackBufferSourceRef.current) {
        try { playbackBufferSourceRef.current.stop(); } catch { /* already stopped */ }
        try { playbackBufferSourceRef.current.disconnect(); } catch { /* ignore */ }
        playbackBufferSourceRef.current = null;
      }
      if (ttsFetchAbortRef.current) {
        ttsFetchAbortRef.current.abort();
        ttsFetchAbortRef.current = null;
      }
    } else {
      stopPlaybackAnalysis();
    }
    setPlaybackAudioLevel(0);
    const sid = currentSpeakIdRef.current;
    if (sid) {
      setMessages(prev => prev.map(m => m.id === sid ? { ...m, isPlaying: false } : m));
      currentSpeakIdRef.current = '';
    }

    // 恢复麦克风增益（speaking 状态被静音了）
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = voiceSettingsRef.current.micGain ?? 1.0;
      console.log('[MIC] 恢复麦克风增益', { gain: gainNodeRef.current.gain.value });
    }

    // 重置 VAD 追踪状态（保留 PCM 预缓冲和平滑能量，加速下一轮检测）
    resetVADNoiseFloor();
    isPcmCapturingRef.current = false;
    pcmCaptureRef.current = [];
    hasSpokenRef.current = false;
    confirmedSpeechFramesRef.current = 0;
    isConfirmedSpeechRef.current = false;
    speechStartRef.current = 0;
    consecutiveSilenceRef.current = 0;
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    updateCallState('listening');
  }, [stopPlaybackAnalysis, updateCallState, resetVADNoiseFloor]);

  // ====== 停止 TTS ======

  const stopTTSPlayback = useCallback(() => {
    if (playbackAudioRef.current) {
      playbackAudioRef.current.onended = null;
      playbackAudioRef.current.onerror = null;
      playbackAudioRef.current.pause();
      playbackAudioRef.current.currentTime = 0;
      playbackAudioRef.current = null;
    }
    if (playbackBufferSourceRef.current) {
      try { playbackBufferSourceRef.current.stop(); } catch { /* already stopped */ }
      try { playbackBufferSourceRef.current.disconnect(); } catch { /* ignore */ }
      playbackBufferSourceRef.current = null;
    }
    if (ttsFetchAbortRef.current) {
      ttsFetchAbortRef.current.abort();
      ttsFetchAbortRef.current = null;
    }
    stopPlaybackAnalysis();
    setPlaybackAudioLevel(0);
    audioQueueRef.current = [];
    isPlayingQueueRef.current = false;
    pendingTTSCountRef.current = 0;
    // 清理有序队列
    ttsSeqRef.current = 0;
    ttsNextPlayRef.current = 0;
    ttsResultMapRef.current.clear();
    ttsSessionIdRef.current++;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    const sid = currentSpeakIdRef.current;
    if (sid) {
      setMessages(prev => prev.map(m => m.id === sid ? { ...m, isPlaying: false } : m));
      currentSpeakIdRef.current = '';
    }
  }, [stopPlaybackAnalysis]);

  // ====== speakSentence：合成一句话并按序入队（预解码 AudioBuffer）======

  const speakSentence = useCallback(async (text: string) => {
    const spokenText = preprocessTextForTTS(text);
    if (!spokenText) return;

    const seq = ttsSeqRef.current++;
    pendingTTSCountRef.current++;
    const sessionId = ttsSessionIdRef.current;

    try {
      const vs = voiceSettingsRef.current;
      const response = await fetch('/api/audio/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: spokenText,
          speaker: vs.speaker,
          speechRate: vs.speechRate,
          loudnessRate: vs.loudnessRate,
        }),
      });
      const data = await response.json();

      if (sessionId !== ttsSessionIdRef.current) {
        pendingTTSCountRef.current--;
        console.log('[TTS] 丢弃过期响应', { seq, sessionId });
        return;
      }

      if (data.success && data.audioUri) {
        // 预解码：在 speakSentence 中完成 proxy fetch + decode
        let queueItem: AudioBuffer | string = data.audioUri;
        const ctx = audioContextRef.current;
        const refGain = refGainRef.current;
        if (ctx && refGain) {
          try {
            const proxyUrl = `/api/audio/proxy?url=${encodeURIComponent(data.audioUri)}`;
            const audioResp = await fetch(proxyUrl);
            if (!audioResp.ok) throw new Error(`proxy returned ${audioResp.status}`);
            const arrayBuffer = await audioResp.arrayBuffer();
            const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
            if (sessionId !== ttsSessionIdRef.current) {
              pendingTTSCountRef.current--;
              return;
            }
            queueItem = audioBuffer;
            console.log('[TTS] 预解码完成', { seq, duration: audioBuffer.duration.toFixed(2) + 's' });
          } catch (decodeErr) {
            console.warn('[TTS] 预解码失败，使用URI降级', { seq, err: String(decodeErr).slice(0, 80) });
          }
        }

        pendingTTSCountRef.current--;

        ttsResultMapRef.current.set(seq, queueItem);
        console.log('[TTS] 就绪', { seq, type: queueItem instanceof AudioBuffer ? 'buffer' : 'uri', queueLen: audioQueueRef.current.length, pending: pendingTTSCountRef.current });

        while (ttsResultMapRef.current.has(ttsNextPlayRef.current)) {
          const item = ttsResultMapRef.current.get(ttsNextPlayRef.current)!;
          ttsResultMapRef.current.delete(ttsNextPlayRef.current);
          audioQueueRef.current.push(item);
          ttsNextPlayRef.current++;
          console.log('[TTS] 入队', { seq: ttsNextPlayRef.current - 1, queueLen: audioQueueRef.current.length });
        }

        if (!isPlayingQueueRef.current && audioQueueRef.current.length > 0) {
          playQueueRef.current();
        }
      } else {
        pendingTTSCountRef.current--;
        ttsResultMapRef.current.delete(seq);
        while (ttsResultMapRef.current.has(ttsNextPlayRef.current)) {
          const item = ttsResultMapRef.current.get(ttsNextPlayRef.current)!;
          ttsResultMapRef.current.delete(ttsNextPlayRef.current);
          audioQueueRef.current.push(item);
          ttsNextPlayRef.current++;
        }
        if (!isPlayingQueueRef.current && audioQueueRef.current.length > 0) {
          playQueueRef.current();
        }
        tryFinishPlayback();
      }
    } catch (err) {
      pendingTTSCountRef.current--;
      console.error('单句合成失败:', err);
      ttsResultMapRef.current.delete(seq);
      while (ttsResultMapRef.current.has(ttsNextPlayRef.current)) {
        const item = ttsResultMapRef.current.get(ttsNextPlayRef.current)!;
        ttsResultMapRef.current.delete(ttsNextPlayRef.current);
        audioQueueRef.current.push(item);
        ttsNextPlayRef.current++;
      }
      if (!isPlayingQueueRef.current && audioQueueRef.current.length > 0) {
        playQueueRef.current();
      }
      tryFinishPlayback();
    }
  }, [tryFinishPlayback]);

  // ====== playQueue：从队列中顺序播放（支持预解码 AudioBuffer）======

  const playQueue = useCallback(() => {
    if (audioQueueRef.current.length === 0) {
      isPlayingQueueRef.current = false;
      tryFinishPlayback();
      return;
    }

    isPlayingQueueRef.current = true;
    const item = audioQueueRef.current.shift()!;
    console.log('[PLAY] 播放', { type: item instanceof AudioBuffer ? 'buffer' : 'uri', remaining: audioQueueRef.current.length });

    // 清理上一个 TTS 源节点
    if (playbackBufferSourceRef.current) {
      try { playbackBufferSourceRef.current.stop(); } catch { /* already stopped */ }
      try { playbackBufferSourceRef.current.disconnect(); } catch { /* ignore */ }
      playbackBufferSourceRef.current = null;
    }
    if (playbackAudioRef.current) {
      playbackAudioRef.current.onended = null;
      playbackAudioRef.current.onerror = null;
      playbackAudioRef.current.pause();
      playbackAudioRef.current.currentTime = 0;
      playbackAudioRef.current = null;
    }

    const ctx = audioContextRef.current;
    const refGain = refGainRef.current;

    // ====== 预解码 AudioBuffer：直接播放，零延迟 ======
    if (item instanceof AudioBuffer && ctx && refGain) {
      const source = ctx.createBufferSource();
      source.buffer = item;
      source.connect(refGain);
      playbackBufferSourceRef.current = source;

      source.onended = () => {
        playbackBufferSourceRef.current = null;
        playQueueRef.current();
      };

      source.start(0);
      console.log('[PLAY] AudioBuffer 即时播放', {
        duration: item.duration.toFixed(2) + 's',
        sampleRate: item.sampleRate,
      });
      return;
    }

    // ====== URI 降级：需要代理 fetch + decode ======
    if (ctx && refGain) {
      if (ttsFetchAbortRef.current) {
        ttsFetchAbortRef.current.abort();
      }
      const fetchController = new AbortController();
      ttsFetchAbortRef.current = fetchController;
      const sessionId = ttsSessionIdRef.current;

      const uri = typeof item === 'string' ? item : '';
      if (!uri) {
        console.warn('[PLAY] 非法队列项，跳过');
        playQueueRef.current();
        return;
      }

      const proxyUrl = `/api/audio/proxy?url=${encodeURIComponent(uri)}`;
      
      fetch(proxyUrl, { signal: fetchController.signal })
        .then(res => {
          if (!res.ok) throw new Error(`proxy returned ${res.status}`);
          return res.arrayBuffer();
        })
        .then(buffer => ctx.decodeAudioData(buffer))
        .then(audioBuffer => {
          if (sessionId !== ttsSessionIdRef.current || !isPlayingQueueRef.current) {
            console.log('[PLAY] 会话已过期或已停止，丢弃解码结果');
            return;
          }
          ttsFetchAbortRef.current = null;

          const source = ctx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(refGain);
          playbackBufferSourceRef.current = source;

          source.onended = () => {
            playbackBufferSourceRef.current = null;
            playQueueRef.current();
          };

          source.start(0);
          console.log('[PLAY] 代理解码播放', {
            duration: audioBuffer.duration.toFixed(2) + 's',
            sampleRate: audioBuffer.sampleRate,
          });
        })
        .catch(err => {
          if (err instanceof DOMException && err.name === 'AbortError') {
            console.log('[PLAY] 代理 fetch 被 abort');
            return;
          }
          console.warn('[PLAY] 代理解码失败，降级为 Audio 元素播放', err);
          ttsFetchAbortRef.current = null;

          if (sessionId !== ttsSessionIdRef.current) return;
          const audio = new Audio(uri);
          audio.crossOrigin = 'anonymous';
          playbackAudioRef.current = audio;
          audio.onended = () => { playQueueRef.current(); };
          audio.onerror = () => { console.warn('音频播放出错，跳过'); playQueueRef.current(); };
          audio.play().then(() => { startPlaybackAnalysis(audio); }).catch(() => { playQueueRef.current(); });
        });
    } else {
      // 文字对话模式：无主 AudioContext，使用 Audio 元素
      stopPlaybackAnalysis();
      const uri = typeof item === 'string' ? item : '';
      if (!uri) {
        playQueueRef.current();
        return;
      }
      const audio = new Audio(uri);
      audio.crossOrigin = 'anonymous';
      playbackAudioRef.current = audio;
      audio.onended = () => { playQueueRef.current(); };
      audio.onerror = () => { console.warn('音频播放出错，跳过'); playQueueRef.current(); };
      audio.play().then(() => { startPlaybackAnalysis(audio); }).catch(() => { playQueueRef.current(); });
    }
  }, [startPlaybackAnalysis, stopPlaybackAnalysis, tryFinishPlayback]);

  useEffect(() => { playQueueRef.current = playQueue; }, [playQueue]);

  // ====== startSpeakStream ======

  const startSpeakStream = useCallback((messageId: string) => {
    console.log('[TTS] startSpeakStream', { messageId });
    llmStreamDoneRef.current = false;
    pendingTTSCountRef.current = 0;

    // 静音麦克风：TTS 播放期间麦克风增益设为 0，彻底杜绝回声误触
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = 0;
      console.log('[MIC] 静音麦克风（TTS播放期间）');
    }

    // 重置有序队列
    ttsSeqRef.current = 0;
    ttsNextPlayRef.current = 0;
    ttsResultMapRef.current.clear();
    if (playbackAudioRef.current) {
      playbackAudioRef.current.onended = null;
      playbackAudioRef.current.onerror = null;
      playbackAudioRef.current.pause();
      playbackAudioRef.current.currentTime = 0;
      playbackAudioRef.current = null;
    }
    if (playbackBufferSourceRef.current) {
      try { playbackBufferSourceRef.current.stop(); } catch { /* already stopped */ }
      try { playbackBufferSourceRef.current.disconnect(); } catch { /* ignore */ }
      playbackBufferSourceRef.current = null;
    }
    if (ttsFetchAbortRef.current) {
      ttsFetchAbortRef.current.abort();
      ttsFetchAbortRef.current = null;
    }
    stopPlaybackAnalysis();
    setPlaybackAudioLevel(0);
    audioQueueRef.current = [];
    isPlayingQueueRef.current = false;
    currentSpeakIdRef.current = messageId;
    updateCallState('speaking');
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isPlaying: true } : m));
  }, [stopPlaybackAnalysis, updateCallState]);

  const finishSpeakStream = useCallback(() => {
    console.log('[TTS] finishSpeakStream (LLM 输出结束)');
    llmStreamDoneRef.current = true;
    tryFinishPlayback();
  }, [tryFinishPlayback]);

  // ====== speakText：文字对话模式的整段合成 ======

  const speakText = useCallback(async (text: string, messageId: string) => {
    const spokenText = preprocessTextForTTS(text);
    if (!spokenText) return;
    updateCallState('speaking');
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isPlaying: true } : m));
    try {
      const vs = voiceSettingsRef.current;
      const response = await fetch('/api/audio/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: spokenText,
          speaker: vs.speaker,
          speechRate: vs.speechRate,
          loudnessRate: vs.loudnessRate,
        }),
      });
      const data = await response.json();
      if (data.success && data.audioUri) {
        stopPlaybackAnalysis();
        const audio = new Audio(data.audioUri);
        audio.crossOrigin = 'anonymous';
        playbackAudioRef.current = audio;
        audio.onended = () => {
          stopPlaybackAnalysis();
          resetVADNoiseFloor();
          updateCallState('listening');
          setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isPlaying: false } : m));
        };
        await audio.play();
        startPlaybackAnalysis(audio);
      } else {
        resetVADNoiseFloor();
        updateCallState('listening');
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isPlaying: false } : m));
      }
    } catch (err) {
      console.error('语音合成失败:', err);
      stopPlaybackAnalysis();
      resetVADNoiseFloor();
      updateCallState('listening');
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isPlaying: false } : m));
    }
  }, [startPlaybackAnalysis, stopPlaybackAnalysis, updateCallState, resetVADNoiseFloor]);

  // ====== sendMessage：流式分段 TTS ======

  const sendMessage = useCallback(async (text: string, isIntro = false, greetingType?: 'intro' | 'recall') => {
    console.log('[CHAT] sendMessage', { text: text.slice(0, 50), isIntro, greetingType });
    if (!text.trim() && !isIntro) { updateCallState('listening'); return; }

    // 确保 sessionId 已初始化（文字对话不走 startCall，需要在此兜底）
    if (!sessionIdRef.current) {
      sessionIdRef.current = 'sess_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    }

    // 开场白：不显示用户提示消息，只显示AI的回复
    const userMsg: Message = { id: genId(), role: 'user', content: text.trim() };
    if (!isIntro) {
      setMessages(prev => [...prev, userMsg]);
    }
    setTextInput('');
    updateCallState('processing');

    const assistantMsg: Message = { id: genId(), role: 'assistant', content: '' };
    setMessages(prev => [...prev, assistantMsg]);
    const aid = assistantMsg.id;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // 检测用户是否表达真正的困惑/不理解（不含一般性提问）
    const confusionKeywords = ['不懂', '不理解', '不明白', '听不懂', '搞不懂', '太抽象', '没懂', '没听懂', '想不通', '搞不清', '不会做', '做不出', '理解不了', '弄不懂', '一头雾水', '完全不懂', '搞不明白'];
    const isConfused = !isIntro && confusionKeywords.some(kw => text.includes(kw));

    // 检测用户是否确认生成图示
    // 先检查否定词，避免误判
    const rejectKeywords = ['不用', '不需要', '不要', '不行', '不好', '不用了', '不需要了', '算了', '没必要'];
    const isRejectingImage = rejectKeywords.some(kw => text.includes(kw));
    
    const confirmKeywords = ['好', '需要', '生成', '可以', '行', '来一张', '看看', '嗯', '是的', '对', '生成吧', '来吧'];
    const isConfirmingImage = !isIntro && !isRejectingImage && confirmKeywords.some(kw => text.includes(kw));
    if (isConfirmingImage) {
      const lastSuggestMsg = messagesRef.current.filter(m => m.role === 'assistant' && m.suggestImage && !m.imageUrl && !m.isGeneratingImage).pop();
      if (lastSuggestMsg) {
        // 自动触发生图
        handleConfirmImage(lastSuggestMsg.id);
      }
    }

    try {
      const currentMessages = messagesRef.current;
      // 开场白消息仍然发送给API用于上下文，但不展示给用户
      const messagesForApi = isIntro
        ? [...currentMessages, userMsg]
        : [...currentMessages, userMsg];
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messagesForApi.map(m => ({ role: m.role, content: m.content })),
          useKnowledge: useKnowledgeRef.current,
          teacherProfile: teacherProfileRef.current,
          isIntro,
          greetingType: isIntro ? (greetingType || 'intro') : undefined,
          needVisualization: isConfused,
          student_id: studentIdRef.current || undefined,
          session_id: sessionIdRef.current || undefined,
          student_info: loginInfoRef.current?.role === 'student' ? {
            name: loginInfoRef.current.name,
            grade: loginInfoRef.current.grade,
            student_type: loginInfoRef.current.studentType,
            learning_style: loginInfoRef.current.learningStyle,
          } : undefined,
          teacher_id: loginInfoRef.current?.teacherId || undefined,
        }),
        signal: controller.signal,
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) { updateCallState('listening'); return; }

      let accumulated = '';
      let pendingText = '';
      let ttsStarted = false;
      let lastFlushTime = Date.now();
      const shouldSpeak = !isMutedRef.current && isCallActiveRef.current;

      const splitRe = /[。！？；，,、：:\n.!?;:]+/;

      const tryFlushPending = () => {
        if (!shouldSpeak || !pendingText.trim()) return;
        const cleanPending = pendingText;
        const match = cleanPending.match(splitRe);
        if (match) {
          const endIdx = cleanPending.indexOf(match[0]) + match[0].length;
          const sentence = cleanPending.slice(0, endIdx).trim();
          const remaining = pendingText.slice(endIdx);

          // 短句合并：如果句子太短（< 8字）且还有后续内容，暂不发送，等待累积
          if (sentence.length < 8 && remaining.length > 0) {
            return;
          }

          pendingText = remaining;
          if (sentence) {
            if (!ttsStarted) {
              ttsStarted = true;
              startSpeakStream(aid);
            }
            speakSentence(sentence);
            lastFlushTime = Date.now();
          }
        } else {
          const now = Date.now();
          // 超时强制发送：累积超过 15 字或等待超过 1 秒
          if (cleanPending.length > 15 || (cleanPending.length > 0 && now - lastFlushTime > 1000)) {
            const sentence = cleanPending.trim();
            pendingText = '';
            if (sentence) {
              if (!ttsStarted) {
                ttsStarted = true;
                startSpeakStream(aid);
              }
              speakSentence(sentence);
              lastFlushTime = now;
            }
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split('\n\n')) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6);
          if (payload === '[DONE]') continue;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.content) {
              accumulated += parsed.content;
              setMessages(prev => prev.map(m => m.id === aid ? { ...m, content: accumulated } : m));

              if (shouldSpeak) {
                pendingText += parsed.content;
                tryFlushPending();
              }
            }
          } catch { /* ignore */ }
        }
        tryFlushPending();
      }

      console.log('[CHAT] LLM输出结束', { ttsStarted, hasRemaining: !!pendingText.trim(), shouldSpeak });

      // 检测 LLM 是否建议生成辅助图示
      if (accumulated.includes('我可以生成一张辅助图示') || accumulated.includes('需要我生成') || accumulated.includes('需要吗？')) {
        setMessages(prev => prev.map(m => m.id === aid ? { ...m, suggestImage: true, imageDesc: accumulated.replace(/我可以生成一张辅助图示[^。]*。?/, '').trim() } : m));
      }

      if (shouldSpeak) {
        const remaining = pendingText.trim();
        if (remaining || ttsStarted) {
          if (!ttsStarted) { startSpeakStream(aid); }
          if (remaining) { speakSentence(remaining); }
          finishSpeakStream();
        } else {
          updateCallState('listening');
        }
      } else {
        updateCallState('listening');
      }

      // 实时保存本次对话的消息到数据库
      if (userRole === 'student') {
        saveNewMessages();
      }

      // 对话结束后刷新学习分析（延迟等待 memory/update 完成）
      if (userRole === 'student' && studentIdRef.current) {
        const refreshInsight = async () => {
          try {
            const resp = await fetch('/api/memory/recall', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                student_id: studentIdRef.current, 
                teacher_id: loginInfoRef.current?.teacherId || 'teacher_default' 
              }),
            });
            if (resp.ok) {
              const data = await resp.json();
              if (data.success && data.memory) {
                updateLearningInsight(data.memory);
                return true;
              }
            }
          } catch (e) {
            console.warn('[CHAT] 刷新学习分析失败:', e);
          }
          return false;
        };
        // 先延迟4秒让 memory/update 完成
        setTimeout(() => {
          refreshInsight().then((ok) => {
            // 如果第一次没拿到数据，8秒后重试
            if (!ok) {
              setTimeout(refreshInsight, 4000);
            }
          });
        }, 4000);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        console.log('[CHAT] fetch被abort');
        return;
      }
      console.error('发送消息失败:', err);
      updateCallState('listening');
    }
  }, [speakSentence, startSpeakStream, finishSpeakStream, updateCallState, updateLearningInsight, userRole, saveNewMessages]);

  // ====== processAudio：ASR → sendMessage ======

  const processAudio = useCallback(async (audioBlob: Blob) => {
    console.log('[ASR] processAudio', { blobSize: audioBlob.size, type: audioBlob.type, callState: callStateRef.current });
    try {
      const base64 = await blobToBase64(audioBlob);
      const base64Data = base64.split(',')[1];
      const response = await fetch('/api/audio/asr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Data }),
      });
      const data = await response.json();
      console.log('[ASR] 结果', { success: data.success, text: data.text?.slice(0, 50), error: data.error });
      if (data.success && data.text) {
        await sendMessage(data.text);
      } else {
        console.warn('[ASR] 识别无结果', data);
        updateCallState('listening');
      }
    } catch (err) {
      console.error('语音识别失败:', err);
      updateCallState('listening');
    }
  }, [sendMessage, updateCallState]);

  // ====== PCM 直采：语音起点标记 ======

  const markSpeechStart = useCallback(() => {
    if (isPcmCapturingRef.current) return;
    isPcmCapturingRef.current = true;
    pcmCaptureRef.current = [...pcmPreBufferRef.current];
    hasSpokenRef.current = true;
    console.log('[PCM] 语音起点', { preBufferLen: pcmPreBufferRef.current.length });
  }, []);

  // ====== PCM 直采：语音结束 → WAV → ASR ======

  const submitSpeechAudio = useCallback(async () => {
    console.log('[PCM] submitSpeechAudio', {
      capturing: isPcmCapturingRef.current,
      captureLen: pcmCaptureRef.current.length,
      callState: callStateRef.current,
    });

    isPcmCapturingRef.current = false;

    if (pcmCaptureRef.current.length < 8 || !hasSpokenRef.current) {
      pcmCaptureRef.current = [];
      hasSpokenRef.current = false;
      confirmedSpeechFramesRef.current = 0;
      isConfirmedSpeechRef.current = false;
      speechStartRef.current = 0;
      consecutiveSilenceRef.current = 0;
      updateCallState('listening');
      return;
    }

    const captured = pcmCaptureRef.current;
    pcmCaptureRef.current = [];

    hasSpokenRef.current = false;
    confirmedSpeechFramesRef.current = 0;
    isConfirmedSpeechRef.current = false;
    speechStartRef.current = 0;
    consecutiveSilenceRef.current = 0;
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }

    const sampleRate = audioContextRef.current?.sampleRate || 48000;
    const wavBlob = createWavFromPcm(captured, sampleRate);
    console.log('[PCM] WAV 生成', { sampleRate, buffers: captured.length, wavSize: wavBlob.size });

    updateCallState('processing');
    await processAudio(wavBlob);
  }, [processAudio, updateCallState]);

  // 噪声误触时丢弃当前语音追踪
  const discardSpeech = useCallback(() => {
    console.log('[PCM] discardSpeech');
    isPcmCapturingRef.current = false;
    pcmCaptureRef.current = [];
    hasSpokenRef.current = false;
    confirmedSpeechFramesRef.current = 0;
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
  }, []);

  // ====== 手动停止说话（用户点击打断按钮）======

  const handleStopSpeaking = useCallback(() => {
    stopTTSPlayback();
    // 恢复麦克风增益
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = voiceSettingsRef.current.micGain ?? 1.0;
      console.log('[MIC] 恢复麦克风增益（手动打断）');
    }
    resetVADNoiseFloor();
    isPcmCapturingRef.current = false;
    pcmCaptureRef.current = [];
    hasSpokenRef.current = false;
    confirmedSpeechFramesRef.current = 0;
    isConfirmedSpeechRef.current = false;
    speechStartRef.current = 0;
    consecutiveSilenceRef.current = 0;
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    llmStreamDoneRef.current = false;
    pendingTTSCountRef.current = 0;
    updateCallState('listening');
  }, [stopTTSPlayback, updateCallState, resetVADNoiseFloor]);

  /** 确认生成辅助图示（异步任务队列：提交 → 轮询 → 完成） */
  const handleConfirmImage = useCallback(async (msgId: string) => {
    // 标记为生成中
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isGeneratingImage: true, suggestImage: false } : m));

    try {
      const recentMsgs = messagesRef.current.slice(-6).map(m => ({
        role: m.role,
        content: m.content.slice(0, 300),
      }));

      // 提交异步任务，立即获得 task_id
      const submitResp = await fetch('/api/image/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: recentMsgs, async: true }),
      });
      const submitData = await submitResp.json();

      if (!submitData.success || !submitData.task_id) {
        // 降级：同步模式（老接口兼容）
        console.warn('[CHAT] 异步任务提交失败，降级同步模式');
        const designResp = await fetch('/api/image/design', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: recentMsgs }),
        });
        const designData = await designResp.json();
        if (!designData.success || !designData.imagePrompt) {
          setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isGeneratingImage: false } : m));
          return;
        }
        const imgResp = await fetch('/api/image/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: designData.imagePrompt }),
        });
        const imgData = await imgResp.json();
        if (imgData.success && imgData.imageUrls?.[0]) {
          setMessages(prev => prev.map(m => m.id === msgId ? { ...m, imageUrl: imgData.imageUrls[0], isGeneratingImage: false } : m));
        } else {
          setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isGeneratingImage: false } : m));
        }
        return;
      }

      // 轮询任务状态
      const taskId = submitData.task_id;
      const pollInterval = 1500; // 1.5秒轮询一次
      const maxPolls = 40; // 最多轮询40次（60秒）
      let pollCount = 0;

      const poll = async (): Promise<void> => {
        if (pollCount >= maxPolls) {
          setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isGeneratingImage: false } : m));
          console.warn('[CHAT] 图片生成超时');
          return;
        }
        pollCount++;

        try {
          const statusResp = await fetch(`/api/image/status?task_id=${taskId}`);
          const statusData = await statusResp.json();

          if (statusData.status === 'completed' && statusData.result?.imageUrl) {
            setMessages(prev => prev.map(m => m.id === msgId ? { ...m, imageUrl: statusData.result.imageUrl, isGeneratingImage: false } : m));
            console.log('[CHAT] 辅助图示异步生成成功');
            return;
          } else if (statusData.status === 'failed') {
            setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isGeneratingImage: false } : m));
            console.warn('[CHAT] 辅助图示生成失败:', statusData.error);
            return;
          }
          // 继续轮询
          setTimeout(poll, pollInterval);
        } catch {
          setTimeout(poll, pollInterval);
        }
      };

      // 开始轮询
      setTimeout(poll, pollInterval);
    } catch (imgErr) {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isGeneratingImage: false } : m));
      console.warn('[CHAT] 辅助图示生成异常:', imgErr);
    }
  }, []);

  // ====== 麦克风 + VAD ======

  const setupPersistentMic = useCallback(async () => {
    if (!isCallActiveRef.current) return;
    if (persistentStreamRef.current && vadRunningRef.current) return;

    try {
      setErrorMessage(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      persistentStreamRef.current = stream;

      const ctx = new (window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!)();
      if (ctx.state === 'suspended') await ctx.resume();
      audioContextRef.current = ctx;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.3;
      analyserRef.current = analyser;

      const gainNode = ctx.createGain();
      gainNode.gain.value = voiceSettingsRef.current.micGain ?? 1.0;
      gainNodeRef.current = gainNode;

      const source = ctx.createMediaStreamSource(stream);
      micSourceRef.current = source;
      source.connect(gainNode);
      gainNode.connect(analyser);

      const scriptProcessor = ctx.createScriptProcessor(4096, 1, 1);
      scriptProcessorRef.current = scriptProcessor;
      analyser.connect(scriptProcessor);

      const silentGain = ctx.createGain();
      silentGain.gain.value = 0;
      silentGainRef.current = silentGain;
      scriptProcessor.connect(silentGain);
      silentGain.connect(ctx.destination);

      // TTS 参考信号路径（仅用于口型同步，不再做回声消除）
      const refGain = ctx.createGain();
      refGain.gain.value = 1.0;
      refGainRef.current = refGain;

      const refAnalyser = ctx.createAnalyser();
      refAnalyser.fftSize = 512;
      refAnalyser.smoothingTimeConstant = 0.3;
      refAnalyserRef.current = refAnalyser;

      refGain.connect(refAnalyser);
      refAnalyser.connect(ctx.destination);

      // PCM 数据回调
      scriptProcessor.onaudioprocess = (event: AudioProcessingEvent) => {
        const inputData = event.inputBuffer.getChannelData(0);
        const pcm = new Float32Array(inputData);

        pcmPreBufferRef.current.push(pcm);
        if (pcmPreBufferRef.current.length > 8) {
          pcmPreBufferRef.current.shift();
        }

        if (isPcmCapturingRef.current) {
          pcmCaptureRef.current.push(pcm);
        }
      };

      // 重置 VAD 状态
      noiseFloorRef.current = 3;
      smoothedEnergyRef.current = 0;
      calibrateStartRef.current = Date.now();
      calibrateSamplesRef.current = [];
      speechStartRef.current = 0;
      isConfirmedSpeechRef.current = false;
      consecutiveSilenceRef.current = 0;
      energyBufferRef.current = [];
      confirmedSpeechFramesRef.current = 0;
      pcmPreBufferRef.current = [];
      pcmCaptureRef.current = [];
      isPcmCapturingRef.current = false;

      startContinuousVAD();
    } catch (err: unknown) {
      console.error('启动监听失败:', err);
      updateCallState('error');
      let msg = '无法访问麦克风';
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') msg = '麦克风权限被拒绝';
        else if (err.name === 'NotFoundError') msg = '未找到麦克风设备';
        else if (err.name === 'NotReadableError') msg = '麦克风被其他应用占用';
      }
      setErrorMessage(msg);
    }
  }, [updateCallState]);

  // ====== VAD 循环 ======
  // 核心架构简化：
  // - listening：正常能量VAD检测语音，低阈值，快速触发
  // - speaking/processing：麦克风已静音（gain=0），只读取refAnalyser做口型同步，不做插话检测
  // - 手动打断：用户点击按钮停止TTS，恢复麦克风，切回listening

  const startContinuousVAD = useCallback(() => {
    if (vadRunningRef.current) return;
    vadRunningRef.current = true;

    const analyser = analyserRef.current;
    if (!analyser) { vadRunningRef.current = false; return; }

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const sampleRate = audioContextRef.current?.sampleRate || 48000;
    const binHz = sampleRate / analyser.fftSize;
    const voiceLowBin = Math.floor(85 / binHz);
    const voiceHighBin = Math.min(Math.ceil(3400 / binHz), bufferLength - 1);
    const voiceBinCount = voiceHighBin - voiceLowBin + 1;

    const analyze = () => {
      if (!analyserRef.current || !isCallActiveRef.current) {
        vadRunningRef.current = false;
        return;
      }

      analyserRef.current.getByteFrequencyData(dataArray);

      // 全频段平均（UI 显示）
      const fullAvg = dataArray.reduce((a, b) => a + b, 0) / bufferLength;
      setAudioLevel(Math.min(fullAvg / 100, 1));

      // 人声频段加权能量
      let voiceEnergy = 0;
      for (let i = voiceLowBin; i <= voiceHighBin; i++) voiceEnergy += dataArray[i];
      const voiceAvg = voiceBinCount > 0 ? voiceEnergy / voiceBinCount : 0;

      // 更新能量环缓冲区
      energyBufferRef.current.push(voiceAvg);
      if (energyBufferRef.current.length > 30) energyBufferRef.current.shift();

      const currentState = callStateRef.current;
      const sensitivity = voiceSettingsRef.current.noiseSensitivity || 3;
      const now = Date.now();

      // ---- speaking/processing 状态：麦克风已静音，只做口型同步 ----
      if (currentState === 'speaking' || currentState === 'processing') {
        // 读取参考信号（口型同步）
        let refFullAvg = 0;
        const refAnalyser = refAnalyserRef.current;
        if (refAnalyser) {
          const refData = new Uint8Array(refAnalyser.frequencyBinCount);
          refAnalyser.getByteFrequencyData(refData);
          refFullAvg = refData.reduce((a, b) => a + b, 0) / refData.length;
        }
        setPlaybackAudioLevel(Math.min(refFullAvg / 128, 1));
        setIsVoiceDetected(false);

        // speaking状态下不更新noiseFloor（mic已静音，数据全为0）
        animationFrameRef.current = requestAnimationFrame(analyze);
        return;
      }

      // === listening 状态下的语音检测 ===

      // 噪声基线快速校准（前 500ms，重置后立即生效）
      // 使用 25 分位数（偏低），确保阈值不会过高导致正常音量无法触发
      if (now - calibrateStartRef.current < 500) {
        calibrateSamplesRef.current.push(voiceAvg);
        const sorted = [...calibrateSamplesRef.current].sort((a, b) => a - b);
        noiseFloorRef.current = Math.max(sorted[Math.floor(sorted.length * 0.25)] || 3, 2);
      }

      // 阈值计算：根据灵敏度设置，不再有冷却期
      const thresholdMap: Record<number, number> = { 1: 2.0, 2: 1.6, 3: 1.3, 4: 1.1, 5: 1.0 };
      const thresholdMultiplier = thresholdMap[sensitivity] || 1.3;
      const voiceThreshold = Math.max(noiseFloorRef.current * thresholdMultiplier, 2);

      // 平滑能量
      const alpha = 0.35;
      smoothedEnergyRef.current = smoothedEnergyRef.current * (1 - alpha) + voiceAvg * alpha;

      // 语音判定：能量超阈值
      const isSpeechNow = smoothedEnergyRef.current > voiceThreshold;

      // 调试信息
      if (Math.random() < 0.05) {
        setVadDebug({
          energy: Math.round(smoothedEnergyRef.current * 10) / 10,
          threshold: Math.round(voiceThreshold * 10) / 10,
          noise: Math.round(noiseFloorRef.current * 10) / 10,
        });
      }

      // 持续时间门
      const baseDurationGateMs: Record<number, number> = { 1: 400, 2: 300, 3: 200, 4: 150, 5: 100 };
      const gateMs = baseDurationGateMs[sensitivity] || 200;

      if (isSpeechNow) {
        consecutiveSilenceRef.current = 0;
        if (speechStartRef.current === 0) speechStartRef.current = now;

        if (!isPcmCapturingRef.current) {
          markSpeechStartRef.current();
        }

        if (!isConfirmedSpeechRef.current && now - speechStartRef.current > gateMs) {
          isConfirmedSpeechRef.current = true;
        }
        if (isConfirmedSpeechRef.current) confirmedSpeechFramesRef.current++;
      } else {
        consecutiveSilenceRef.current++;
        if (consecutiveSilenceRef.current > 8) {
          if (isPcmCapturingRef.current && confirmedSpeechFramesRef.current < 6) {
            discardSpeechRef.current();
          }
          speechStartRef.current = 0;
          isConfirmedSpeechRef.current = false;
        }
      }

      const isConfirmedVoice = isConfirmedSpeechRef.current;
      setIsVoiceDetected(isConfirmedVoice);

      if (isConfirmedVoice) {
        if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
      } else if (hasSpokenRef.current && isPcmCapturingRef.current) {
        const silenceMs = (voiceSettingsRef.current.silenceTimeout || 1.0) * 1000;
        if (!silenceTimerRef.current) {
          console.log('[VAD] 静音定时器', { silenceMs, capturing: isPcmCapturingRef.current });
          silenceTimerRef.current = setTimeout(() => {
            silenceTimerRef.current = null;
            if (hasSpokenRef.current && isPcmCapturingRef.current) {
              submitSpeechAudioRef.current();
            }
          }, silenceMs);
        }
      }

      // 持续噪声基线跟踪
      if (!isConfirmedVoice) {
        if (voiceAvg > noiseFloorRef.current) {
          noiseFloorRef.current = noiseFloorRef.current * 0.99 + voiceAvg * 0.01;
        } else {
          noiseFloorRef.current = noiseFloorRef.current * 0.995 + voiceAvg * 0.005;
        }
        if (noiseFloorRef.current < 2) noiseFloorRef.current = 2;
      }

      animationFrameRef.current = requestAnimationFrame(analyze);
    };

    animationFrameRef.current = requestAnimationFrame(analyze);
  }, []);

  // 同步函数 ref
  useEffect(() => { markSpeechStartRef.current = markSpeechStart; }, [markSpeechStart]);
  useEffect(() => { submitSpeechAudioRef.current = submitSpeechAudio; }, [submitSpeechAudio]);
  useEffect(() => { discardSpeechRef.current = discardSpeech; }, [discardSpeech]);

  // ====== 通话控制 ======

  // ====== 登录处理 ======
  const handleLogin = useCallback((info: LoginInfo) => {
    // 先清除上一个用户的所有状态，防止数据交叉
    setMessages([]);
    setPreviousSessions([]);
    setViewingHistory(false);
    setLearningInsight({ weakPoints: [], suggestions: [], lastUpdate: 0 });
    setErrorMessage(null);
    setActiveTab('call');

    setLoginInfo(info);
    if (info.role === 'student') {
      // 学生：从数据库解析 student_id（兼容历史数据）
      const resolveAndLoad = async () => {
        const sid = await resolveStudentId(info.name, info.teacherId || 'teacher_default');
        setStudentId(sid);
        studentIdRef.current = sid;

        // 加载历史会话列表
        if (info.teacherId) {
          fetch('/api/chat/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'history', student_id: sid, teacher_id: info.teacherId }),
          })
            .then(r => r.json())
            .then(d => {
              setPreviousSessions(d.sessions || []);
            })
            .catch(() => {});
        }
      // 从服务端加载教师档案（头像、教学信息）
      if (info.teacherId) {
        fetch(`/api/teacher?teacherId=${encodeURIComponent(info.teacherId)}`)
          .then(r => r.json())
          .then(d => {
            if (d.success && d.teacher) {
              const t = d.teacher;
              const newProfile: TeacherProfile = {
                id: t.id,
                name: t.name || '',
                title: t.title || '',
                subjects: t.subjects || '',
                expertise: t.expertise || '',
                guidingQuestions: t.guiding_questions || '',
                teachingStyle: t.teaching_style || '',
                    knowledgeTable: t.knowledge_table,
              };
              setTeacherProfile(newProfile);
              // 同步头像到数字人
              if (t.avatar_url) {
                setVoiceSettings(prev => ({ ...prev, customImage: t.avatar_url }));
              }
              // 加载教师的声音设置
              if (t.metadata?.voiceSettings) {
                setVoiceSettings(prev => ({ ...prev, ...t.metadata.voiceSettings }));
              } else if (t.voice_speaker) {
                // 兼容旧数据：使用基本字段
                setVoiceSettings(prev => ({
                  ...prev,
                  speaker: t.voice_speaker,
                  speechRate: t.voice_speed ?? prev.speechRate,
                  loudnessRate: t.voice_volume ?? prev.loudnessRate,
                }));
              }
              try { localStorage.setItem('teacherProfile', JSON.stringify(newProfile)); } catch { /* ignore */ }
            }
          })
          .catch(() => {});
      }
      };
      resolveAndLoad();
    } else if (info.role === 'teacher') {
      // 教师：显示管理面板
      setShowTeacherDashboard(true);
      // 从服务端加载教师档案
      if (info.teacherId) {
        fetch(`/api/teacher?teacherId=${encodeURIComponent(info.teacherId)}`)
          .then(r => r.json())
          .then(d => {
            if (d.success && d.teacher) {
              const t = d.teacher;
              const newProfile: TeacherProfile = {
                id: t.id,
                name: t.name || '',
                title: t.title || '',
                subjects: t.subjects || '',
                expertise: t.expertise || '',
                guidingQuestions: t.guiding_questions || '',
                teachingStyle: t.teaching_style || '',
                    knowledgeTable: t.knowledge_table,
              };
              setTeacherProfile(newProfile);
              if (t.avatar_url) {
                setVoiceSettings(prev => ({ ...prev, customImage: t.avatar_url }));
              }
              // 加载教师自己的声音设置
              if (t.metadata?.voiceSettings) {
                setVoiceSettings(prev => ({ ...prev, ...t.metadata.voiceSettings }));
              } else if (t.voice_speaker) {
                setVoiceSettings(prev => ({
                  ...prev,
                  speaker: t.voice_speaker,
                  speechRate: t.voice_speed ?? prev.speechRate,
                  loudnessRate: t.voice_volume ?? prev.loudnessRate,
                }));
              }
              try { localStorage.setItem('teacherProfile', JSON.stringify(newProfile)); } catch { /* ignore */ }
            }
          })
          .catch(() => {});
      }
    }
    try {
      localStorage.setItem('loginInfo', JSON.stringify(info));
    } catch { /* ignore */ }
  }, [activeTab]);

  const handleLogout = useCallback(() => {
    // 清除所有用户相关的状态
    setLoginInfo(null);
    setStudentId('');
    setMessages([]);
    setPreviousSessions([]);
    setViewingHistory(false);
    setLearningInsight({ weakPoints: [], suggestions: [], lastUpdate: 0 });
    setTeacherProfile(DEFAULT_TEACHER_PROFILE);
    setVoiceSettings(DEFAULT_VOICE_SETTINGS);
    setActiveTab('call');
    setErrorMessage(null);
    setShowTeacherDashboard(false);
    setIsCallActive(false);

    // 清除 refs
    studentIdRef.current = '';
    loginInfoRef.current = null;
    savedMsgIdsRef.current = new Set();

    // 清除 localStorage
    try {
      localStorage.removeItem('loginInfo');
      localStorage.removeItem('studentId');
      localStorage.removeItem('teacherProfile');
    } catch { /* ignore */ }
  }, []);

  const startCall = useCallback(async () => {
    setIsCallActive(true);
    setMessages([]);
    updateCallState('listening');
    setErrorMessage(null);
    // 生成新的会话ID
    sessionIdRef.current = 'sess_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    messagesSavedRef.current = false;
    savedMsgIdsRef.current = new Set(); // 重置已保存消息ID集合
    setTimeout(() => setupPersistentMic(), 300);

    // 异步检查学生是否有记忆，决定开场白策略
    let greetingType: 'intro' | 'recall' = 'intro';
    const currentStudentId = studentIdRef.current;
    if (currentStudentId) {
      try {
        const recallResp = await fetch('/api/memory/recall', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ student_id: currentStudentId, teacher_id: loginInfoRef.current?.teacherId || 'teacher_default' }),
        });
        if (recallResp.ok) {
          const recallData = await recallResp.json();
          if (recallData.success) {
            const mem = recallData.memory;
            // 有对话记录或知识掌握记录 → 老学生
            const hasConversations = mem?.recent_conversations?.length > 0;
            const hasKnowledge = mem?.knowledge_mastery?.total_topics > 0;
            const hasKeyMoments = mem?.key_moments?.length > 0;
            if (hasConversations || hasKnowledge || hasKeyMoments) {
              greetingType = 'recall';
            }
            // 更新学习分析面板
            updateLearningInsight(mem);
          }
        }
        console.log('[CALL] 记忆检查完成', { student_id: currentStudentId, greetingType });
      } catch (err) {
        console.warn('[CALL] 记忆检查失败，默认使用自我介绍:', err);
      }
    }

    // 延迟一点触发开场白，等麦克风设置完成
    setTimeout(() => {
      const introText = greetingType === 'recall'
        ? '请根据记忆信息，向学生打招呼。'
        : '请开始本次对话的问候。';
      sendMessage(introText, true, greetingType);
    }, 800);
  }, [setupPersistentMic, updateCallState, sendMessage]);

  const endCall = useCallback(() => {
    setIsCallActive(false);
    hasSpokenRef.current = false;
    confirmedSpeechFramesRef.current = 0;
    energyBufferRef.current = [];
    vadRunningRef.current = false;
    isPcmCapturingRef.current = false;
    pcmPreBufferRef.current = [];
    pcmCaptureRef.current = [];

    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.onaudioprocess = null;
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }

    stopTTSPlayback();

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

    if (persistentStreamRef.current) {
      persistentStreamRef.current.getTracks().forEach(t => t.stop());
      persistentStreamRef.current = null;
    }
    if (micSourceRef.current) { micSourceRef.current.disconnect(); micSourceRef.current = null; }
    if (gainNodeRef.current) { gainNodeRef.current.disconnect(); gainNodeRef.current = null; }
    if (analyserRef.current) { analyserRef.current.disconnect(); analyserRef.current = null; }
    if (silentGainRef.current) { silentGainRef.current.disconnect(); silentGainRef.current = null; }
    if (playbackBufferSourceRef.current) {
      try { playbackBufferSourceRef.current.stop(); } catch { /* already stopped */ }
      try { playbackBufferSourceRef.current.disconnect(); } catch { /* ignore */ }
      playbackBufferSourceRef.current = null;
    }
    if (ttsFetchAbortRef.current) {
      ttsFetchAbortRef.current.abort();
      ttsFetchAbortRef.current = null;
    }
    if (refGainRef.current) { refGainRef.current.disconnect(); refGainRef.current = null; }
    if (refAnalyserRef.current) { refAnalyserRef.current.disconnect(); refAnalyserRef.current = null; }
    if (audioContextRef.current) { audioContextRef.current.close(); audioContextRef.current = null; }
    analyserRef.current = null;

    updateCallState('idle');
    setAudioLevel(0);
    setPlaybackAudioLevel(0);
    setIsVoiceDetected(false);
    setErrorMessage(null);

    // 学生通话结束后：保存剩余未保存的消息 → 切换到历史记录标签页
    if (userRole === 'student') {
      // 保存任何尚未保存的消息（增量保存通常已覆盖大部分，此处为兜底）
      saveNewMessages();

      // 切换到历史记录标签页
      setViewingHistory(false);
      setActiveTab('history');

      // 刷新历史记录列表
      const teacherId = loginInfoRef.current?.teacherId || 'teacher_default';
      if (studentIdRef.current) {
        fetch('/api/chat/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'history', student_id: studentIdRef.current, teacher_id: teacherId }),
        })
          .then(r => r.json())
          .then(d => {
            setPreviousSessions(d.sessions || []);
          })
          .catch(() => {});
      }
    }
  }, [stopTTSPlayback, updateCallState, userRole, setActiveTab, saveNewMessages]);

  const restartConversation = useCallback(() => {
    // 先结束当前通话
    endCall();
    // 清空消息
    setMessages([]);
    // 重置历史查看状态
    setViewingHistory(false);
    // 重置学习分析
    setLearningInsight({ weakPoints: [], suggestions: [], lastUpdate: 0 });
    // 延迟重新开始
    setTimeout(() => {
      startCall();
    }, 500);
  }, [endCall, startCall]);

  const getCallStateText = () => {
    switch (callState) {
      case 'listening': return '请说话...';
      case 'processing': return '思考中...';
      case 'speaking': return '回答中';
      case 'error': return '出错了';
      default: return '准备就绪';
    }
  };

  // 图片灯箱状态
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Warm gradient background */}
      <div className="fixed inset-0 warm-gradient-bg pointer-events-none" />

      {/* ====== Login Overlay ====== */}
      {isLoginReady && !loginInfo && <LoginOverlay onLogin={handleLogin} currentLoginInfo={null} />}

      {/* ====== Admin Dashboard ====== */}
      {loginInfo?.role === 'admin' && (
        <AdminDashboard onLogout={handleLogout} />
      )}

      {/* ====== Teacher Dashboard ====== */}
      {loginInfo?.role === 'teacher' && showTeacherDashboard && (
        <TeacherDashboard
          teacherId={loginInfo.teacherId || ''}
          teacherName={loginInfo.teacherName || loginInfo.name}
          onLogout={handleLogout}
          onStartTeaching={() => setShowTeacherDashboard(false)}
          onProfileSaved={(p) => {
            // 同步教师档案到主页面（头像、教学信息）
            const newProfile: TeacherProfile = {
              id: p.id,
              name: p.name,
              title: p.title || '',
              subjects: p.subjects || '',
              expertise: p.expertise || '',
              guidingQuestions: p.guiding_questions || '',
              teachingStyle: p.teaching_style || '',
              knowledgeTable: p.knowledge_table,
            };
            setTeacherProfile(newProfile);
            // 同步头像到数字人
            if (p.avatar_url) {
              setVoiceSettings(prev => ({ ...prev, customImage: p.avatar_url! }));
            }
            try { localStorage.setItem('teacherProfile', JSON.stringify(newProfile)); } catch { /* ignore */ }
          }}
        />
      )}

      {/* ====== Main App (student mode or teacher teaching mode) ====== */}
      {loginInfo && (loginInfo.role === 'student' || loginInfo.role === 'teacher') && !showTeacherDashboard && (
      <>
      {/* ====== Header ====== */}
      <header className="relative z-20 border-b border-border/40 bg-card/60 backdrop-blur-sm shrink-0">
        <div className="flex items-center justify-between px-3 sm:px-5 py-2 sm:py-2.5">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <img src="/logo.png" alt="" className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg object-contain shrink-0" />
            <h1 className="text-sm sm:text-base font-serif font-semibold text-foreground">{loginInfo?.teacherName || loginInfo?.name || 'AI'}的课堂</h1>
            {userRole === 'student' && viewingHistory && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setMessages([]);
                  setViewingHistory(false);
                  setActiveTab('history');
                }}
                className="text-xs rounded-lg h-7 ml-2 border-primary/30 text-primary hover:bg-primary/10"
              >
                <BookOpen className="w-3.5 h-3.5 mr-1" />
                返回历史记录
              </Button>
            )}
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3">
            {isCallActive && (
              <Badge variant="secondary" className="bg-primary/10 text-primary gap-1.5 border border-primary/15 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />通话中
              </Badge>
            )}
            {loginInfo?.role === 'teacher' && (
              <Button variant="outline" size="sm" onClick={() => setShowTeacherDashboard(true)} className="text-xs rounded-lg h-7">
                管理面板
              </Button>
            )}
            {userRole === 'teacher' && (
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg border border-border/40 bg-card/50">
                <Switch id="knowledge-mode" checked={useKnowledge} onCheckedChange={setUseKnowledge} />
                <Label htmlFor="knowledge-mode" className={`text-xs cursor-pointer ${useKnowledge ? 'text-primary' : 'text-muted-foreground'}`}>
                  知识库 {useKnowledge ? '开' : '关'}
                </Label>
              </div>
            )}
            {userRole === 'teacher' && (
              <VoiceSettingsComponent settings={voiceSettings} onSettingsChange={setVoiceSettings} teacherId={loginInfo?.teacherId} />
            )}
            <div className="flex items-center gap-2 pl-3 border-l border-border/40">
              <div className="text-right">
                <p className="text-xs font-medium text-foreground">{loginInfo.name}</p>
                <p className="text-[10px] text-muted-foreground">{userRole === 'teacher' ? '教师' : loginInfo.grade || '学生'}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-xs text-muted-foreground hover:text-foreground px-2 h-7">
                退出
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* ====== Body: Tab content ====== */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col relative z-10 min-h-0">
        <div className="border-b border-border/30 bg-card/30 backdrop-blur-sm px-2 sm:px-5 shrink-0">
          <TabsList className="bg-transparent h-9 sm:h-10 gap-1 sm:gap-3">
            <TabsTrigger value="call" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-[0_2px_0_var(--primary)/0.4] rounded-lg h-8 px-2 sm:px-3.5 text-muted-foreground text-xs sm:text-sm transition-all">
              <Mic className="w-3.5 h-3.5 sm:mr-1.5" /><span className="hidden sm:inline">智能助教</span>
            </TabsTrigger>
            {userRole === 'teacher' && (
              <TabsTrigger value="knowledge" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-[0_2px_0_var(--primary)/0.4] rounded-lg h-8 px-2 sm:px-3.5 text-muted-foreground text-xs sm:text-sm transition-all">
                <BookOpen className="w-3.5 h-3.5 sm:mr-1.5" /><span className="hidden sm:inline">知识库</span>
              </TabsTrigger>
            )}
            {userRole === 'student' && (
              <>
                <TabsTrigger value="memory" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-[0_2px_0_var(--primary)/0.4] rounded-lg h-8 px-2 sm:px-3.5 text-muted-foreground text-xs sm:text-sm transition-all">
                  <BookOpen className="w-3.5 h-3.5 sm:mr-1.5" /><span className="hidden sm:inline">学习记忆</span>
                </TabsTrigger>
                <TabsTrigger value="history" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-[0_2px_0_var(--primary)/0.4] rounded-lg h-8 px-2 sm:px-3.5 text-muted-foreground text-xs sm:text-sm transition-all">
                  <History className="w-3.5 h-3.5 sm:mr-1.5" /><span className="hidden sm:inline">历史记录</span>
                  {previousSessions.length > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-primary/10 text-primary rounded-full">{previousSessions.length}</span>
                  )}
                </TabsTrigger>
              </>
            )}
          </TabsList>
        </div>

        {/* ====== 智能助教 ====== */}
        <TabsContent value="call" className="flex-1 min-h-0 m-0 relative">
          {/* 全屏容器：flex布局，左侧数字人+学习分析 + 右侧交互区 */}
          <div className="absolute inset-0 flex">

            {/* === 左侧区域：上方数字人 + 下方学习分析 === */}
            {voiceSettings.useDigitalHuman && (
              <div className="hidden md:flex w-56 lg:w-64 flex-shrink-0 flex-col p-3 lg:p-4 gap-3 lg:gap-4">
                {/* 上方：数字人头像 */}
                <div className="flex justify-center pt-4">
                  <div className={`relative transition-all duration-300 ${isCallActive ? 'scale-100 opacity-100' : 'scale-90 opacity-50 hover:opacity-80'}`}>
                    {isCallActive && (
                      <div className={`absolute -inset-2 rounded-2xl transition-all duration-500 ${
                        callState === 'listening' ? 'border-2 border-primary/40 shadow-[0_0_10px_hsl(var(--primary)/0.1)] animate-pulse' :
                        callState === 'speaking' ? 'border-2 border-primary/25 shadow-[0_0_14px_hsl(var(--primary)/0.12)]' :
                        callState === 'processing' ? 'border-2 border-primary/15 warm-breathe-ring' :
                        'border border-border/15'
                      }`} />
                    )}
                    <DigitalHuman
                      isSpeaking={callState === 'speaking'}
                      audioLevel={playbackAudioLevel}
                      isListening={callState === 'listening'}
                      isProcessing={callState === 'processing'}
                      isError={callState === 'error'}
                      customImage={voiceSettings.customImage}
                      size="lg"
                    />
                  </div>
                </div>

                {/* 下方：学习分析面板（仅学生模式显示） */}
                {userRole === 'student' && (
                  <div className="flex-1 min-h-0 flex flex-col bg-card/60 backdrop-blur-sm border border-border/30 rounded-xl p-3 overflow-hidden">
                    {/* 薄弱环节 */}
                    <div className="mb-3 min-h-0 flex-shrink-0">
                      <div className="flex items-center gap-1.5 mb-2">
                        <AlertCircle className="w-3.5 h-3.5 text-primary" />
                        <span className="text-xs font-medium text-foreground">发现的问题</span>
                        {learningInsight.weakPoints.length > 0 && (
                          <span className="text-xs text-primary/60 ml-auto">{learningInsight.weakPoints.length}</span>
                        )}
                      </div>
                      {learningInsight.weakPoints.length > 0 ? (
                        <div className="space-y-1 max-h-28 overflow-y-auto">
                          {learningInsight.weakPoints.map((point, idx) => (
                            <div key={idx} className="text-xs text-muted-foreground bg-muted/30 rounded px-2 py-1">
                              {point}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground/50 italic">对话中暂未发现问题</div>
                      )}
                    </div>

                    {/* 学习建议 */}
                    <div className="flex-1 min-h-0">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Lightbulb className="w-3.5 h-3.5 text-primary" />
                        <span className="text-xs font-medium text-foreground">学习建议</span>
                        {learningInsight.suggestions.length > 0 && (
                          <span className="text-xs text-primary/60 ml-auto">{learningInsight.suggestions.length}</span>
                        )}
                      </div>
                      {learningInsight.suggestions.length > 0 ? (
                        <div className="space-y-1 overflow-y-auto max-h-40">
                          {learningInsight.suggestions.map((suggestion, idx) => (
                            <div key={idx} className="text-xs text-muted-foreground bg-primary/5 rounded px-2 py-1 border-l-2 border-primary/30">
                              {suggestion}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground/50 italic">继续对话获取建议</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* === 右侧交互区域 === */}
            <div className="flex-1 min-w-0 min-h-0 flex flex-col p-2 md:p-4">
              <div className="w-full flex-1 flex flex-col min-h-0 bg-card/70 backdrop-blur-sm border border-border/40 rounded-xl shadow-sm overflow-hidden">
                {/* 手机端固定头部：头像(左) + 学习分析(右) */}
                <div className="md:hidden shrink-0 px-3 pt-2.5 pb-2 border-b border-border/20 bg-card/70 backdrop-blur-sm">
                  <div className="flex gap-2.5">
                    {/* 左侧：头像 + 名字 + 状态 */}
                    <div className="flex flex-col items-center shrink-0 gap-0.5">
                      <div className="relative">
                        <DigitalHuman
                          isSpeaking={callState === 'speaking'}
                          audioLevel={playbackAudioLevel}
                          isListening={callState === 'listening'}
                          isProcessing={callState === 'processing'}
                          isError={callState === 'error'}
                          customImage={voiceSettings.customImage}
                          size="sm"
                        />
                      </div>
                      <p className="text-[11px] font-medium text-foreground truncate max-w-[56px] text-center">{teacherProfile?.name || loginInfo?.teacherName || 'AI助教'}</p>
                      {isCallActive && (
                        <p className="text-[10px] text-primary text-center">
                          {callState === 'listening' && '聆听中'}
                          {callState === 'processing' && '思考中'}
                          {callState === 'speaking' && '回答中'}
                        </p>
                      )}
                    </div>
                    {/* 右侧：发现的问题 + 学习建议（仅学生，固定高度可滚动） */}
                    {userRole === 'student' && (
                      <div className="flex-1 min-w-0 flex flex-col gap-1.5 overflow-hidden bg-card/60 backdrop-blur-sm border border-border/30 rounded-lg p-2 max-h-[120px]">
                        {/* 发现的问题 */}
                        <div className="min-h-0 flex-1 flex flex-col overflow-hidden">
                          <div className="flex items-center gap-1.5 mb-0.5 shrink-0">
                            <AlertCircle className="w-3 h-3 text-primary" />
                            <span className="text-[11px] font-medium text-foreground">发现问题</span>
                            {learningInsight.weakPoints.length > 0 && (
                              <span className="text-[10px] text-primary/60 ml-auto">{learningInsight.weakPoints.length}</span>
                            )}
                          </div>
                          <div className="flex-1 min-h-0 overflow-y-auto space-y-0.5 pr-0.5">
                            {learningInsight.weakPoints.length > 0 ? (
                              learningInsight.weakPoints.slice(0, 5).map((point, idx) => (
                                <div key={idx} className="text-[10px] text-muted-foreground bg-muted/30 rounded px-1.5 py-0.5 truncate">{point}</div>
                              ))
                            ) : (
                              <div className="text-[10px] text-muted-foreground/50 italic">暂未发现问题</div>
                            )}
                          </div>
                        </div>
                        {/* 学习建议 */}
                        <div className="min-h-0 flex-1 flex flex-col overflow-hidden">
                          <div className="flex items-center gap-1.5 mb-0.5 shrink-0">
                            <Lightbulb className="w-3 h-3 text-primary" />
                            <span className="text-[11px] font-medium text-foreground">学习建议</span>
                            {learningInsight.suggestions.length > 0 && (
                              <span className="text-[10px] text-primary/60 ml-auto">{learningInsight.suggestions.length}</span>
                            )}
                          </div>
                          <div className="flex-1 min-h-0 overflow-y-auto space-y-0.5 pr-0.5">
                            {learningInsight.suggestions.length > 0 ? (
                              learningInsight.suggestions.slice(0, 3).map((suggestion, idx) => (
                                <div key={idx} className="text-[10px] text-muted-foreground bg-primary/5 rounded px-1.5 py-0.5 border-l-2 border-primary/30 truncate">{suggestion}</div>
                              ))
                            ) : (
                              <div className="text-[10px] text-muted-foreground/50 italic">继续对话获取建议</div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                {/* 消息列表 - 可滚动 */}
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden" ref={scrollContainerRef}>
                  <div className="px-3 sm:px-4 py-3 space-y-3">
                    {/* 历史会话查看提示 - 当查看历史时显示 */}
                    {userRole === 'student' && viewingHistory && messages.length > 0 && (
                      <div className="w-full max-w-sm mx-auto mb-4 p-2.5 bg-primary/5 border border-primary/15 rounded-lg text-center">
                        <span className="text-xs text-muted-foreground">正在查看历史对话</span>
                      </div>
                    )}

                    {/* 空状态：未开始对话 */}
                    {messages.length === 0 && !viewingHistory && (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-center mb-3">
                          <GraduationCap className="w-7 h-7 text-primary/40" />
                        </div>
                        <h2 className="text-base font-serif font-semibold text-foreground mb-1">
                          {!isCallActive ? '开始今天的学习' : '有什么想问的？'}
                        </h2>
                        <p className="text-muted-foreground text-sm">
                          {!isCallActive ? `点击电话按钮，和${teacherProfile?.name || loginInfo?.teacherName || '老师'}交流` : '说出你的问题，或输入文字'}
                        </p>
                      </div>
                    )}

                    {/* 消息列表 */}
                    {messages.map((msg, idx) => (
                        <div key={`${msg.id}-${idx}`} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                          <Avatar className="w-7 h-7 flex-shrink-0 mt-0.5">
                            {msg.role === 'user' ? (
                              <div className="bg-muted flex items-center justify-center w-full h-full rounded-full"><User className="w-3.5 h-3.5 text-muted-foreground" /></div>
                            ) : (
                              <div className="bg-primary/10 flex items-center justify-center w-full h-full rounded-full"><Bot className="w-3.5 h-3.5 text-primary" /></div>
                            )}
                          </Avatar>
                          <div className={`max-w-[85%] min-w-0 space-y-1.5 ${msg.role === 'user' ? 'items-end' : ''}`}>
                            <Card className={`px-3.5 py-2.5 ${
                              msg.role === 'user'
                                ? 'bg-primary/8 border-primary/15 text-foreground'
                                : 'warm-card text-foreground/85'
                            }`}>
                              <p className={`whitespace-pre-wrap text-sm leading-relaxed ${msg.role === 'user' ? 'text-foreground' : 'text-foreground/85'}`}>
                                {msg.content || <span className="text-muted-foreground animate-pulse">思考中...</span>}
                              </p>
                              {/* 图片生成中 */}
                              {msg.isGeneratingImage && (
                                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/20">
                                  <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                                  <span className="text-xs text-muted-foreground">正在生成辅助图示...</span>
                                </div>
                              )}
                            </Card>
                            {/* 建议生成图示按钮 */}
                            {msg.suggestImage && !msg.imageUrl && !msg.isGeneratingImage && (
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  className="h-7 px-3 text-xs warm-button-primary gap-1.5"
                                  onClick={() => handleConfirmImage(msg.id)}
                                >
                                  <ImageIcon className="w-3.5 h-3.5" />生成辅助图示
                                </Button>
                              </div>
                            )}
                            {/* 生成的图片 */}
                            {msg.imageUrl && (
                              <div
                                className="rounded-lg overflow-hidden border border-border/30 cursor-pointer hover:opacity-90 transition-opacity shadow-sm max-w-[240px] md:max-w-xs"
                                onClick={() => setLightboxImage(msg.imageUrl!)}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={msg.imageUrl} alt="辅助图示" className="w-full object-contain bg-card/50" />
                              </div>
                            )}
                            {/* 语音朗读按钮（非通话时） */}
                            {msg.role === 'assistant' && msg.content && !isCallActive && (
                              <div className="flex items-center gap-1.5">
                                {msg.isPlaying ? (
                                  <Button variant="ghost" size="sm" className="h-6 px-2 text-destructive hover:text-destructive hover:bg-destructive/8 text-[11px]" onClick={handleStopSpeaking}>
                                    <VolumeX className="w-3 h-3 mr-1" />停止
                                  </Button>
                                ) : (
                                  <Button variant="ghost" size="sm" className="h-6 px-2 text-muted-foreground hover:text-primary hover:bg-primary/8 text-[11px]" onClick={() => { if (!isMuted) speakText(msg.content, msg.id); }} disabled={isMuted}>
                                    <Volume2 className="w-3 h-3 mr-1" />朗读
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    }
                    <div ref={messagesEndRef} />
                  </div>
                </div>

                {/* 输入栏 - 固定在窗口底部 */}
                <div className="shrink-0 border-t border-border/30 bg-card/50 px-3 py-2">
                  <div className="flex items-center gap-2">
                    {/* 语音通话按钮 */}
                    {!isCallActive ? (
                      <Button variant="ghost" size="icon" className="shrink-0 w-9 h-9 rounded-full text-primary hover:bg-primary/10 hover:text-primary border border-primary/20" onClick={startCall} title="开始语音通话">
                        <Phone className="w-4 h-4" />
                      </Button>
                    ) : (
                      <div className="flex items-center gap-1 shrink-0">
                        {callState === 'speaking' && (
                          <Button variant="outline" size="icon" className="w-9 h-9 rounded-full border-primary/30 text-primary hover:bg-primary/10 animate-pulse" onClick={handleStopSpeaking} title="打断">
                            <StopCircle className="w-4 h-4" />
                          </Button>
                        )}
                        {callState === 'listening' && (
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center border border-primary/15">
                            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                          </div>
                        )}
                        {callState === 'processing' && (
                          <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center">
                            <Loader2 className="w-3.5 h-3.5 text-secondary-foreground animate-spin" />
                          </div>
                        )}
                        <Button variant="ghost" size="icon" className={`w-7 h-7 rounded-full ${isMuted ? 'bg-destructive/8 text-destructive' : 'text-muted-foreground hover:text-foreground'}`} onClick={() => setIsMuted(!isMuted)}>
                          {isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                        </Button>
                        <Button variant="destructive" size="icon" className="w-7 h-7 rounded-full" onClick={endCall}>
                          <PhoneOff className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="w-7 h-7 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={restartConversation} title="重新开始对话">
                          <RotateCcw className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                    {/* 文字输入 */}
                    <div className="flex-1">
                      <Textarea
                        value={textInput}
                        onChange={e => setTextInput(e.target.value)}
                        placeholder={isCallActive ? '也可输入文字...' : '输入你的问题...'}
                        className="min-h-[36px] max-h-[72px] bg-card/50 border-border/40 text-foreground placeholder-muted-foreground/50 resize-none text-sm py-1.5"
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (textInput.trim()) sendMessage(textInput); } }}
                      />
                    </div>
                    <Button onClick={() => { if (textInput.trim()) sendMessage(textInput); }} disabled={!textInput.trim()} className="shrink-0 h-9 px-3 warm-button-primary text-sm">
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                  {/* 通话状态行 */}
                  {isCallActive && (
                    <div className="flex items-center justify-center gap-3 mt-1">
                      <span className="text-[10px] text-muted-foreground">
                        {callState === 'listening' && '聆听中'}
                        {callState === 'processing' && '思考中'}
                        {callState === 'speaking' && '回答中'}
                        {callState === 'error' && '出错'}
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground/60">{formatDuration(callDuration)}</span>
                      {callState === 'listening' && (
                        <div className="w-12 h-0.5 bg-muted/50 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-100 ${isVoiceDetected ? 'bg-primary' : 'bg-primary/25'}`} style={{ width: `${Math.min(audioLevel * 100, 100)}%` }} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 错误提示 */}
            {errorMessage && (
              <Alert variant="destructive" className="absolute top-4 left-1/2 -translate-x-1/2 max-w-md z-30 warm-glow-border" style={{ borderColor: 'oklch(0.55 0.18 22 / 0.3)' }}>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  {errorMessage}
                  <Button variant="destructive" size="sm" onClick={() => setErrorMessage(null)}>关闭</Button>
                </AlertDescription>
              </Alert>
            )}
          </div>
        </TabsContent>

        {/* ====== 知识库浏览 (教师助教模式，只读) ====== */}
        {userRole === 'teacher' && (
        <TabsContent value="knowledge" className="flex-1 min-h-0 m-0 p-0 overflow-y-auto">
          <div className="p-3 space-y-3">
            <KnowledgeManager
              teacherProfile={teacherProfile}
              knowledgeTable={teacherProfile?.knowledgeTable || (loginInfo?.teacherId ? `kb_${loginInfo.teacherId}` : undefined)}
              onProfileChange={(profile: TeacherProfile) => {
                setTeacherProfile(profile);
                try { localStorage.setItem('teacherProfile', JSON.stringify(profile)); } catch { /* ignore */ }
              }}
              readOnly
            />
          </div>
        </TabsContent>
        )}

        {/* ====== Student Memory (学生专属) ====== */}
        {userRole === 'student' && (
        <TabsContent value="memory" className="flex-1 min-h-0 m-0 p-0 overflow-y-auto">
          <div className="p-3">
            <StudentMemoryPanel studentId={studentId} studentName={loginInfo?.name || ''} teacherId={loginInfo?.teacherId} />
          </div>
        </TabsContent>
        )}

        {/* ====== 历史记录标签页（仅学生） ====== */}
        {userRole === 'student' && (
          <TabsContent value="history" className="flex-1 min-h-0 m-0 overflow-y-auto">
            <div className="p-5 max-w-2xl mx-auto">
              <div className="flex items-center gap-2 mb-4">
                <History className="w-4 h-4 text-primary" />
                <h2 className="text-base font-serif font-semibold text-foreground">历史对话记录</h2>
              </div>

              {previousSessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-muted/30 flex items-center justify-center mb-3">
                    <History className="w-7 h-7 text-muted-foreground/40" />
                  </div>
                  <h3 className="text-sm font-medium text-foreground mb-1">暂无历史记录</h3>
                  <p className="text-xs text-muted-foreground">结束对话后会自动保存历史记录</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {previousSessions.map(session => (
                    <button
                      key={session.session_id}
                      className="w-full text-left p-4 rounded-xl bg-card/60 hover:bg-card border border-border/30 transition-all"
                      onClick={async () => {
                        try {
                          const resp = await fetch('/api/chat/messages', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'load', session_id: session.session_id }),
                          });
                          const data = await resp.json();
                          if (data.success && data.messages?.length > 0) {
                            setMessages(data.messages.map((m: { id: string; role: string; content: string; message_type?: string; image_url?: string }) => ({
                              id: m.id,
                              role: m.role,
                              text: m.content,
                              content: m.content,
                              imageUrl: m.image_url || undefined,
                            })));
                            setViewingHistory(true);
                            setActiveTab('call');
                          }
                        } catch (e) {
                          console.warn('加载历史会话失败:', e);
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground truncate font-medium">
                            {session.first_message || '对话记录'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(session.created_at).toLocaleDateString()} {new Date(session.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            <span className="ml-2">{session.message_count}条消息</span>
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground/50 flex-shrink-0 mt-0.5" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* ====== 图片灯箱 ====== */}
      {lightboxImage && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 md:p-8" onClick={() => setLightboxImage(null)}>
          <div className="relative max-w-4xl max-h-full">
            <Button variant="ghost" size="icon" className="absolute -top-10 right-0 text-foreground hover:bg-muted" onClick={() => setLightboxImage(null)}>
              <X className="w-5 h-5" />
            </Button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightboxImage} alt="辅助图示" className="max-w-full max-h-[70vh] md:max-h-[80vh] object-contain rounded-lg shadow-lg" onClick={e => e.stopPropagation()} />
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}
