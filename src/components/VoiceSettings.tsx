'use client';

import { useState, useEffect, useRef } from 'react';
import { Settings, Volume2, User, Mic, Palette, Play, Square, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';

// 声音预设 - 与 SDK 官方列表完全对应
interface VoicePreset {
  id: string;
  name: string;
  speaker: string;
  description: string;
  gender: 'male' | 'female';
  category: string;
}

// 声音设置
interface VoiceSettings {
  speaker: string;
  speechRate: number;
  loudnessRate: number;
  pitchRate: number;
  useDigitalHuman: boolean;
  customImage?: string;
  silenceTimeout?: number;   // 静音多少秒后自动提交，默认1.2秒
  noiseSensitivity?: number; // 噪声灵敏度 1-5，3=默认，1=最不敏感(强降噪)，5=最敏感
  micGain?: number;          // 麦克风增益 0.1-1.0，默认1.0
}

const VOICE_PRESETS: VoicePreset[] = [
  // 通用
  { id: 'xiaohe', name: '小荷', speaker: 'zh_female_xiaohe_uranus_bigtts', description: '温柔亲切，适合教学场景', gender: 'female', category: '通用' },
  { id: 'vv', name: 'Vivi', speaker: 'zh_female_vv_uranus_bigtts', description: '中英双语，自然流畅', gender: 'female', category: '通用' },
  { id: 'm191', name: '云舟', speaker: 'zh_male_m191_uranus_bigtts', description: '沉稳大气，适合正式场合', gender: 'male', category: '通用' },
  { id: 'taocheng', name: '小天', speaker: 'zh_male_taocheng_uranus_bigtts', description: '清朗干练，条理清晰', gender: 'male', category: '通用' },
  // 有声书
  { id: 'xueayi', name: '雪阿姨', speaker: 'zh_female_xueayi_saturn_bigtts', description: '儿童故事，温暖柔和', gender: 'female', category: '有声书' },
  // 视频配音
  { id: 'dayi', name: '大义', speaker: 'zh_male_dayi_saturn_bigtts', description: '浑厚有力，适合纪录片', gender: 'male', category: '视频配音' },
  { id: 'mizai', name: '米仔', speaker: 'zh_female_mizai_saturn_bigtts', description: '灵动活泼，适合短视频', gender: 'female', category: '视频配音' },
  { id: 'jitangnv', name: '鸡汤姐', speaker: 'zh_female_jitangnv_saturn_bigtts', description: '励志激昂，富有感染力', gender: 'female', category: '视频配音' },
  { id: 'meilinvyou', name: '美邻友', speaker: 'zh_female_meilinvyou_saturn_bigtts', description: '甜美知性，亲切近人', gender: 'female', category: '视频配音' },
  { id: 'santongyongns', name: '三通', speaker: 'zh_female_santongyongns_saturn_bigtts', description: '平稳自然，百搭通用', gender: 'female', category: '视频配音' },
  { id: 'ruyayichen', name: '儒雅一尘', speaker: 'zh_male_ruyayichen_saturn_bigtts', description: '儒雅斯文，娓娓道来', gender: 'male', category: '视频配音' },
  // 角色扮演
  { id: 'keainvsheng', name: '可爱女生', speaker: 'saturn_zh_female_keainvsheng_tob', description: '甜美可爱，元气满满', gender: 'female', category: '角色扮演' },
  { id: 'tiaopigongzhu', name: '调皮公主', speaker: 'saturn_zh_female_tiaopigongzhu_tob', description: '古灵精怪，俏皮活泼', gender: 'female', category: '角色扮演' },
  { id: 'shuanglangshaonian', name: '爽朗少年', speaker: 'saturn_zh_male_shuanglangshaonian_tob', description: '阳光爽朗，青春活力', gender: 'male', category: '角色扮演' },
  { id: 'tiancaitongzhuo', name: '天才同桌', speaker: 'saturn_zh_male_tiancaitongzhuo_tob', description: '聪明机智，学习伙伴', gender: 'male', category: '角色扮演' },
  { id: 'cancan', name: '灿灿', speaker: 'saturn_zh_female_cancan_tob', description: '知性大方，温柔坚定', gender: 'female', category: '角色扮演' },
];

const DEFAULT_SETTINGS: VoiceSettings = {
  speaker: 'zh_male_m191_uranus_bigtts',
  speechRate: 5,
  loudnessRate: 0,
  pitchRate: 0,
  useDigitalHuman: true,
  customImage: '',
  silenceTimeout: 1.2,
  noiseSensitivity: 3,
  micGain: 1.0,
};

interface VoiceSettingsProps {
  settings: VoiceSettings;
  onSettingsChange: (settings: VoiceSettings) => void;
  teacherId?: string;
}

const VoiceSettingsComponent: React.FC<VoiceSettingsProps> = ({ 
  settings, 
  onSettingsChange,
  teacherId,
}) => {
  const [open, setOpen] = useState(false);
  const [localSettings, setLocalSettings] = useState<VoiceSettings>(() => ({
    ...DEFAULT_SETTINGS,
    ...(settings || {}),
  }));
  // 标记：是否已通过"保存"按钮关闭
  const savedRef = useRef(false);
  // 试听状态
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  // 图片上传
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 同步外部设置到本地（仅当 Dialog 关闭时同步）
  useEffect(() => {
    if (!open && settings) {
      setLocalSettings(prev => ({ ...prev, ...settings }));
    }
  }, [open, settings]);

  // 组件卸载时停止试听
  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
    };
  }, []);

  const handleSettingChange = (key: keyof VoiceSettings, value: string | number | boolean) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const saveSettings = async () => {
    savedRef.current = true;
    
    // 保存到 localStorage（本地缓存）
    try {
      localStorage.setItem('voiceSettings', JSON.stringify(localSettings));
    } catch {
      // 忽略 localStorage 错误
    }
    
    // 如果是教师，保存到数据库
    if (teacherId) {
      try {
        const response = await fetch('/api/teacher', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update',
            teacherId,
            // 使用 metadata 存储完整的声音设置
            metadata: {
              voiceSettings: localSettings,
            },
            // 同时更新基本字段供快速访问
            voice_speaker: localSettings.speaker,
            voice_speed: localSettings.speechRate,
            voice_volume: localSettings.loudnessRate,
          }),
        });
        
        const data = await response.json();
        if (!data.success) {
          console.error('保存声音设置到数据库失败:', data.error);
        }
      } catch (err) {
        console.error('保存声音设置失败:', err);
      }
    }
    
    onSettingsChange(localSettings);
    setOpen(false);
  };

  const resetToDefaults = () => {
    setLocalSettings(DEFAULT_SETTINGS);
  };

  const getCurrentPreset = () => {
    return VOICE_PRESETS.find(p => p.speaker === localSettings.speaker) || VOICE_PRESETS[0];
  };

  // 试听当前声音
  const previewVoice = async () => {
    // 如果正在播放，停止
    if (previewPlaying && previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
      setPreviewPlaying(false);
      return;
    }

    setPreviewLoading(true);
    try {
      const response = await fetch('/api/audio/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: '你好，我是AI数字教师，有什么可以帮你的吗？',
          speaker: localSettings.speaker,
          speechRate: localSettings.speechRate,
          loudnessRate: localSettings.loudnessRate,
        }),
      });

      const data = await response.json();
      if (data.success && data.audioUri) {
        const audio = new Audio(data.audioUri);
        previewAudioRef.current = audio;
        setPreviewPlaying(true);
        
        audio.onended = () => {
          setPreviewPlaying(false);
          previewAudioRef.current = null;
        };
        audio.onerror = () => {
          setPreviewPlaying(false);
          previewAudioRef.current = null;
        };
        
        await audio.play();
      }
    } catch (err) {
      console.error('试听失败:', err);
    } finally {
      setPreviewLoading(false);
    }
  };

  // 上传图片到服务器
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件');
      return;
    }

    // 验证文件大小 (最大 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('图片大小不能超过 5MB');
      return;
    }

    if (!teacherId) {
      alert('无法获取教师ID，请重新登录');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('teacherId', teacherId);

      const response = await fetch('/api/teacher/avatar', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (data.success && data.avatar_url) {
        handleSettingChange('customImage', data.avatar_url);
      } else {
        alert(data.error || '上传失败');
      }
    } catch (err) {
      console.error('上传失败:', err);
      alert('上传失败，请重试');
    } finally {
      setUploading(false);
      // 重置 input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // 清除自定义图片
  const clearCustomImage = () => {
    handleSettingChange('customImage', '');
  };

  // 按分类分组
  const categories = ['通用', '有声书', '视频配音', '角色扮演'];
  const groupedPresets = categories.map(cat => ({
    category: cat,
    presets: VOICE_PRESETS.filter(p => p.category === cat),
  }));

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen) {
        // 停止试听
        if (previewAudioRef.current) {
          previewAudioRef.current.pause();
          previewAudioRef.current = null;
          setPreviewPlaying(false);
        }
        if (savedRef.current) {
          savedRef.current = false;
        } else {
          setLocalSettings({ ...DEFAULT_SETTINGS, ...(settings || {}) });
        }
      }
      setOpen(newOpen);
    }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary">
          <Settings className="w-5 h-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto bg-card border-border/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            声音与数字人设置
          </DialogTitle>
          <DialogDescription className="text-xs">
            配置教师的声音和头像
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="voice" className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="voice" className="flex items-center gap-2">
              <Mic className="w-4 h-4" />
              声音设置
            </TabsTrigger>
            <TabsTrigger value="avatar" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              数字人设置
            </TabsTrigger>
          </TabsList>

          <TabsContent value="voice" className="space-y-4 mt-4">
            <div className="space-y-4">
              {/* 声音选择 */}
              <div className="space-y-2">
                <Label>选择教师声音</Label>
                <Select
                  value={localSettings.speaker}
                  onValueChange={(value) => handleSettingChange('speaker', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择声音" />
                  </SelectTrigger>
                  <SelectContent>
                    {groupedPresets.map(group => (
                      <SelectGroup key={group.category}>
                        <SelectLabel>{group.category}</SelectLabel>
                        {group.presets.map((preset) => (
                          <SelectItem key={preset.id} value={preset.speaker}>
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${
                                preset.gender === 'female' ? 'bg-pink-400' : 'bg-blue-400'
                              }`} />
                              <span>{preset.name}</span>
                              <span className="text-xs text-muted-foreground">- {preset.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  {getCurrentPreset().description}
                </p>
              </div>

              {/* 试听按钮 */}
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={previewVoice}
                  disabled={previewLoading}
                  className="flex items-center gap-2"
                >
                  {previewPlaying ? (
                    <>
                      <Square className="w-3 h-3" />
                      停止试听
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3" />
                      {previewLoading ? '加载中...' : '试听声音'}
                    </>
                  )}
                </Button>
                <span className="text-xs text-muted-foreground">
                  用当前设置朗读一段示例文本
                </span>
              </div>

              {/* 语速 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4" />
                    语速
                  </Label>
                  <span className="text-sm text-muted-foreground">
                    {localSettings.speechRate > 0 ? `+${localSettings.speechRate}` : localSettings.speechRate}
                  </span>
                </div>
                <Slider
                  value={[localSettings.speechRate]}
                  min={-10}
                  max={10}
                  step={1}
                  onValueChange={([value]) => handleSettingChange('speechRate', value)}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>较慢</span>
                  <span>正常</span>
                  <span>较快</span>
                </div>
              </div>

              {/* 音量 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4" />
                    音量
                  </Label>
                  <span className="text-sm text-muted-foreground">
                    {localSettings.loudnessRate > 0 ? `+${localSettings.loudnessRate}` : localSettings.loudnessRate}
                  </span>
                </div>
                <Slider
                  value={[localSettings.loudnessRate]}
                  min={-10}
                  max={10}
                  step={1}
                  onValueChange={([value]) => handleSettingChange('loudnessRate', value)}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>较轻</span>
                  <span>正常</span>
                  <span>较响</span>
                </div>
              </div>

              {/* 分隔线 */}
              <div className="border-t border-border my-2" />

              {/* 语音检测设置 */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">语音检测设置</Label>
                <p className="text-xs text-muted-foreground">
                  调整麦克风接收灵敏度，环境嘈杂时降低增益
                </p>

                {/* 麦克风增益 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">麦克风增益</Label>
                    <span className="text-xs text-muted-foreground">
                      {((localSettings.micGain ?? 1.0) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <Slider
                    value={[(localSettings.micGain ?? 1.0) * 100]}
                    min={10}
                    max={100}
                    step={5}
                    onValueChange={([value]) => handleSettingChange('micGain', value / 100)}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>低（过滤安静声音）</span>
                    <span>高（接收所有声音）</span>
                  </div>
                </div>

                {/* 噪声灵敏度 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">噪声灵敏度</Label>
                    <span className="text-xs text-muted-foreground">
                      {localSettings.noiseSensitivity === 1 ? '强降噪' :
                       localSettings.noiseSensitivity === 2 ? '较强降噪' :
                       localSettings.noiseSensitivity === 3 ? '标准' :
                       localSettings.noiseSensitivity === 4 ? '较灵敏' : '最灵敏'}
                    </span>
                  </div>
                  <Slider
                    value={[localSettings.noiseSensitivity || 3]}
                    min={1}
                    max={5}
                    step={1}
                    onValueChange={([value]) => handleSettingChange('noiseSensitivity', value)}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>强降噪</span>
                    <span>标准</span>
                    <span>最灵敏</span>
                  </div>
                </div>

                {/* 静音超时 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">静音超时</Label>
                    <span className="text-xs text-muted-foreground">
                      {(localSettings.silenceTimeout || 1.2).toFixed(1)} 秒
                    </span>
                  </div>
                  <Slider
                    value={[localSettings.silenceTimeout || 1.2]}
                    min={0.5}
                    max={3}
                    step={0.1}
                    onValueChange={([value]) => handleSettingChange('silenceTimeout', value)}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0.5s</span>
                    <span>1.2s</span>
                    <span>3s</span>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="avatar" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>启用数字人</Label>
                  <p className="text-sm text-muted-foreground">
                    在通话时显示数字人形象
                  </p>
                </div>
                <Switch
                  checked={localSettings.useDigitalHuman}
                  onCheckedChange={(checked) => handleSettingChange('useDigitalHuman', checked)}
                />
              </div>

              {localSettings.useDigitalHuman && (
                <div className="space-y-6">
                  {/* 上传图片 */}
                  <div className="space-y-3">
                    <Label>自定义头像图片</Label>
                    
                    {/* 隐藏的文件输入 */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    
                    {/* 预览区域 */}
                    {localSettings.customImage ? (
                      <div className="flex flex-col items-center gap-3">
                        <Card className="p-4 relative group">
                          <div className="w-40 h-40 rounded-2xl overflow-hidden border border-border/30">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={localSettings.customImage}
                              alt="预览"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          </div>
                          {/* 删除按钮 */}
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute -top-2 -right-2 w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={clearCustomImage}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </Card>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                          className="flex items-center gap-2"
                        >
                          <Upload className="w-4 h-4" />
                          {uploading ? '上传中...' : '更换图片'}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <Card 
                          className="p-4 sm:p-8 w-28 h-28 sm:w-40 sm:h-40 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors border-dashed border-2"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                          <span className="text-xs text-muted-foreground text-center">
                            点击上传<br />头像图片
                          </span>
                        </Card>
                        <p className="text-xs text-muted-foreground">
                          支持 JPG、PNG 格式，建议正方形图片，最大 5MB
                        </p>
                      </div>
                    )}
                    
                    {/* URL 输入（备选） */}
                    <div className="space-y-2 pt-2">
                      <Label className="text-xs text-muted-foreground">或输入图片 URL</Label>
                      <Input
                        type="url"
                        placeholder="https://example.com/avatar.jpg"
                        value={localSettings.customImage || ''}
                        onChange={(e) => handleSettingChange('customImage', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="bg-muted/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-sm text-foreground/60">
                      <Palette className="w-4 h-4" />
                      <span>数字人特性</span>
                    </div>
                    <ul className="mt-2 text-sm text-muted-foreground space-y-1">
                      <li>• 声波波纹动画（随语音播放脉动）</li>
                      <li>• 自然眨眼动画</li>
                      <li>• 状态指示器（聆听/说话/思考）</li>
                    </ul>
                    <p className="mt-2 text-xs text-muted-foreground">
                      上传真人照片后，说话时会在照片周围显示声波波纹效果。
                    </p>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-between mt-4 pt-4 border-t">
          <Button variant="ghost" onClick={resetToDefaults}>
            恢复默认
          </Button>
          <Button onClick={saveSettings}>
            保存设置
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VoiceSettingsComponent;
export type { VoiceSettings };
export { DEFAULT_SETTINGS };
