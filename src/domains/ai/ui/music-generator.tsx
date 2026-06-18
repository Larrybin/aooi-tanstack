'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildAIGenerationControllerMessages,
  buildAIGenerationSelectState,
  createMusicGenerationTaskAdapter,
  type GeneratedSong,
} from '@/domains/ai/ui/media-generation';
import { useAiGenerationController } from '@/domains/ai/ui/use-ai-generation-controller';
import {
  CheckCircle,
  Clock,
  CreditCard,
  Download,
  Loader2,
  Music,
  Pause,
  Play,
  User,
} from 'lucide-react';
import { toast } from 'sonner';

import { AIMediaType } from '@/extensions/ai';
import { createAiTranslator, type AiUiMessages } from './i18n';
import { AppImage } from '@/shared/blocks/common/app-image';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Progress } from '@/shared/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Switch } from '@/shared/components/ui/switch';
import { Textarea } from '@/shared/components/ui/textarea';
import { useBlobDownload } from '@/shared/hooks/use-blob-download';
import { cn } from '@/shared/lib/utils';

interface SongGeneratorProps {
  locale: string;
  messages: AiUiMessages;
  srOnlyTitle?: string;
  className?: string;
}

export function MusicGenerator({
  locale,
  messages,
  className,
  srOnlyTitle,
}: SongGeneratorProps) {
  const t = useMemo(() => createAiTranslator(messages), [messages]);

  // Form state
  const [customMode, setCustomMode] = useState(false);
  const [title, setTitle] = useState('');
  const [style, setStyle] = useState('');
  const [instrumental, setInstrumental] = useState(false);
  const [lyrics, setLyrics] = useState('');
  const [prompt, setPrompt] = useState('');

  const [generatedSongs, setGeneratedSongs] = useState<GeneratedSong[]>([]);
  const [currentPlayingSong, setCurrentPlayingSong] =
    useState<GeneratedSong | null>(null);

  // Audio playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { downloadBlob } = useBlobDownload();

  useEffect(() => {
    return () => {
      const audio = audioRef.current;
      if (!audio) return;

      audio.pause();
      audio.onended = null;
      audio.onerror = null;
      audio.src = '';
      audio.load();

      audioRef.current = null;
    };
  }, []);

  const songTaskAdapter = useMemo(
    () =>
      createMusicGenerationTaskAdapter({
        clearGeneratedSongs: () => {
          setGeneratedSongs([]);
          setCurrentPlayingSong(null);
        },
        setGeneratedSongs,
        formatFailedReason: (reason) =>
          t('generator.errors.generate_failed_with_reason', { reason }),
        unknownErrorMessage: t('generator.errors.unknown_error'),
      }),
    [t]
  );

  const controllerMessages = useMemo(
    () =>
      buildAIGenerationControllerMessages({
        invalidProviderOrModel: t('generator.errors.invalid_provider_or_model'),
        insufficientCredits: t('generator.errors.insufficient_credits'),
        createTaskFailed: t('generator.errors.create_task_failed'),
        queryTaskFailed: t('generator.errors.query_task_failed'),
        timeout: t('generator.errors.timeout'),
        unknownError: t('generator.errors.unknown_error'),
        createTaskFailedWithReason: (reason) =>
          t('generator.errors.generate_failed_with_reason', { reason }),
        queryTaskFailedWithReason: (reason) =>
          t('generator.errors.create_song_failed_with_reason', { reason }),
      }),
    [t]
  );

  const {
    details,
    remainingCredits,
    costCredits,
    capabilities,
    scene,
    provider,
    model,
    setProvider,
    setModel,
    selectedCapability,
    isLoadingCapabilities,
    isLoadingDetails,
    accountErrorMessage,
    capabilityErrorMessage,
    isGenerating,
    progress,
    run,
  } = useAiGenerationController<{
    prompt?: string;
    options: {
      customMode: boolean;
      style?: string;
      title?: string;
      instrumental?: boolean;
      lyrics?: string;
    };
  }>({
    locale,
    mediaType: AIMediaType.MUSIC,
    buildRequestBody: ({ formState, capability }) => ({
      mediaType: AIMediaType.MUSIC,
      scene: capability.scene,
      provider: capability.provider,
      model: capability.model,
      prompt: formState.prompt,
      options: formState.options,
    }),
    adapter: songTaskAdapter,
    messages: controllerMessages,
  });

  const { providerOptions, modelOptions } = useMemo(
    () => buildAIGenerationSelectState(capabilities, scene, provider),
    [capabilities, provider, scene]
  );

  const effectiveCapabilityErrorMessage =
    capabilityErrorMessage ||
    (!isLoadingCapabilities && capabilities.length === 0
      ? t('generator.errors.invalid_provider_or_model')
      : null);

  const handleGenerate = async () => {
    if (customMode) {
      if (!title || !style) {
        toast.error(t('generator.errors.title_and_style_required'));
        return;
      }
      if (!instrumental && !lyrics) {
        toast.error(t('generator.errors.lyrics_required'));
        return;
      }
    } else {
      if (!prompt) {
        toast.error(t('generator.errors.prompt_required'));
        return;
      }
    }

    let nextPrompt: string | undefined;
    const options: {
      customMode: boolean;
      style?: string;
      title?: string;
      instrumental?: boolean;
      lyrics?: string;
    } = {
      customMode,
      instrumental,
    };

    if (customMode) {
      options.style = style;
      options.title = title;
      if (!instrumental) {
        options.lyrics = lyrics;
      }
    } else {
      nextPrompt = prompt;
    }

    await run({
      prompt: nextPrompt,
      options,
    });
  };

  const togglePlay = async (song: GeneratedSong) => {
    if (!song?.audioUrl) return;

    setIsLoadingAudio(true);

    try {
      const previousAudio = audioRef.current;
      if (previousAudio) {
        previousAudio.pause();
        previousAudio.onended = null;
        previousAudio.onerror = null;
        previousAudio.src = '';
        previousAudio.load();
        audioRef.current = null;
      }

      // If clicking on currently playing song, just pause
      if (currentPlayingSong?.id === song.id && isPlaying) {
        setIsPlaying(false);
        setCurrentPlayingSong(null);
        setIsLoadingAudio(false);
        return;
      }

      // Create new audio for the selected song
      const audio = new Audio(song.audioUrl);
      audio.onended = () => {
        setIsPlaying(false);
        setCurrentPlayingSong(null);
      };
      audio.onerror = (event) => {
        console.error('Audio playback error:', event);
        setIsLoadingAudio(false);
        setIsPlaying(false);
        setCurrentPlayingSong(null);
      };
      audioRef.current = audio;

      // Play the selected song
      await audio.play();
      setIsPlaying(true);
      setCurrentPlayingSong(song);
      setIsLoadingAudio(false);
    } catch (error) {
      console.error('Failed to play audio:', error);
      setIsLoadingAudio(false);
      setIsPlaying(false);
      setCurrentPlayingSong(null);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const downloadAudio = async (song: GeneratedSong) => {
    if (!song?.audioUrl) return;

    await downloadBlob({
      id: song.id || song.title,
      url: song.audioUrl,
      fileName: `${song.title}.mp3`,
      successMessage: t('generator.download_success'),
      errorMessage: t('generator.download_failed'),
    });
  };

  return (
    <section id="create" className={cn('py-16 md:py-24', className)}>
      {srOnlyTitle && <h2 className="sr-only">{srOnlyTitle}</h2>}
      <div className="container">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            {/* Left side - Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {t('generator.title')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={customMode}
                      onCheckedChange={setCustomMode}
                    />
                    <Label>{t('generator.form.custom_mode')}</Label>
                  </div>
                  <div className="flex-1"></div>
                  <div className="flex items-center gap-4">
                    <Label>{t('generator.form.provider')}</Label>
                    <Select value={provider} onValueChange={setProvider}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {providerOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Label>{t('generator.form.model')}</Label>
                    <Select value={model} onValueChange={setModel}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {modelOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>

              <CardContent className="space-y-6">
                {customMode && (
                  <div className="space-y-2">
                    <Label htmlFor="title">{t('generator.form.title')}</Label>
                    <Input
                      id="title"
                      placeholder={t('generator.form.title_placeholder')}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                )}

                {customMode && (
                  <div className="space-y-2">
                    <Label htmlFor="style">{t('generator.form.style')}</Label>
                    <Textarea
                      id="style"
                      placeholder={t('generator.form.style_placeholder')}
                      value={style}
                      onChange={(e) => setStyle(e.target.value)}
                      className="min-h-24"
                    />
                    <div className="text-muted-foreground text-right text-sm">
                      {style.length}/1000
                    </div>
                  </div>
                )}

                {!customMode && (
                  <div className="space-y-2">
                    <Label htmlFor="prompt">{t('generator.form.prompt')}</Label>
                    <Textarea
                      id="prompt"
                      placeholder={t('generator.form.prompt_placeholder')}
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      className="min-h-32"
                      required
                    />
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <Switch
                    id="instrumental"
                    checked={instrumental}
                    onCheckedChange={setInstrumental}
                  />
                  <Label htmlFor="instrumental">
                    {t('generator.form.instrumental')}
                  </Label>
                </div>

                {customMode && !instrumental && (
                  <div className="space-y-2">
                    <Label htmlFor="lyrics">{t('generator.form.lyrics')}</Label>
                    <Textarea
                      id="lyrics"
                      placeholder={t('generator.form.lyrics_placeholder')}
                      value={lyrics}
                      onChange={(e) => setLyrics(e.target.value)}
                      className="min-h-32"
                    />
                  </div>
                )}

                {((isLoadingDetails && !details && !isGenerating) ||
                  isLoadingCapabilities) &&
                !effectiveCapabilityErrorMessage ? (
                  <Button className="w-full" size="lg">
                    <Loader2 className="size-4 animate-spin" />{' '}
                    {t('generator.loading')}
                  </Button>
                ) : (
                  <Button
                    onClick={handleGenerate}
                    disabled={
                      isGenerating ||
                      !selectedCapability ||
                      isLoadingCapabilities
                    }
                    className="w-full"
                    size="lg"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('generator.generating')}
                      </>
                    ) : (
                      <>
                        <Music className="mr-2 h-4 w-4" />
                        {t('generator.generate')}
                      </>
                    )}
                  </Button>
                )}

                {accountErrorMessage ? (
                  <div className="border-destructive/30 mb-6 space-y-2 rounded-lg border p-4 text-sm">
                    <p className="text-destructive">{accountErrorMessage}</p>
                    <p className="text-muted-foreground">
                      {t('generator.loading')}
                    </p>
                  </div>
                ) : effectiveCapabilityErrorMessage ? (
                  <div className="border-destructive/30 mb-6 space-y-2 rounded-lg border p-4 text-sm">
                    <p className="text-destructive">
                      {effectiveCapabilityErrorMessage}
                    </p>
                    <p className="text-muted-foreground">
                      {t('generator.loading')}
                    </p>
                  </div>
                ) : remainingCredits > 0 ? (
                  <div className="mb-6 flex items-center justify-between text-sm">
                    <span className="text-primary">
                      {t('generator.credits_cost', { credits: costCredits })}
                    </span>
                    <span className="text-foreground font-medium">
                      {t('generator.credits_remaining', {
                        credits: remainingCredits,
                      })}
                    </span>
                  </div>
                ) : details ? (
                  <div className="mb-6 flex items-center justify-between text-sm">
                    <span className="text-primary">
                      {t('generator.credits_cost', { credits: costCredits })},{' '}
                      {t('generator.credits_remaining', {
                        credits: remainingCredits,
                      })}
                    </span>
                    <a href="/pricing">
                      <Button className="w-full" size="lg" variant="outline">
                        <CreditCard className="size-4" />{' '}
                        {t('generator.buy_credits')}
                      </Button>
                    </a>
                  </div>
                ) : (
                  <div className="mb-6 flex items-center justify-between text-sm">
                    <span className="text-primary">
                      {t('generator.credits_cost', { credits: costCredits })}
                    </span>
                    <a href="/pricing">
                      <Button size="sm" variant="outline">
                        {t('generator.buy_credits')}
                      </Button>
                    </a>
                  </div>
                )}

                {isGenerating && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>{t('generator.generation_progress')}</span>
                      <span>{progress}%</span>
                    </div>
                    <Progress value={progress} className="w-full" />
                    <p className="text-muted-foreground text-center text-sm">
                      {t('generator.time_cost')}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Right side - Generated Song Display */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Music className="h-5 w-5" />
                  {t('generator.generated_song')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {generatedSongs.length > 0 ? (
                  <div className="space-y-4">
                    {generatedSongs.map((song, index) => {
                      const isCurrentlyPlaying =
                        currentPlayingSong?.id === song.id && isPlaying;
                      const isCurrentlyLoading =
                        currentPlayingSong?.id === song.id && isLoadingAudio;

                      return (
                        <div key={song.id} className="space-y-4">
                          <div className="flex gap-4">
                            <div className="relative flex-shrink-0">
                              <div className="bg-muted relative h-20 w-20 overflow-hidden rounded-lg">
                                {song.imageUrl ? (
                                  <AppImage
                                    src={song.imageUrl}
                                    alt={song.title}
                                    fill
                                    sizes="80px"
                                    className="object-cover"
                                  />
                                ) : (
                                  <div className="from-primary/20 to-accent/20 flex h-full w-full items-center justify-center bg-gradient-to-br">
                                    <Music className="text-muted-foreground h-6 w-6" />
                                  </div>
                                )}
                              </div>
                              {song.audioUrl && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="absolute top-6 right-6 h-8 w-8 rounded-full p-0 shadow-lg"
                                  onClick={() => togglePlay(song)}
                                  disabled={isCurrentlyLoading}
                                >
                                  {isCurrentlyLoading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : isCurrentlyPlaying ? (
                                    <Pause className="h-3 w-3" />
                                  ) : (
                                    <Play className="h-3 w-3" />
                                  )}
                                </Button>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <h3 className="text-foreground mb-1 text-lg font-semibold">
                                {song.title}
                              </h3>
                              <div className="text-muted-foreground mb-2 flex items-center gap-2 text-sm">
                                <User className="h-4 w-4" />
                                <span>{song.artist}</span>
                                <Clock className="ml-2 h-4 w-4" />
                                <span>{formatDuration(song.duration)}</span>
                              </div>
                              <div className="mb-2 line-clamp-1 flex flex-wrap gap-1">
                                {song.style &&
                                  song.style
                                    .split(',')
                                    .slice(0, 2)
                                    .map((tag, tagIndex) => (
                                      <Badge
                                        key={tagIndex}
                                        variant="default"
                                        className="text-xs"
                                      >
                                        {tag.trim()}
                                      </Badge>
                                    ))}
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                {song.audioUrl ? (
                                  <div className="flex items-center gap-2 text-green-600">
                                    <CheckCircle className="h-4 w-4" />
                                    <span>{t('generator.ready_to_play')}</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 text-yellow-600">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span>
                                      {t('generator.audio_generating')}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-col gap-2">
                              {song.audioUrl && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => downloadAudio(song)}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                          {index < generatedSongs.length - 1 && (
                            <div className="border-t" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="bg-muted mb-4 flex h-16 w-16 items-center justify-center rounded-full">
                      <Music className="text-muted-foreground h-8 w-8" />
                    </div>
                    <p className="text-muted-foreground mb-2">
                      {isGenerating
                        ? t('generator.generating_song')
                        : t('generator.no_song_generated')}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
