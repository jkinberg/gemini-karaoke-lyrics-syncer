import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import JSZip from 'jszip';
import {
  generateKaraokeData,
  generateVocabularyList,
  translateLyrics,
  refineKaraokeData,
} from './services/geminiService';
import { KaraokeApiResponse, KaraokeData, KaraokeSegment, KaraokeWord, VocabularyItem } from './types';
import { testCase } from './test-data';

// --- Helper Functions & Components ---

const Icon: React.FC<{ path: string; className?: string }> = ({ path, className = 'w-6 h-6' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d={path} />
  </svg>
);

const FileUploader: React.FC<{ onFileSelect: (file: File) => void; selectedFile: File | null }> = ({ onFileSelect, selectedFile }) => {
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };
    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };
    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            onFileSelect(e.dataTransfer.files[0]);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            onFileSelect(e.target.files[0]);
        }
    };
    
    const triggerFileSelect = () => fileInputRef.current?.click();

    return (
        <div 
          className={`relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl transition-all duration-300
            ${isDragging ? 'border-secondary bg-secondary/20' : 'border-white/20 hover:border-secondary/50'}
            ${selectedFile ? 'border-secondary bg-secondary/10' : ''}`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={triggerFileSelect}
        >
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="audio/*" className="hidden" />
          <div className="text-center cursor-pointer">
            <Icon path="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" className="w-10 h-10 mx-auto text-white/50 mb-2" />
            {selectedFile ? (
                <div>
                    <p className="font-semibold text-textPrimary">{selectedFile.name}</p>
                    <p className="text-sm text-textSecondary">{Math.round(selectedFile.size / 1024 / 1024 * 100) / 100} MB</p>
                </div>
            ) : (
                <p className="text-textSecondary">
                  <span className="font-semibold text-secondary">Click to upload</span> or drag and drop an audio file
                </p>
            )}
          </div>
        </div>
    );
};

const LyricEditor: React.FC<{ value: string; onChange: (value: string) => void; placeholder: string; lang: string }> = ({ value, onChange, placeholder, lang }) => {
    const renderHighlightedText = () => {
        const parts = value.split(/(\[.*?\]|\(.*?\))/g);
        return parts.map((part, index) => {
            if (part.match(/^(\[.*?\]|\(.*?\))$/)) {
                return <span key={index} className="text-secondary/80 font-semibold">{part}</span>;
            }
            return part;
        });
    };

    return (
        <div className="relative">
            <label className="block text-sm font-medium text-textSecondary mb-1">{lang} Lyrics</label>
            <div className="relative">
                <textarea
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="w-full h-64 p-3 bg-black/20 text-textPrimary rounded-lg border border-white/20 focus:ring-2 focus:ring-secondary focus:border-secondary resize-none font-mono text-sm leading-6"
                />
                <div 
                  aria-hidden="true" 
                  className="absolute inset-0 w-full h-64 p-3 bg-transparent text-transparent rounded-lg border border-transparent pointer-events-none overflow-auto font-mono text-sm leading-6 whitespace-pre-wrap"
                >
                    {renderHighlightedText()}
                </div>
            </div>
        </div>
    );
};


const App: React.FC = () => {
    // Inputs
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [spanishLyrics, setSpanishLyrics] = useState<string>('');
    const [englishLyrics, setEnglishLyrics] = useState<string>('');
    const [languageFlow, setLanguageFlow] = useState<'es-en' | 'en-es'>('es-en');

    // UI State
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isTranslating, setIsTranslating] = useState<boolean>(false);
    const [statusMessage, setStatusMessage] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [buildTimestamp, setBuildTimestamp] = useState<string>('Loading...');

    // Results
    const [karaokeData, setKaraokeData] = useState<KaraokeApiResponse | null>(null);
    const [vocabularyList, setVocabularyList] = useState<VocabularyItem[] | null>(null);
    const [activeTab, setActiveTab] = useState<'preview' | 'data' | 'vocab'>('preview');

    useEffect(() => {
      // Fetch build timestamp on mount
      fetch('/App.tsx', { method: 'HEAD' })
        .then(response => {
          const lastModified = response.headers.get('Last-Modified');
          if (lastModified) {
            setBuildTimestamp(new Date(lastModified).toLocaleString());
          } else {
            setBuildTimestamp('N/A');
          }
        })
        .catch(() => setBuildTimestamp('N/A'));
    }, []);

    const clearAll = () => {
        setAudioFile(null);
        setSpanishLyrics('');
        setEnglishLyrics('');
        setKaraokeData(null);
        setVocabularyList(null);
        setError(null);
        setStatusMessage('');
        setIsLoading(false);
        setProgress(0);
    };

    const handleTranslate = async () => {
        const isEsToEn = languageFlow === 'es-en';
        const sourceText = isEsToEn ? spanishLyrics : englishLyrics;
        if (!sourceText) {
            setError(`Please enter the ${isEsToEn ? 'Spanish' : 'English'} lyrics first.`);
            return;
        }
        setIsTranslating(true);
        setError(null);
        try {
            const translated = await translateLyrics(
                sourceText,
                isEsToEn ? 'es' : 'en',
                isEsToEn ? 'en' : 'es'
            );
            if (isEsToEn) {
                setEnglishLyrics(translated);
            } else {
                setSpanishLyrics(translated);
            }
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsTranslating(false);
        }
    };
    
    const handleGenerate = async () => {
        if (!audioFile) {
            setError("Please provide an audio file.");
            return;
        }
        if (!spanishLyrics || !englishLyrics) {
            setError("Please provide both Spanish and English lyrics.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setKaraokeData(null);
        setVocabularyList(null);
        setProgress(0);

        // Simulate progress
        const interval = setInterval(() => {
          setProgress(prev => {
            if (prev >= 95) return 95;
            return prev + 1;
          });
        }, 400);

        try {
            const onStatusUpdate = (message: string) => {
                setStatusMessage(message);
                if (message.includes('Step 1/2')) setProgress(p => Math.max(p, 10));
                if (message.includes('Analyzing')) setProgress(p => Math.max(p, 25));
                if (message.includes('Step 2/2')) setProgress(p => Math.max(p, 80));
                if (message.includes('Success')) setProgress(100);
            };

            const originalLyrics = languageFlow === 'es-en' ? spanishLyrics : englishLyrics;
            const translatedLyrics = languageFlow === 'es-en' ? englishLyrics : spanishLyrics;

            const result = await generateKaraokeData(audioFile, originalLyrics, translatedLyrics, languageFlow, onStatusUpdate);
            setKaraokeData(result);
            setActiveTab('preview');
            
            onStatusUpdate('Generating vocabulary list...');
            setProgress(90);
            const spanishTextForVocab = result.spanish.segments.filter(s => s.type === 'LYRIC' && s.text).map(s => s.text).join('\n');
            const englishTextForVocab = result.english.segments.filter(s => s.type === 'LYRIC' && s.text).map(s => s.text).join('\n');
            const vocab = await generateVocabularyList(spanishTextForVocab, englishTextForVocab);
            setVocabularyList(vocab);

            setStatusMessage('Process complete!');
            setProgress(100);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            clearInterval(interval);
            setIsLoading(false);
        }
    };
    
    const runDiagnosticTest = () => {
      const { lyrics, karaokeData: testKaraokeData } = testCase;
      setSpanishLyrics(lyrics.spanish);
      setEnglishLyrics(lyrics.english);
      setKaraokeData(testKaraokeData as unknown as KaraokeApiResponse);
      setVocabularyList(null);
      setError(null);
      
      // Generate a silent audio file to make the player work
      const audioContext = new AudioContext();
      const durationInSeconds = testKaraokeData.spanish.metadata.durationMs / 1000;
      const sampleRate = audioContext.sampleRate;
      const frameCount = sampleRate * durationInSeconds;
      const buffer = audioContext.createBuffer(1, frameCount, sampleRate);
      const blob = new Blob([new Uint8Array(buffer.getChannelData(0).buffer)], { type: 'audio/wav' });
      const silentFile = new File([blob], "silent_test_audio.wav", { type: "audio/wav" });
      setAudioFile(silentFile);
      
      setStatusMessage("Diagnostic test loaded. The preview player is now active with known-good data.");
      setActiveTab('preview');
    };

    const isGenerateDisabled = isLoading || !audioFile || !spanishLyrics || !englishLyrics;

    return (
        <div className="min-h-screen flex flex-col items-center justify-start p-4 sm:p-6 md:p-8 space-y-8">
            <Header />

            <GlassPanel className="w-full max-w-5xl">
                {!karaokeData && (
                    <div className="p-8 space-y-8">
                        <FileUploader onFileSelect={setAudioFile} selectedFile={audioFile} />
                        {audioFile && (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                                    <div>
                                        <label className="block text-sm font-medium text-textSecondary mb-1">Original Language Flow</label>
                                        <select value={languageFlow} onChange={(e) => setLanguageFlow(e.target.value as 'es-en' | 'en-es')} className="w-full p-3 bg-black/20 text-textPrimary rounded-lg border border-white/20 focus:ring-2 focus:ring-secondary focus:border-secondary">
                                            <option value="es-en">Spanish → English</option>
                                            <option value="en-es">English → Spanish</option>
                                        </select>
                                    </div>
                                    <ActionButton onClick={handleTranslate} disabled={isTranslating} icon="M13.5 16.875h3.375m0 0h3.375m-3.375 0V13.5m0 3.375v3.375M6 10.5h2.25a2.25 2.25 0 002.25-2.25V6a2.25 2.25 0 00-2.25-2.25H6A2.25 2.25 0 003.75 6v2.25A2.25 2.25 0 006 10.5zm0 9.75h2.25A2.25 2.25 0 0010.5 18v-2.25a2.25 2.25 0 00-2.25-2.25H6a2.25 2.25 0 00-2.25 2.25V18A2.25 2.25 0 006 20.25zm9.75-9.75H18a2.25 2.25 0 002.25-2.25V6A2.25 2.25 0 0018 3.75h-2.25A2.25 2.25 0 0013.5 6v2.25a2.25 2.25 0 002.25 2.25z">
                                        {isTranslating ? 'Translating...' : `Translate to ${languageFlow === 'es-en' ? 'English' : 'Spanish'}`}
                                    </ActionButton>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <LyricEditor value={spanishLyrics} onChange={setSpanishLyrics} placeholder="[Intro]..." lang="Spanish" />
                                    <LyricEditor value={englishLyrics} onChange={setEnglishLyrics} placeholder="[Intro]..." lang="English" />
                                </div>
                            </>
                        )}
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                           <ActionButton
                              onClick={handleGenerate}
                              disabled={isGenerateDisabled}
                              className={`w-full sm:w-auto px-12 py-4 text-lg font-bold ${isGenerateDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
                              icon="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.898 20.562L16.25 22.5l-.648-1.938a3.375 3.375 0 00-2.456-2.456L11.25 18l1.938-.648a3.375 3.375 0 002.456-2.456L16.25 13l.648 1.938a3.375 3.375 0 002.456 2.456L21 18l-1.938.648a3.375 3.375 0 00-2.456 2.456z">
                                {isLoading ? 'Generating...' : 'Generate Synced Files'}
                            </ActionButton>
                            <button onClick={clearAll} className="text-textSecondary hover:text-textPrimary transition">Clear All</button>
                        </div>
                    </div>
                )}

                {isLoading && <ProgressBar progress={progress} statusMessage={statusMessage} />}
                {error && <ErrorMessage message={error} />}

                {karaokeData && !isLoading && (
                    <div className="p-4 sm:p-8">
                        <TabNav activeTab={activeTab} setActiveTab={setActiveTab} hasVocab={!!vocabularyList} />
                        <div className="mt-6">
                            {activeTab === 'preview' && audioFile && <KaraokePreview karaokeData={karaokeData} audioFile={audioFile} />}
                            {activeTab === 'data' && <KaraokeDataDisplay karaokeData={karaokeData} setKaraokeData={setKaraokeData} audioFile={audioFile}/>}
                            {activeTab === 'vocab' && vocabularyList && <VocabularyDisplay vocabularyList={vocabularyList} />}
                        </div>
                         <div className="text-center mt-8">
                            <button onClick={clearAll} className="bg-white/10 text-textSecondary px-6 py-2 rounded-lg hover:bg-white/20 transition">Start Over</button>
                         </div>
                    </div>
                )}
            </GlassPanel>

            <Footer buildTimestamp={buildTimestamp} onRunTest={runDiagnosticTest} />
        </div>
    );
};


// --- UI Components ---

const GlassPanel: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className }) => (
    <div className={`bg-black/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden ${className}`}>
        {children}
    </div>
);

const Header: React.FC = () => (
    <header className="text-center max-w-3xl">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-300 to-secondary">
            Karaoke Syncer AI
        </h1>
        <p className="mt-4 text-lg text-textSecondary">
            Upload an audio file and provide lyrics to generate perfectly synchronized, timed karaoke files using AI.
        </p>
    </header>
);

const ActionButton: React.FC<{ onClick: () => void; disabled?: boolean; children: React.ReactNode; className?: string, icon?: string }> = ({ onClick, disabled, children, className, icon }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`flex items-center justify-center gap-2 px-6 py-3 bg-secondary text-background font-semibold rounded-lg shadow-lg transition-all duration-300 transform 
            ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-500' : 'hover:bg-green-400 hover:shadow-green-500/50 hover:-translate-y-1'}
            ${className}`}
    >
        {icon && <Icon path={icon} className="w-5 h-5" />}
        {children}
    </button>
);

const ProgressBar: React.FC<{ progress: number; statusMessage: string }> = ({ progress, statusMessage }) => (
    <div className="px-8 pb-8 text-center">
        <p className="text-textSecondary mb-2">{statusMessage}</p>
        <div className="w-full bg-black/30 rounded-full h-2.5">
            <div className="bg-secondary h-2.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
        </div>
    </div>
);

const ErrorMessage: React.FC<{ message: string }> = ({ message }) => (
    <div className="m-8 p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200">
        <p className="font-bold">An Error Occurred</p>
        <p>{message}</p>
    </div>
);

const TabNav: React.FC<{ activeTab: string, setActiveTab: (tab: any) => void, hasVocab: boolean }> = ({ activeTab, setActiveTab, hasVocab }) => {
    const tabs = [{ id: 'preview', label: 'Preview' }, { id: 'data', label: 'Karaoke Data' }, { id: 'vocab', label: 'Vocabulary', disabled: !hasVocab }];
    return (
        <div className="border-b border-white/10 flex justify-center space-x-4 sm:space-x-8">
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    onClick={() => !tab.disabled && setActiveTab(tab.id)}
                    className={`px-4 py-2 text-sm sm:text-base font-medium transition-colors
                        ${activeTab === tab.id ? 'text-secondary border-b-2 border-secondary' : 'text-textSecondary hover:text-textPrimary'}
                        ${tab.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );
};

const KaraokePreview: React.FC<{ karaokeData: KaraokeApiResponse; audioFile: File }> = ({ karaokeData, audioFile }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    // FIX: Provide an initial value of null to useRef.
    const animationFrameRef = useRef<number | null>(null);

    // For Audio Visualizer
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);

    const audioUrl = useMemo(() => URL.createObjectURL(audioFile), [audioFile]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
    
        const setAudioData = () => {
            setDuration(audio.duration);
            setCurrentTime(audio.currentTime);
        };
    
        const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    
        audio.addEventListener("loadeddata", setAudioData);
        audio.addEventListener("timeupdate", handleTimeUpdate);
    
        // Cleanup
        return () => {
            audio.removeEventListener("loadeddata", setAudioData);
            audio.removeEventListener("timeupdate", handleTimeUpdate);
            URL.revokeObjectURL(audioUrl);
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [audioUrl]);

    const animate = useCallback(() => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
        }
        
        // --- Visualizer Drawing Logic ---
        if (analyserRef.current && canvasRef.current) {
            const analyser = analyserRef.current;
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            analyser.getByteFrequencyData(dataArray);

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            const barWidth = (canvas.width / bufferLength) * 2.5;
            let x = 0;
            
            const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
            gradient.addColorStop(0, '#10B981'); // secondary
            gradient.addColorStop(1, '#1E40AF'); // primary

            for (let i = 0; i < bufferLength; i++) {
                const barHeight = dataArray[i];
                
                ctx.fillStyle = gradient;
                ctx.fillRect(x, canvas.height - barHeight / 2, barWidth, barHeight / 2);
                
                x += barWidth + 1;
            }
        }
        
        animationFrameRef.current = requestAnimationFrame(animate);
    }, []);

    const setupAudioContext = () => {
        if (!audioContextRef.current && audioRef.current) {
            const context = new (window.AudioContext || (window as any).webkitAudioContext)();
            audioContextRef.current = context;
            
            const analyser = context.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.8;
            analyserRef.current = analyser;

            if (!sourceNodeRef.current) {
              const source = context.createMediaElementSource(audioRef.current);
              sourceNodeRef.current = source;
              source.connect(analyser);
              analyser.connect(context.destination);
            }
        }
    };
    
    const handlePlayPause = () => {
        setupAudioContext();
        
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume();
        }

        const audio = audioRef.current;
        if (!audio) return;
        if (isPlaying) {
            audio.pause();
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        } else {
            audio.play();
            animationFrameRef.current = requestAnimationFrame(animate);
        }
        setIsPlaying(!isPlaying);
    };
    
    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.currentTime = Number(e.target.value);
        setCurrentTime(audio.currentTime);
    };

    const formatTime = (time: number) => {
        if (isNaN(time) || time === 0) return '0:00';
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const handleSeekToTime = (timeMs: number) => {
      if (audioRef.current) {
        audioRef.current.currentTime = timeMs / 1000;
      }
    };

    return (
        <div className="bg-black/20 p-4 sm:p-6 rounded-lg space-y-4">
            <audio ref={audioRef} src={audioUrl} onEnded={() => setIsPlaying(false)} />
            
            {/* --- Audio Controls --- */}
            <div className="flex items-center gap-4">
                <button onClick={handlePlayPause} className="p-2 rounded-full bg-secondary text-background hover:scale-110 transition">
                    <Icon path={isPlaying ? "M15.75 5.25v13.5m-6.75-13.5v13.5" : "M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"} className="w-6 h-6" />
                </button>
                <span className="text-sm font-mono">{formatTime(currentTime)}</span>
                <input
                    type="range"
                    min="0"
                    max={duration || 0}
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full h-2 bg-black/50 rounded-lg appearance-none cursor-pointer accent-secondary"
                />
                <span className="text-sm font-mono">{formatTime(duration)}</span>
            </div>
            
            {/* --- Audio Visualizer Canvas --- */}
            <canvas ref={canvasRef} width="1000" height="100" className="w-full h-[100px] rounded-md"></canvas>

            {/* --- Lyric Panels --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <LyricPanel
                    title="Spanish"
                    segments={karaokeData.spanish.segments}
                    currentTime={currentTime * 1000}
                    onSeek={handleSeekToTime}
                />
                <LyricPanel
                    title="English"
                    segments={karaokeData.english.segments}
                    currentTime={currentTime * 1000}
                    onSeek={handleSeekToTime}
                />
            </div>
        </div>
    );
};

interface LyricPanelProps {
    title: string;
    segments: KaraokeSegment[];
    currentTime: number;
    onSeek: (timeMs: number) => void;
}

const LyricPanel: React.FC<LyricPanelProps> = ({ title, segments, currentTime, onSeek }) => {
    const activeSegmentIndex = segments.findIndex(seg => currentTime >= seg.startTimeMs && currentTime <= seg.endTimeMs);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (activeSegmentIndex === -1 || !scrollContainerRef.current) return;
        
        const activeElement = scrollContainerRef.current.children[activeSegmentIndex] as HTMLElement;
        if (!activeElement) return;

        // Manual scroll calculation for smoothness
        const container = scrollContainerRef.current;
        const containerHeight = container.offsetHeight;
        const elementTop = activeElement.offsetTop;
        const elementHeight = activeElement.offsetHeight;
        
        const desiredScrollTop = elementTop - (containerHeight / 2) + (elementHeight / 2);
        
        container.scrollTo({
            top: desiredScrollTop,
            behavior: 'smooth',
        });

    }, [activeSegmentIndex]);

    const normalizeWord = (word: string) => {
        return word.toLowerCase().replace(/[.,'¡!¿?]/g, '').replace(/-/g, ' ');
    };

    return (
        <div className="bg-black/30 p-4 rounded-lg">
            <h3 className="text-lg font-bold text-center mb-4">{title}</h3>
            <div ref={scrollContainerRef} className="h-48 overflow-y-auto space-y-4 text-center pr-2">
                {segments.map((segment, index) => {
                    const isActive = index === activeSegmentIndex;
                    if (segment.type === 'INSTRUMENTAL') {
                        return (
                            <p key={index} className={`italic transition-all duration-300 ${isActive ? 'text-secondary text-2xl font-bold' : 'text-textSecondary/70 text-lg'}`}>
                                {segment.cueText}
                            </p>
                        );
                    }

                    const wordsToHighlight = segment.words || [];
                    const renderedWords = segment.text?.split(/(\s+)/) || [];
                    let wordIndex = 0;

                    return (
                        <p key={index} onClick={() => onSeek(segment.startTimeMs)} className={`transition-all duration-300 cursor-pointer ${isActive ? 'text-textPrimary text-2xl font-bold' : 'text-textSecondary text-lg'}`}>
                           {renderedWords.map((part, partIndex) => {
                                if (/\s+/.test(part)) return <span key={partIndex}>{part}</span>;
                                if (!part) return null;

                                const currentWordData = wordsToHighlight[wordIndex];
                                wordIndex++;

                                if (!currentWordData || normalizeWord(part) !== normalizeWord(currentWordData.word)) {
                                    return <span key={partIndex}>{part}</span>;
                                }
                                
                                const isWordActive = isActive && currentTime >= currentWordData.startTimeMs && currentTime <= currentWordData.endTimeMs;
                                const isWordSung = isActive && currentTime > currentWordData.endTimeMs;

                                return (
                                    <span key={partIndex} className={`transition-colors duration-150 
                                      ${isWordActive ? 'text-secondary' : isWordSung ? 'text-white' : 'text-inherit'}`}>
                                      {part}
                                    </span>
                                );
                            })}
                        </p>
                    );
                })}
            </div>
        </div>
    );
};


const KaraokeDataDisplay: React.FC<{ karaokeData: KaraokeApiResponse, setKaraokeData: (data: KaraokeApiResponse) => void, audioFile: File | null }> = ({ karaokeData, setKaraokeData, audioFile }) => {
  const [isRefining, setIsRefining] = useState<{ spanish?: boolean, english?: boolean }>({});
  const [refineStatus, setRefineStatus] = useState<{ spanish?: string, english?: string }>({});

  const handleRefine = async (lang: 'spanish' | 'english') => {
    if (!audioFile) {
      alert("Audio file is missing.");
      return;
    }
    
    setIsRefining(prev => ({ ...prev, [lang]: true }));
    setRefineStatus(prev => ({ ...prev, [lang]: 'Starting refinement...' }));

    try {
      const dataToRefine = karaokeData[lang];
      const langName = lang === 'spanish' ? 'Spanish' : 'English';
      const refinedData = await refineKaraokeData(audioFile, dataToRefine, langName, (status) => {
        setRefineStatus(prev => ({ ...prev, [lang]: status }));
      });
      
      setKaraokeData({
        ...karaokeData,
        [lang]: refinedData
      });

    } catch (err) {
      alert(`Error during refinement: ${(err as Error).message}`);
    } finally {
      setIsRefining(prev => ({ ...prev, [lang]: false }));
      setRefineStatus(prev => ({ ...prev, [lang]: 'Refinement complete!' }));
    }
  };

  const JsonDisplay = ({ lang, data }: { lang: 'spanish' | 'english', data: KaraokeData }) => {
    const downloadJson = () => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${lang}_karaoke_data.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const copyJson = () => {
        navigator.clipboard.writeText(JSON.stringify(data, null, 2));
        alert(`${lang.charAt(0).toUpperCase() + lang.slice(1)} JSON copied to clipboard!`);
    };

    return (
        <div className="bg-black/30 p-4 rounded-lg flex-1">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-bold text-textPrimary">{lang === 'spanish' ? 'Spanish' : 'English'} Karaoke Data</h3>
                 <div className="flex items-center gap-2">
                    <ActionButton onClick={() => handleRefine(lang)} disabled={isRefining[lang]} className="px-3 py-1 text-sm">
                       {isRefining[lang] ? 'Refining...' : 'Refine with AI Review'}
                    </ActionButton>
                    <button onClick={copyJson} className="p-2 rounded-md hover:bg-white/20 transition"><Icon path="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.153 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM10.5 16.5h-1.5" className="w-5 h-5" /></button>
                    <button onClick={downloadJson} className="p-2 rounded-md hover:bg-white/20 transition"><Icon path="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" className="w-5 h-5" /></button>
                </div>
            </div>
            {isRefining[lang] && <p className="text-sm text-secondary mb-2">{refineStatus[lang]}</p>}
            <pre className="w-full text-xs bg-black/40 p-3 rounded-md h-96 overflow-auto text-slate-300">
                {JSON.stringify(data, null, 2)}
            </pre>
        </div>
    );
  };
  
  return (
      <div className="space-y-4 md:space-y-0 md:flex md:gap-6">
          <JsonDisplay lang="spanish" data={karaokeData.spanish} />
          <JsonDisplay lang="english" data={karaokeData.english} />
      </div>
  );
};


const VocabularyDisplay: React.FC<{ vocabularyList: VocabularyItem[] }> = ({ vocabularyList }) => {
    const downloadFile = (format: 'json' | 'csv') => {
        let dataStr: string;
        let fileName: string;
        let mimeType: string;

        if (format === 'json') {
            dataStr = JSON.stringify(vocabularyList, null, 2);
            fileName = 'vocabulary.json';
            mimeType = 'application/json';
        } else {
            const header = ['Spanish Term', 'English Term', 'Definition', 'Difficulty', 'Spanish Example', 'English Example'];
            const rows = vocabularyList.map(item =>
                [
                    item.term.spanish,
                    item.term.english,
                    `"${item.definition.replace(/"/g, '""')}"`,
                    item.difficulty,
                    `"${item.example.spanish.replace(/"/g, '""')}"`,
                    `"${item.example.english.replace(/"/g, '""')}"`
                ].join(',')
            );
            dataStr = [header.join(','), ...rows].join('\n');
            fileName = 'vocabulary.csv';
            mimeType = 'text/csv';
        }

        const blob = new Blob([dataStr], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };
    
     const highlightText = (text: string, highlight: string) => {
        if (!highlight) return text;
        const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
        return (
            <>
                {parts.map((part, i) =>
                    part.toLowerCase() === highlight.toLowerCase() ? (
                        <span key={i} className="bg-secondary/30 text-secondary font-bold px-1 py-0.5 rounded">
                            {part}
                        </span>
                    ) : (
                        part
                    )
                )}
            </>
        );
    };

    return (
        <div className="bg-black/20 p-4 sm:p-6 rounded-lg">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Key Vocabulary Learnings</h2>
                <div className="flex gap-2">
                    <button onClick={() => downloadFile('json')} className="flex items-center gap-2 px-3 py-2 text-sm bg-white/10 hover:bg-white/20 rounded-md transition">
                        <Icon path="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" className="w-4 h-4"/>
                        JSON
                    </button>
                    <button onClick={() => downloadFile('csv')} className="flex items-center gap-2 px-3 py-2 text-sm bg-white/10 hover:bg-white/20 rounded-md transition">
                        <Icon path="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" className="w-4 h-4"/>
                        CSV
                    </button>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-left">
                    <thead>
                        <tr className="border-b border-white/10 text-textSecondary">
                            <th className="p-3">Term</th>
                            <th className="p-3">Definition</th>
                            <th className="p-3">Example from Lyrics</th>
                            <th className="p-3 text-center">Difficulty</th>
                        </tr>
                    </thead>
                    <tbody>
                        {vocabularyList.map((item, index) => (
                            <tr key={index} className="border-b border-white/10 last:border-b-0">
                                <td className="p-3 align-top w-1/5">
                                    <p className="font-bold text-lg text-textPrimary">{item.term.spanish}</p>
                                    <p className="text-sm text-textSecondary">{item.term.english}</p>
                                </td>
                                <td className="p-3 align-top w-2/5">
                                    <p className="text-textPrimary">{item.definition}</p>
                                </td>
                                <td className="p-3 align-top w-2/5">
                                    <p className="text-textPrimary italic">"{highlightText(item.example.spanish, item.highlight.spanish)}"</p>
                                    <p className="text-textSecondary italic">"{highlightText(item.example.english, item.highlight.english)}"</p>
                                </td>
                                <td className="p-3 align-top text-center">
                                    <div className="w-full bg-black/40 rounded-full h-2.5 mt-1">
                                        <div className="bg-secondary h-2.5 rounded-full" style={{ width: `${item.difficulty * 10}%` }}></div>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const Footer: React.FC<{ buildTimestamp: string, onRunTest: () => void }> = ({ buildTimestamp, onRunTest }) => (
    <footer className="text-center text-xs text-textSecondary/50 w-full max-w-5xl">
        <p>
            <button onClick={onRunTest} className="hover:text-secondary transition underline">Run Diagnostic Test</button>
            <span className="mx-2">|</span>
            Version 1.2.0 | Build: {buildTimestamp}
        </p>
    </footer>
);

export default App;