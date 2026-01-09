import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import JSZip from 'jszip';
import {
  generateKaraokeData,
  generateVocabularyList,
  translateLyrics,
  refineKaraokeData,
  refineTranslatedKaraokeData,
  refineMarkedSegments,
  autoRefineProblems,
  generateBilingualKaraokeFromLrc,
  GeminiModelTier,
  AutoRefineProgress,
} from './services/geminiService';
import { isLrcFormat, parseLrc } from './services/lrcParser';
import {
  validateKaraokeDataPair,
  getScoreInterpretation,
  ValidationReport,
  ValidationIssue,
} from './services/validationService';
import { KaraokeApiResponse, KaraokeData, KaraokeSegment, KaraokeWord, VocabularyItem } from './types';

// --- Helper Functions & Components ---

// Audio notification sounds using Web Audio API
const playNotificationSound = (type: 'success' | 'error') => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    if (type === 'success') {
      // Pleasant two-tone chime (C5 -> E5)
      oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
      oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.15); // E5
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
      oscillator.type = 'sine';
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.4);
    } else {
      // Low warning tone (A3 -> F3)
      oscillator.frequency.setValueAtTime(220, audioContext.currentTime); // A3
      oscillator.frequency.setValueAtTime(174.61, audioContext.currentTime + 0.15); // F3
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      oscillator.type = 'sine';
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    }
  } catch (e) {
    // Audio not supported or blocked - silently ignore
    console.log('Audio notification not available:', e);
  }
};

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

const LyricEditor: React.FC<{ value: string; onChange: (value: string) => void; placeholder: string; lang: string }> = ({ value, onChange, placeholder, lang }) => (
    <div>
        <label className="block text-sm font-medium text-textSecondary mb-1">{lang} Lyrics</label>
        <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full h-64 p-3 bg-black/20 text-textPrimary rounded-lg border border-white/20 focus:ring-2 focus:ring-secondary focus:border-secondary resize-none font-mono text-sm leading-6"
        />
    </div>
);


const App: React.FC = () => {
    // Inputs
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [spanishLyrics, setSpanishLyrics] = useState<string>('');
    const [englishLyrics, setEnglishLyrics] = useState<string>('');
    const [languageFlow, setLanguageFlow] = useState<'es-en' | 'en-es'>('es-en');
    const [modelTier, setModelTier] = useState<GeminiModelTier>('gemini-2.5');

    // LRC Mode - auto-detected when Spanish lyrics contain LRC timestamps
    const [lrcContent, setLrcContent] = useState<string>('');
    const isLrcMode = useMemo(() => isLrcFormat(spanishLyrics), [spanishLyrics]);
    const parsedLrcInfo = useMemo(() => {
        if (!isLrcMode) return null;
        const parsed = parseLrc(spanishLyrics);
        return {
            lineCount: parsed.lines.length,
            metadata: parsed.metadata,
        };
    }, [isLrcMode, spanishLyrics]);

    // UI State
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isTranslating, setIsTranslating] = useState<boolean>(false);
    const [isGeneratingVocab, setIsGeneratingVocab] = useState<boolean>(false);
    const [statusMessage, setStatusMessage] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [buildTimestamp, setBuildTimestamp] = useState<string>('Loading...');

    // Results
    const [karaokeData, setKaraokeData] = useState<KaraokeApiResponse | null>(null);
    const [vocabularyList, setVocabularyList] = useState<VocabularyItem[] | null>(null);
    const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);
    const [activeTab, setActiveTab] = useState<'preview' | 'data' | 'vocab'>('preview');

    // Segment marking for AI refinement
    const [markedSegments, setMarkedSegments] = useState<Set<number>>(new Set());
    const [playRequest, setPlayRequest] = useState<{ startTimeMs: number, endTimeMs: number } | null>(null);
    const [showValidationPanel, setShowValidationPanel] = useState(false);

    // Auto-refinement state
    const [isAutoRefining, setIsAutoRefining] = useState(false);
    const [autoRefineProgress, setAutoRefineProgress] = useState<AutoRefineProgress | null>(null);

    // Audio blob URL - managed at App level to persist across tab switches
    const [audioUrl, setAudioUrl] = useState<string | null>(null);

    // Create/revoke blob URL when audioFile changes
    useEffect(() => {
        if (audioFile) {
            const url = URL.createObjectURL(audioFile);
            setAudioUrl(url);
            return () => {
                URL.revokeObjectURL(url);
            };
        } else {
            setAudioUrl(null);
        }
    }, [audioFile]);


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

    useEffect(() => {
        if (playRequest) {
            setActiveTab('preview');
        }
    }, [playRequest]);

    // FIX: This effect automatically synchronizes vocabulary timecodes and example text
    // with the karaoke data whenever the karaoke data is refined or adjusted.
    useEffect(() => {
        // Run only when both data sets are available
        if (karaokeData && vocabularyList?.length) {

            const newVocabularyList = vocabularyList.map(item => {
                // Find the segment by matching the example text (most reliable method)
                // This handles both 0-based and 1-based segmentIndex from Gemini
                let spanishSegment = karaokeData.spanish.segments.find(
                    seg => seg.text && item.example.spanish &&
                           seg.text.toLowerCase().includes(item.term.spanish.toLowerCase())
                );

                // Fallback: try the segmentIndex (handle both 0-based and 1-based)
                if (!spanishSegment) {
                    const idx = item.segmentIndex;
                    // Try 1-based first (segmentIndex - 1)
                    if (idx >= 1 && idx <= karaokeData.spanish.segments.length) {
                        spanishSegment = karaokeData.spanish.segments[idx - 1];
                    }
                    // Try 0-based
                    else if (idx >= 0 && idx < karaokeData.spanish.segments.length) {
                        spanishSegment = karaokeData.spanish.segments[idx];
                    }
                }

                if (!spanishSegment) {
                    return item; // Return original if no segment found
                }

                // Find matching English segment by timing
                const englishSegment = karaokeData.english.segments.find(
                    seg => seg.startTimeMs === spanishSegment!.startTimeMs
                ) || karaokeData.english.segments[karaokeData.spanish.segments.indexOf(spanishSegment)];

                // Check if an update is needed to avoid unnecessary re-renders
                if (spanishSegment.startTimeMs !== item.startTimeMs ||
                    spanishSegment.endTimeMs !== item.endTimeMs) {

                    return {
                        ...item,
                        startTimeMs: spanishSegment.startTimeMs,
                        endTimeMs: spanishSegment.endTimeMs,
                        segmentIndex: karaokeData.spanish.segments.indexOf(spanishSegment) + 1,
                        example: {
                            spanish: spanishSegment.text || item.example.spanish,
                            english: englishSegment?.text || item.example.english,
                        },
                    };
                }

                return item; // No changes needed
            });

            // Only update state if the list has actually changed to prevent infinite loops
            if (JSON.stringify(newVocabularyList) !== JSON.stringify(vocabularyList)) {
                console.log("Vocabulary has been re-synced with updated karaoke data.");
                setVocabularyList(newVocabularyList);
            }
        }
    }, [karaokeData, vocabularyList]);

    const clearAll = () => {
        setAudioFile(null);
        setSpanishLyrics('');
        setEnglishLyrics('');
        setLrcContent('');
        setKaraokeData(null);
        setVocabularyList(null);
        setValidationReport(null);
        setError(null);
        setStatusMessage('');
        setIsLoading(false);
        setProgress(0);
        setMarkedSegments(new Set());
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
                isEsToEn ? 'en' : 'es',
                modelTier
            );
            if (isEsToEn) {
                setEnglishLyrics(translated);
            } else {
                setSpanishLyrics(translated);
            }
            playNotificationSound('success');
        } catch (err) {
            setError((err as Error).message);
            playNotificationSound('error');
        } finally {
            setIsTranslating(false);
        }
    };
    
    const handleGenerate = async () => {
        if (!audioFile) {
            setError("Please provide an audio file.");
            return;
        }

        // In LRC mode, we only need the Spanish LRC content
        // In standard mode, we need both Spanish and English lyrics
        if (isLrcMode) {
            if (!spanishLyrics) {
                setError("Please provide LRC content.");
                return;
            }
        } else {
            if (!spanishLyrics || !englishLyrics) {
                setError("Please provide both Spanish and English lyrics.");
                return;
            }
        }

        setIsLoading(true);
        setError(null);
        setKaraokeData(null);
        setVocabularyList(null);
        setValidationReport(null);
        setMarkedSegments(new Set());
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
                if (message.includes('Step 1')) setProgress(p => Math.max(p, 10));
                if (message.includes('Step 2')) setProgress(p => Math.max(p, 30));
                if (message.includes('Step 3')) setProgress(p => Math.max(p, 50));
                if (message.includes('Step 4')) setProgress(p => Math.max(p, 80));
                if (message.includes('Analyzing')) setProgress(p => Math.max(p, 25));
                if (message.includes('complete')) setProgress(100);
            };

            let result: KaraokeApiResponse;

            if (isLrcMode) {
                // Use LRC-based generation (auto-translates and generates bilingual)
                result = await generateBilingualKaraokeFromLrc(
                    audioFile,
                    spanishLyrics,
                    onStatusUpdate,
                    modelTier
                );
            } else {
                // Use standard generation
                const originalLyrics = languageFlow === 'es-en' ? spanishLyrics : englishLyrics;
                const translatedLyrics = languageFlow === 'es-en' ? englishLyrics : spanishLyrics;
                result = await generateKaraokeData(audioFile, originalLyrics, translatedLyrics, languageFlow, onStatusUpdate, modelTier);
            }

            setKaraokeData(result);
            setActiveTab('preview');

            // Run validation
            onStatusUpdate('Validating generated data...');
            const report = validateKaraokeDataPair(result.spanish, result.english);
            setValidationReport(report);

            const interpretation = getScoreInterpretation(report.overallScore);
            setStatusMessage(`Karaoke data generated! Quality: ${report.overallScore}/100 (${interpretation.label})`);
            setProgress(100);
            playNotificationSound('success');
        } catch (err) {
            setError((err as Error).message);
            playNotificationSound('error');
        } finally {
            clearInterval(interval);
            setIsLoading(false);
        }
    };

    const handleGenerateVocabulary = async () => {
        if (!karaokeData) {
            setError("Please generate karaoke data first.");
            return;
        }

        setIsGeneratingVocab(true);
        setError(null);
        setStatusMessage('Extracting vocabulary from lyrics...');

        try {
            const vocab = await generateVocabularyList(karaokeData.spanish, karaokeData.english, modelTier);
            setVocabularyList(vocab);
            setStatusMessage('Vocabulary extraction complete!');
            setActiveTab('vocab');
            playNotificationSound('success');
        } catch (err) {
            setError((err as Error).message);
            setStatusMessage('');
            playNotificationSound('error');
        } finally {
            setIsGeneratingVocab(false);
        }
    };

    // Toggle segment marking for AI refinement
    const handleToggleSegmentMark = useCallback((segmentIndex: number) => {
      setMarkedSegments(prev => {
        const newSet = new Set(prev);
        if (newSet.has(segmentIndex)) {
          newSet.delete(segmentIndex);
        } else {
          newSet.add(segmentIndex);
        }
        return newSet;
      });
    }, []);

    // Clear all marked segments
    const handleClearMarkedSegments = useCallback(() => {
      setMarkedSegments(new Set());
    }, []);

    // Handle seeking from validation panel
    const handleSeekFromValidation = (timeMs: number) => {
        setPlayRequest({ startTimeMs: timeMs, endTimeMs: timeMs + 3000 }); // Play 3 seconds from that point
        setActiveTab('preview');
        setShowValidationPanel(false);
    };

    const handleAutoFix = async () => {
        if (!audioFile || !karaokeData) return;

        setIsAutoRefining(true);
        setAutoRefineProgress(null);
        setError(null);

        try {
            const result = await autoRefineProblems(
                audioFile,
                karaokeData,
                languageFlow,
                setStatusMessage,
                setAutoRefineProgress,
                {
                    targetScore: 85,
                    maxIterations: 3,
                    includeWarnings: true,
                    modelTier,
                }
            );

            setKaraokeData(result.karaokeData);
            setValidationReport(result.finalValidation);

            if (result.improved) {
                playNotificationSound('success');
            }
        } catch (err) {
            console.error('Auto-fix failed:', err);
            setError(err instanceof Error ? err.message : 'Auto-fix failed');
            playNotificationSound('error');
        } finally {
            setIsAutoRefining(false);
            setAutoRefineProgress(null);
        }
    };

    // In LRC mode, we only need audio + Spanish LRC content
    // In standard mode, we need audio + both lyrics
    const isGenerateDisabled = isLoading || !audioFile || !spanishLyrics || (!isLrcMode && !englishLyrics);

    return (
        <div className="min-h-screen flex flex-col items-center justify-start p-4 sm:p-6 md:p-8 space-y-8">
            <Header />

            <GlassPanel className="w-full max-w-5xl">
                {!karaokeData && (
                    <div className="p-8 space-y-8">
                        <FileUploader onFileSelect={setAudioFile} selectedFile={audioFile} />
                        {audioFile && (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                                    <div>
                                        <label className="block text-sm font-medium text-textSecondary mb-1">Original Language Flow</label>
                                        <select value={languageFlow} onChange={(e) => setLanguageFlow(e.target.value as 'es-en' | 'en-es')} className="w-full p-3 bg-black/20 text-textPrimary rounded-lg border border-white/20 focus:ring-2 focus:ring-secondary focus:border-secondary">
                                            <option value="es-en">Spanish → English</option>
                                            <option value="en-es">English → Spanish</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-textSecondary mb-1">AI Model</label>
                                        <select value={modelTier} onChange={(e) => setModelTier(e.target.value as GeminiModelTier)} className="w-full p-3 bg-black/20 text-textPrimary rounded-lg border border-white/20 focus:ring-2 focus:ring-secondary focus:border-secondary">
                                            <option value="gemini-2.5">Gemini 2.5 (Stable)</option>
                                            <option value="gemini-3-preview">Gemini 3 (Preview)</option>
                                        </select>
                                    </div>
                                    {!isLrcMode && (
                                        <ActionButton onClick={handleTranslate} disabled={isTranslating} icon="M13.5 16.875h3.375m0 0h3.375m-3.375 0V13.5m0 3.375v3.375M6 10.5h2.25a2.25 2.25 0 002.25-2.25V6a2.25 2.25 0 00-2.25-2.25H6A2.25 2.25 0 003.75 6v2.25A2.25 2.25 0 006 10.5zm0 9.75h2.25A2.25 2.25 0 0010.5 18v-2.25a2.25 2.25 0 00-2.25-2.25H6a2.25 2.25 0 00-2.25 2.25V18A2.25 2.25 0 006 20.25zm9.75-9.75H18a2.25 2.25 0 002.25-2.25V6A2.25 2.25 0 0018 3.75h-2.25A2.25 2.25 0 0013.5 6v2.25a2.25 2.25 0 002.25 2.25z">
                                            {isTranslating ? 'Translating...' : `Translate to ${languageFlow === 'es-en' ? 'English' : 'Spanish'}`}
                                        </ActionButton>
                                    )}
                                </div>
                                {/* LRC Mode Indicator */}
                                {isLrcMode && parsedLrcInfo && (
                                    <div className="flex items-center gap-3 p-4 bg-secondary/20 border border-secondary/50 rounded-lg">
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-1 bg-secondary text-background text-xs font-bold rounded">LRC MODE</span>
                                            <span className="text-textPrimary font-medium">
                                                {parsedLrcInfo.lineCount} lines detected
                                            </span>
                                        </div>
                                        <div className="text-textSecondary text-sm">
                                            {parsedLrcInfo.metadata.title && <span className="mr-2">"{parsedLrcInfo.metadata.title}"</span>}
                                            {parsedLrcInfo.metadata.artist && <span>by {parsedLrcInfo.metadata.artist}</span>}
                                        </div>
                                        <div className="ml-auto text-xs text-textSecondary">
                                            Translation will be auto-generated
                                        </div>
                                    </div>
                                )}

                                <div className={`grid gap-6 ${isLrcMode ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <label className="block text-sm font-medium text-textSecondary">
                                                {isLrcMode ? 'Spanish LRC Content' : 'Spanish Lyrics'}
                                            </label>
                                            {!isLrcMode && (
                                                <span className="text-xs text-textSecondary/70">
                                                    (Paste LRC format for enhanced timing)
                                                </span>
                                            )}
                                        </div>
                                        <textarea
                                            value={spanishLyrics}
                                            onChange={(e) => setSpanishLyrics(e.target.value)}
                                            placeholder={isLrcMode ? "[00:10.14] Ey, Tití me preguntó..." : "[Intro]..."}
                                            className={`w-full h-64 p-3 bg-black/20 text-textPrimary rounded-lg border focus:ring-2 focus:ring-secondary focus:border-secondary resize-none font-mono text-sm leading-6 ${
                                                isLrcMode ? 'border-secondary/50' : 'border-white/20'
                                            }`}
                                        />
                                    </div>
                                    {!isLrcMode && (
                                        <LyricEditor value={englishLyrics} onChange={setEnglishLyrics} placeholder="[Intro]..." lang="English" />
                                    )}
                                </div>
                            </>
                        )}
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                           <ActionButton
                              onClick={handleGenerate}
                              disabled={isGenerateDisabled}
                              className={`w-full sm:w-auto px-12 py-4 text-lg font-bold ${isGenerateDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
                              icon="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.898 20.562L16.25 22.5l-.648-1.938a3.375 3.375 0 00-2.456-2.456L11.25 18l1.938-.648a3.375 3.375 0 002.456-2.456L16.25 13l.648 1.938a3.375 3.375 0 002.456 2.456L21 18l-1.938.648a3.375 3.375 0 00-2.456 2.456z">
                                {isLoading ? 'Generating...' : (isLrcMode ? 'Generate from LRC' : 'Generate Synced Files')}
                            </ActionButton>
                            <button onClick={clearAll} className="text-textSecondary hover:text-textPrimary transition">Clear All</button>
                        </div>
                    </div>
                )}

                {(isLoading || isAutoRefining) && <ProgressBar progress={progress} statusMessage={statusMessage} />}
                {error && <ErrorMessage message={error} />}

                {karaokeData && !isLoading && (
                    <div className="p-4 sm:p-8">
                        {/* Header with tabs and validation badge */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
                            <TabNav activeTab={activeTab} setActiveTab={setActiveTab} hasVocab={!!vocabularyList} />
                            {validationReport && (
                                <ValidationBadge
                                    report={validationReport}
                                    onShowDetails={() => setShowValidationPanel(!showValidationPanel)}
                                />
                            )}
                        </div>

                        {/* Validation Panel (expandable) */}
                        {showValidationPanel && validationReport && (
                            <ValidationPanel
                                report={validationReport}
                                onClose={() => setShowValidationPanel(false)}
                                onSeek={handleSeekFromValidation}
                                onAutoFix={handleAutoFix}
                                isAutoRefining={isAutoRefining}
                                autoRefineProgress={autoRefineProgress}
                            />
                        )}

                        <div className="mt-2">
                            {activeTab === 'preview' && audioUrl && <KaraokePreview karaokeData={karaokeData} audioUrl={audioUrl} markedSegments={markedSegments} onToggleSegmentMark={handleToggleSegmentMark} onClearMarkedSegments={handleClearMarkedSegments} playRequest={playRequest} onPlayRequestComplete={() => setPlayRequest(null)} audioFile={audioFile} languageFlow={languageFlow} setKaraokeData={setKaraokeData} onValidationUpdate={setValidationReport} modelTier={modelTier} />}
                            {activeTab === 'data' && <KaraokeDataDisplay karaokeData={karaokeData} setKaraokeData={setKaraokeData} audioFile={audioFile} languageFlow={languageFlow} onValidationUpdate={setValidationReport} modelTier={modelTier} />}
                            {activeTab === 'vocab' && (
                                vocabularyList
                                    ? <VocabularyDisplay vocabularyList={vocabularyList} onPlayRequest={setPlayRequest} />
                                    : <VocabularyPlaceholder onGenerate={handleGenerateVocabulary} isGenerating={isGeneratingVocab} />
                            )}
                        </div>
                         <div className="text-center mt-8">
                            <button onClick={clearAll} className="bg-white/10 text-textSecondary px-6 py-2 rounded-lg hover:bg-white/20 transition">Start Over</button>
                         </div>
                    </div>
                )}
            </GlassPanel>

            <Footer buildTimestamp={buildTimestamp} />
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

// --- Validation UI Components ---

interface ValidationBadgeProps {
  report: ValidationReport;
  onShowDetails: () => void;
}

const ValidationBadge: React.FC<ValidationBadgeProps> = ({ report, onShowDetails }) => {
    const interpretation = getScoreInterpretation(report.overallScore);
    const totalErrors = report.spanish.errorCount + report.english.errorCount +
        report.crossLanguage.issues.filter(i => i.severity === 'error').length;
    const totalWarnings = report.spanish.warningCount + report.english.warningCount +
        report.crossLanguage.issues.filter(i => i.severity === 'warning').length;

    return (
        <div
            onClick={onShowDetails}
            className="flex items-center gap-3 px-4 py-2 bg-black/30 rounded-lg cursor-pointer hover:bg-black/40 transition"
        >
            <div className={`text-2xl font-bold ${interpretation.color}`}>
                {report.overallScore}
            </div>
            <div className="text-sm">
                <div className={`font-medium ${interpretation.color}`}>{interpretation.label}</div>
                <div className="text-textSecondary text-xs">
                    {totalErrors > 0 && <span className="text-red-400 mr-2">{totalErrors} errors</span>}
                    {totalWarnings > 0 && <span className="text-yellow-400">{totalWarnings} warnings</span>}
                    {totalErrors === 0 && totalWarnings === 0 && <span className="text-green-400">No issues</span>}
                </div>
            </div>
            <Icon path="M8.25 4.5l7.5 7.5-7.5 7.5" className="w-4 h-4 text-textSecondary" />
        </div>
    );
};

interface ValidationPanelProps {
  report: ValidationReport;
  onClose: () => void;
  onSeek: (timeMs: number) => void;
  onAutoFix?: () => void;
  isAutoRefining?: boolean;
  autoRefineProgress?: AutoRefineProgress | null;
}

const ValidationPanel: React.FC<ValidationPanelProps> = ({
    report,
    onClose,
    onSeek,
    onAutoFix,
    isAutoRefining = false,
    autoRefineProgress,
}) => {
    const allIssues: (ValidationIssue & { source: string })[] = [
        ...report.spanish.errors.map(i => ({ ...i, source: 'Spanish' })),
        ...report.spanish.warnings.map(i => ({ ...i, source: 'Spanish' })),
        ...report.english.errors.map(i => ({ ...i, source: 'English' })),
        ...report.english.warnings.map(i => ({ ...i, source: 'English' })),
        ...report.crossLanguage.issues.map(i => ({ ...i, source: 'Cross-Language' })),
    ];

    const errors = allIssues.filter(i => i.severity === 'error');
    const warnings = allIssues.filter(i => i.severity === 'warning');

    const interpretation = getScoreInterpretation(report.overallScore);

    return (
        <div className="bg-black/40 border border-white/10 rounded-lg p-4 mb-4">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        Quality Score:
                        <span className={interpretation.color}>{report.overallScore}/100</span>
                        <span className={`text-sm font-normal ${interpretation.color}`}>({interpretation.label})</span>
                    </h3>
                    <p className="text-sm text-textSecondary">{interpretation.recommendation}</p>
                </div>
                <button onClick={onClose} className="p-1 hover:bg-white/10 rounded transition">
                    <Icon path="M6 18L18 6M6 6l12 12" className="w-5 h-5" />
                </button>
            </div>

            {/* Auto-Fix Button */}
            {onAutoFix && report.overallScore < 85 && allIssues.length > 0 && (
                <div className="mb-4">
                    {isAutoRefining ? (
                        <div className="bg-secondary/20 border border-secondary/30 rounded-lg p-3">
                            <div className="flex items-center gap-3">
                                <div className="animate-spin">
                                    <Icon path="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" className="w-5 h-5 text-secondary" />
                                </div>
                                <div className="flex-1">
                                    <div className="text-sm font-medium text-textPrimary">
                                        {autoRefineProgress
                                            ? `Auto-fixing: Iteration ${autoRefineProgress.iteration}/${autoRefineProgress.maxIterations}`
                                            : 'Starting auto-fix...'}
                                    </div>
                                    {autoRefineProgress && (
                                        <div className="text-xs text-textSecondary">
                                            {autoRefineProgress.status === 'refining' && `Refining ${autoRefineProgress.problemSegmentCount} segment(s)...`}
                                            {autoRefineProgress.status === 'validating' && 'Re-validating...'}
                                            {autoRefineProgress.status === 'error' && 'Error occurred, retrying...'}
                                        </div>
                                    )}
                                </div>
                                {autoRefineProgress && (
                                    <div className="text-sm text-textSecondary">
                                        Score: {autoRefineProgress.currentScore} → {autoRefineProgress.targetScore}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={onAutoFix}
                            className="w-full bg-secondary/80 hover:bg-secondary text-white font-medium py-2 px-4 rounded-lg transition flex items-center justify-center gap-2"
                        >
                            <Icon path="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" className="w-5 h-5" />
                            Auto-Fix Issues ({allIssues.length} issues)
                        </button>
                    )}
                </div>
            )}

            {/* Metrics Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 text-sm">
                <div className="bg-black/30 p-2 rounded">
                    <div className="text-textSecondary">Segments</div>
                    <div className="font-bold">{report.spanish.metrics.totalSegments}</div>
                </div>
                <div className="bg-black/30 p-2 rounded">
                    <div className="text-textSecondary">Words (ES)</div>
                    <div className="font-bold">{report.spanish.metrics.totalWords}</div>
                </div>
                <div className="bg-black/30 p-2 rounded">
                    <div className="text-textSecondary">Words (EN)</div>
                    <div className="font-bold">{report.english.metrics.totalWords}</div>
                </div>
                <div className="bg-black/30 p-2 rounded">
                    <div className="text-textSecondary">Coverage</div>
                    <div className="font-bold">{Math.round(report.spanish.metrics.coverageRatio * 100)}%</div>
                </div>
            </div>

            {/* Issues List */}
            {allIssues.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                    {errors.length > 0 && (
                        <div className="mb-3">
                            <div className="text-red-400 font-medium text-sm mb-1">Errors ({errors.length})</div>
                            {errors.map((issue, idx) => (
                                <IssueRow key={`error-${idx}`} issue={issue} onSeek={onSeek} />
                            ))}
                        </div>
                    )}
                    {warnings.length > 0 && (
                        <div>
                            <div className="text-yellow-400 font-medium text-sm mb-1">Warnings ({warnings.length})</div>
                            {warnings.map((issue, idx) => (
                                <IssueRow key={`warning-${idx}`} issue={issue} onSeek={onSeek} />
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <div className="text-center py-4 text-green-400">
                    <Icon path="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" className="w-8 h-8 mx-auto mb-2" />
                    <p>No issues detected!</p>
                </div>
            )}
        </div>
    );
};

const IssueRow: React.FC<{ issue: ValidationIssue & { source: string }; onSeek: (timeMs: number) => void }> = ({ issue, onSeek }) => {
    const canSeek = issue.context.startTimeMs !== undefined;

    return (
        <div
            className={`flex items-start gap-2 p-2 rounded text-sm ${
                issue.severity === 'error' ? 'bg-red-900/20' : 'bg-yellow-900/20'
            } ${canSeek ? 'cursor-pointer hover:bg-white/10' : ''}`}
            onClick={() => canSeek && onSeek(issue.context.startTimeMs!)}
        >
            <span className={`shrink-0 ${issue.severity === 'error' ? 'text-red-400' : 'text-yellow-400'}`}>
                {issue.severity === 'error' ? '●' : '▲'}
            </span>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-textSecondary text-xs">{issue.source}</span>
                    {issue.segmentIndex >= 0 && (
                        <span className="text-textSecondary text-xs">Seg {issue.segmentIndex + 1}</span>
                    )}
                </div>
                <div className="text-textPrimary truncate">{issue.message}</div>
            </div>
            {canSeek && (
                <Icon path="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" className="w-4 h-4 text-textSecondary shrink-0" />
            )}
        </div>
    );
};

const TabNav: React.FC<{ activeTab: string, setActiveTab: (tab: any) => void, hasVocab: boolean }> = ({ activeTab, setActiveTab, hasVocab }) => {
    const tabs = [
        { id: 'preview', label: 'Preview' },
        { id: 'data', label: 'Karaoke Data' },
        { id: 'vocab', label: hasVocab ? 'Vocabulary' : 'Vocabulary ✨' }
    ];
    return (
        <div className="border-b border-white/10 flex justify-center space-x-4 sm:space-x-8">
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 text-sm sm:text-base font-medium transition-colors
                        ${activeTab === tab.id ? 'text-secondary border-b-2 border-secondary' : 'text-textSecondary hover:text-textPrimary'}`}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );
};

interface KaraokePreviewProps {
  karaokeData: KaraokeApiResponse;
  audioUrl: string;
  markedSegments: Set<number>;
  onToggleSegmentMark: (segmentIndex: number) => void;
  onClearMarkedSegments: () => void;
  playRequest: { startTimeMs: number, endTimeMs: number } | null;
  onPlayRequestComplete: () => void;
  audioFile: File | null;
  languageFlow: 'es-en' | 'en-es';
  setKaraokeData: (data: KaraokeApiResponse) => void;
  onValidationUpdate?: (report: ValidationReport) => void;
  modelTier: GeminiModelTier;
}


const KaraokePreview: React.FC<KaraokePreviewProps> = ({
    karaokeData,
    audioUrl,
    markedSegments,
    onToggleSegmentMark,
    onClearMarkedSegments,
    playRequest,
    onPlayRequestComplete,
    audioFile,
    languageFlow,
    setKaraokeData,
    modelTier,
    onValidationUpdate
}) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const animationFrameRef = useRef<number | null>(null);

    // Segment refinement state
    const [isRefiningSegments, setIsRefiningSegments] = useState(false);
    const [refineStatus, setRefineStatus] = useState('');

    // For Audio Visualizer
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);

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
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [audioUrl]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!playRequest || !audio) return;

        // Ensure audio context is ready
        setupAudioContext();
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume();
        }

        audio.currentTime = playRequest.startTimeMs / 1000;
        
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            setIsPlaying(true);
            if (!animationFrameRef.current) {
              animationFrameRef.current = requestAnimationFrame(animate);
            }
          }).catch(error => {
            console.error("Audio playback failed:", error);
            setIsPlaying(false); // If play fails, reflect it in the state
            onPlayRequestComplete();
          });
        }

        const checkEndTime = () => {
          if (audio.currentTime * 1000 >= playRequest.endTimeMs) {
            audio.pause();
            setIsPlaying(false);
            if (animationFrameRef.current) {
              cancelAnimationFrame(animationFrameRef.current);
              animationFrameRef.current = null;
            }
            onPlayRequestComplete();
          }
        };
        
        audio.addEventListener('timeupdate', checkEndTime);

        return () => {
          audio.removeEventListener('timeupdate', checkEndTime);
        };

    }, [playRequest, onPlayRequestComplete, animate]);


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

            {/* FIX: Added a new time display in SS.ms format for precise reference. */}
            <div className="text-center font-mono text-2xl text-textSecondary tracking-wider -mb-2">
              <span>{(currentTime || 0).toFixed(3)}s</span>
            </div>
            
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

            {/* --- Segment Refinement Panel --- */}
            {markedSegments.size > 0 && (
              <SegmentRefinementPanel
                markedSegments={markedSegments}
                totalSegments={karaokeData.spanish.segments.length}
                onClearMarkedSegments={onClearMarkedSegments}
                isRefining={isRefiningSegments}
                refineStatus={refineStatus}
                karaokeData={karaokeData}
                audioFile={audioFile}
                languageFlow={languageFlow}
                setKaraokeData={setKaraokeData}
                setIsRefining={setIsRefiningSegments}
                setRefineStatus={setRefineStatus}
                onValidationUpdate={onValidationUpdate}
                modelTier={modelTier}
              />
            )}

            {/* --- Lyric Panels --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <LyricPanel
                    title="Spanish"
                    segments={karaokeData.spanish.segments}
                    currentTime={currentTime * 1000}
                    onSeek={handleSeekToTime}
                    markedSegments={markedSegments}
                    onToggleSegmentMark={onToggleSegmentMark}
                />
                <LyricPanel
                    title="English"
                    segments={karaokeData.english.segments}
                    currentTime={currentTime * 1000}
                    onSeek={handleSeekToTime}
                    markedSegments={markedSegments}
                    onToggleSegmentMark={onToggleSegmentMark}
                />
            </div>
        </div>
    );
};

interface SegmentRefinementPanelProps {
  markedSegments: Set<number>;
  totalSegments: number;
  onClearMarkedSegments: () => void;
  isRefining: boolean;
  refineStatus: string;
  karaokeData: KaraokeApiResponse;
  audioFile: File | null;
  languageFlow: 'es-en' | 'en-es';
  setKaraokeData: (data: KaraokeApiResponse) => void;
  setIsRefining: (value: boolean) => void;
  setRefineStatus: (status: string) => void;
  onValidationUpdate?: (report: ValidationReport) => void;
  modelTier: GeminiModelTier;
}

const SegmentRefinementPanel: React.FC<SegmentRefinementPanelProps> = ({
  markedSegments,
  totalSegments,
  onClearMarkedSegments,
  isRefining,
  refineStatus,
  karaokeData,
  audioFile,
  languageFlow,
  setKaraokeData,
  setIsRefining,
  setRefineStatus,
  onValidationUpdate,
  modelTier
}) => {
  const markedIndices = Array.from(markedSegments).sort((a, b) => a - b);

  const handleRefineMarkedSegments = async () => {
    if (!audioFile) {
      alert("Audio file is missing. Cannot start refinement.");
      return;
    }

    setIsRefining(true);
    setRefineStatus('Preparing segment refinement...');

    const originalLangIsSpanish = languageFlow === 'es-en';
    const originalDataKey = originalLangIsSpanish ? 'spanish' : 'english';
    const translatedDataKey = originalLangIsSpanish ? 'english' : 'spanish';
    const originalLangName = originalLangIsSpanish ? 'Spanish' : 'English';
    const translatedLangName = originalLangIsSpanish ? 'English' : 'Spanish';

    try {
      // Step 1: Refine marked segments in original language
      setRefineStatus(`Refining ${markedIndices.length} marked segments in ${originalLangName}...`);
      const refinedOriginalData = await refineMarkedSegments(
        audioFile,
        karaokeData[originalDataKey],
        markedIndices,
        originalLangName,
        (status) => setRefineStatus(`${originalLangName}: ${status}`),
        undefined,
        modelTier
      );

      // Update with refined original data
      const updatedDataAfterOriginal = { ...karaokeData, [originalDataKey]: refinedOriginalData };
      setKaraokeData(updatedDataAfterOriginal);

      // Step 2: Refine translated language to match
      setRefineStatus(`Aligning ${translatedLangName} translation with refined timing...`);
      const refinedTranslatedData = await refineMarkedSegments(
        audioFile,
        karaokeData[translatedDataKey],
        markedIndices,
        translatedLangName,
        (status) => setRefineStatus(`${translatedLangName}: ${status}`),
        refinedOriginalData, // Pass the refined original as reference for timing
        modelTier
      );

      const finalData = {
        ...updatedDataAfterOriginal,
        [translatedDataKey]: refinedTranslatedData
      };
      setKaraokeData(finalData);

      // Step 3: Run full validation to catch cascading issues
      if (onValidationUpdate) {
        setRefineStatus('Running full validation pass...');
        const report = validateKaraokeDataPair(finalData.spanish, finalData.english);
        onValidationUpdate(report);

        const interpretation = getScoreInterpretation(report.overallScore);
        setRefineStatus(`Refinement complete! Quality: ${report.overallScore}/100 (${interpretation.label})`);
      } else {
        setRefineStatus('Refinement complete!');
      }

      playNotificationSound('success');

      // Clear marked segments after successful refinement
      setTimeout(() => {
        onClearMarkedSegments();
        setIsRefining(false);
      }, 3000);

    } catch (err) {
      setRefineStatus(`Error: ${(err as Error).message}`);
      playNotificationSound('error');
      setIsRefining(false);
    }
  };

  return (
    <div className="bg-black/40 p-4 rounded-lg border border-yellow-500/50 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-yellow-500/20 rounded-lg">
            <Icon path="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" className="w-5 h-5 text-yellow-500" />
          </div>
          <div>
            <p className="font-bold text-yellow-400">
              {markedIndices.length} segment{markedIndices.length !== 1 ? 's' : ''} marked for refinement
            </p>
            <p className="text-sm text-textSecondary">
              Lines: {markedIndices.map(i => i + 1).join(', ')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isRefining && (
            <>
              <button
                onClick={handleRefineMarkedSegments}
                className="flex items-center gap-2 px-4 py-2 bg-secondary text-background font-semibold rounded-lg hover:bg-green-400 transition"
              >
                <Icon path="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" className="w-5 h-5" />
                Refine Marked Segments
              </button>
              <button
                onClick={onClearMarkedSegments}
                className="p-2 rounded-lg hover:bg-white/10 transition text-textSecondary hover:text-white"
                title="Clear all marked segments"
              >
                <Icon path="M6 18L18 6M6 6l12 12" className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </div>

      {isRefining && (
        <div className="bg-black/30 rounded-lg p-3">
          <p className="text-textSecondary text-sm mb-2">{refineStatus}</p>
          <div className="w-full bg-black/40 rounded-full h-1.5">
            <div className="bg-secondary h-1.5 rounded-full animate-pulse" style={{ width: '100%' }}></div>
          </div>
        </div>
      )}
    </div>
  );
};

interface LyricPanelProps {
    title: string;
    segments: KaraokeSegment[];
    currentTime: number;
    onSeek: (timeMs: number) => void;
    markedSegments: Set<number>;
    onToggleSegmentMark: (segmentIndex: number) => void;
}

const LyricPanel: React.FC<LyricPanelProps> = ({ title, segments, currentTime, onSeek, markedSegments, onToggleSegmentMark }) => {
    const activeSegmentIndex = segments.findIndex(seg => currentTime >= seg.startTimeMs && currentTime <= seg.endTimeMs);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (activeSegmentIndex === -1 || !scrollContainerRef.current) return;

        const activeElement = scrollContainerRef.current.children[activeSegmentIndex] as HTMLElement;
        if (activeElement) {
            activeElement.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'nearest'
            });
        }
    }, [activeSegmentIndex]);

    const normalizeWord = (word: string) => {
        return word.toLowerCase().replace(/[.,'¡!¿?]/g, '').replace(/-/g, ' ');
    };

    return (
        <div className="bg-black/30 p-4 rounded-lg">
            <h3 className="text-lg font-bold text-center mb-4">{title}</h3>
            <div ref={scrollContainerRef} className="h-48 overflow-y-auto space-y-2 text-center pr-2 relative">
                {segments.map((segment, index) => {
                    const isActive = index === activeSegmentIndex;
                    const isMarked = markedSegments.has(index);

                    const baseClasses = "text-xl transition-all duration-300 cursor-pointer";

                    let segmentClasses = "";
                    if (isMarked) {
                      segmentClasses = "ring-2 ring-yellow-500 rounded-md p-2 box-border bg-yellow-500/10";
                    }

                    return (
                        <div key={index} className={`flex items-center gap-2 group ${segmentClasses}`}>
                            <button
                              onClick={() => onToggleSegmentMark(index)}
                              className={`transition-opacity ${isMarked ? 'opacity-100 text-yellow-500' : 'opacity-0 group-hover:opacity-75 hover:!opacity-100 text-textSecondary hover:text-yellow-500'}`}
                              title={isMarked ? "Unmark this segment" : "Mark as misaligned for refinement"}
                            >
                                <Icon path={isMarked
                                  ? "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                                  : "M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                                } className="w-5 h-5" />
                            </button>
                            <div className="flex-1" onClick={() => onSeek(segment.startTimeMs)}>
                                {segment.type === 'INSTRUMENTAL' ? (
                                    <p className={`italic ${baseClasses} ${isActive ? 'text-secondary font-bold scale-110' : 'text-textSecondary/70 scale-100'}`}>
                                        {segment.cueText}
                                    </p>
                                ) : (
                                    <p className={`${baseClasses} ${isActive ? 'text-textPrimary font-bold scale-110' : 'text-textSecondary'}`}>
                                       {/* FIX: The original logic for finding wordIndex was complex and buggy, causing a "used before declaration" error.
                                           This has been replaced with a simpler, more robust counter-based approach that correctly handles various lyric formatting issues. */}
                                       {(() => {
                                            let wordCounter = 0;
                                            return (segment.text?.split(/(\s+)/) || []).map((part, partIndex) => {
                                                if (/\s+/.test(part) || !part) return <span key={partIndex}>{part}</span>;

                                                const wordIndex = wordCounter++;
                                                const currentWordData = (segment.words || [])[wordIndex];

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
                                            });
                                       })()}
                                    </p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};


interface KaraokeDataDisplayProps {
    karaokeData: KaraokeApiResponse;
    setKaraokeData: (data: KaraokeApiResponse) => void;
    audioFile: File | null;
    languageFlow: 'es-en' | 'en-es';
    onValidationUpdate?: (report: ValidationReport) => void;
    modelTier: GeminiModelTier;
}

const KaraokeDataDisplay: React.FC<KaraokeDataDisplayProps> = ({ karaokeData, setKaraokeData, audioFile, languageFlow, onValidationUpdate, modelTier }) => {
  const [isRefining, setIsRefining] = useState(false);
  const [refineStatus, setRefineStatus] = useState('');
  const [refineProgress, setRefineProgress] = useState(0);

  const handleRefineBoth = async () => {
    if (!audioFile) {
      alert("Audio file is missing. Cannot start refinement.");
      return;
    }

    setIsRefining(true);
    setRefineProgress(0);

    const originalLangIsSpanish = languageFlow === 'es-en';
    const originalLangName = originalLangIsSpanish ? 'Spanish' : 'English';
    const translatedLangName = originalLangIsSpanish ? 'English' : 'Spanish';
    
    const originalDataKey = originalLangIsSpanish ? 'spanish' : 'english';
    const translatedDataKey = originalLangIsSpanish ? 'english' : 'spanish';


    try {
      // Step 1: Refine Original Language
      setRefineStatus(`Step 1/2: Refining ${originalLangName} lyrics against audio...`);
      setRefineProgress(10);
      const originalDataToRefine = karaokeData[originalDataKey];
      const refinedOriginalData = await refineKaraokeData(audioFile, originalDataToRefine, originalLangName, (status) => {
        setRefineStatus(`Step 1/2: Refining ${originalLangName} - ${status}`);
        if (status.toLowerCase().includes('sending data')) setRefineProgress(25);
      }, modelTier);
      setRefineProgress(50);
      
      const updatedDataAfterStep1 = { ...karaokeData, [originalDataKey]: refinedOriginalData };
      setKaraokeData(updatedDataAfterStep1);
      setRefineStatus(`${originalLangName} refinement complete!`);


      // Step 2: Refine Translated Language (Timing Alignment)
      setRefineStatus(`Step 2/2: Aligning ${translatedLangName} translation timing...`);
      setRefineProgress(60);
      const translatedDataToRefine = karaokeData[translatedDataKey];
      const refinedTranslatedData = await refineTranslatedKaraokeData(
        audioFile,
        translatedDataToRefine,
        refinedOriginalData,
        translatedLangName,
        originalLangName,
        (status) => {
          setRefineStatus(`Step 2/2: Aligning ${translatedLangName} - ${status}`);
          if (status.toLowerCase().includes('sending data')) setRefineProgress(75);
      }, modelTier);
      
      const finalData = {
        ...updatedDataAfterStep1,
        [translatedDataKey]: refinedTranslatedData
      };
      setKaraokeData(finalData);

      // Re-run validation after refinement
      if (onValidationUpdate) {
        setRefineStatus('Validating refined data...');
        const report = validateKaraokeDataPair(finalData.spanish, finalData.english);
        onValidationUpdate(report);
        const interpretation = getScoreInterpretation(report.overallScore);
        setRefineStatus(`Refinement complete! Quality: ${report.overallScore}/100 (${interpretation.label})`);
      } else {
        setRefineStatus('Refinement complete! Both language files have been updated.');
      }
      setRefineProgress(100);
      playNotificationSound('success');

    } catch (err) {
      alert(`Error during refinement: ${(err as Error).message}`);
      setRefineStatus(`Error: ${(err as Error).message}`);
      playNotificationSound('error');
    } finally {
      setTimeout(() => {
        setIsRefining(false);
      }, 5000); // Keep success/error message visible for 5 seconds
    }
  };

  const handleDownloadAll = () => {
    const zip = new JSZip();
    zip.file("spanish_karaoke_data.json", JSON.stringify(karaokeData.spanish, null, 2));
    zip.file("english_karaoke_data.json", JSON.stringify(karaokeData.english, null, 2));
    
    zip.generateAsync({ type: "blob" }).then((content) => {
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'karaoke_data.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
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
        <div className="bg-black/30 p-4 rounded-lg flex-1 min-w-0">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-bold text-textPrimary">{lang === 'spanish' ? 'Spanish' : 'English'} Karaoke Data</h3>
                 <div className="flex items-center gap-2">
                    <button onClick={copyJson} className="p-2 rounded-md hover:bg-white/20 transition"><Icon path="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.153 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM10.5 16.5h-1.5" className="w-5 h-5" /></button>
                    <button onClick={downloadJson} className="p-2 rounded-md hover:bg-white/20 transition"><Icon path="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" className="w-5 h-5" /></button>
                </div>
            </div>
            <pre className="w-full text-xs bg-black/40 p-3 rounded-md h-96 overflow-auto text-slate-300">
                {JSON.stringify(data, null, 2)}
            </pre>
        </div>
    );
  };
  
  return (
      <div className="space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-4">
            <h2 className="text-2xl font-bold">Generated Data Files</h2>
            <div className="flex items-center gap-4">
              <ActionButton onClick={handleRefineBoth} disabled={isRefining} icon={"M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"} className="px-4 py-2 text-base">
                {isRefining ? 'Processing...' : 'Refine Both with AI Review'}
              </ActionButton>
              <ActionButton onClick={handleDownloadAll} icon="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" className="px-4 py-2 text-base">
                Download All (.zip)
              </ActionButton>
            </div>
          </div>
          {isRefining && (
            <div className="p-4 bg-black/30 rounded-lg">
                <p className="text-textSecondary mb-2 text-center">{refineStatus}</p>
                <div className="w-full bg-black/40 rounded-full h-2.5">
                    <div className="bg-secondary h-2.5 rounded-full transition-all duration-500" style={{ width: `${refineProgress}%` }}></div>
                </div>
            </div>
          )}
          <div className="space-y-4 md:space-y-0 md:flex md:gap-6">
              <JsonDisplay lang="spanish" data={karaokeData.spanish} />
              <JsonDisplay lang="english" data={karaokeData.english} />
          </div>
      </div>
  );
};

interface VocabularyPlaceholderProps {
  onGenerate: () => void;
  isGenerating: boolean;
}

const VocabularyPlaceholder: React.FC<VocabularyPlaceholderProps> = ({ onGenerate, isGenerating }) => (
    <div className="bg-black/20 p-8 sm:p-12 rounded-lg text-center">
        <div className="max-w-md mx-auto space-y-6">
            {isGenerating ? (
                <>
                    <div className="animate-pulse">
                        <Icon path="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" className="w-16 h-16 mx-auto text-secondary" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-textPrimary mb-2">Analyzing Lyrics...</h3>
                        <p className="text-textSecondary">
                            AI is extracting culturally significant slang, idioms, and expressions.
                            This usually takes 10-30 seconds.
                        </p>
                    </div>
                </>
            ) : (
                <>
                    <Icon path="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" className="w-16 h-16 mx-auto text-secondary/50" />
                    <div>
                        <h3 className="text-xl font-bold text-textPrimary mb-2">Extract Key Vocabulary</h3>
                        <p className="text-textSecondary">
                            Use AI to identify culturally significant slang, idioms, and expressions from the lyrics
                            — perfect for language learning!
                        </p>
                    </div>
                    <p className="text-sm text-textSecondary/70">
                        Tip: Generate vocabulary after you're satisfied with the karaoke timing accuracy.
                    </p>
                    <ActionButton
                        onClick={onGenerate}
                        disabled={isGenerating}
                        icon="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
                        className="px-8 py-3"
                    >
                        Generate Vocabulary
                    </ActionButton>
                </>
            )}
        </div>
    </div>
);

interface VocabularyDisplayProps {
  vocabularyList: VocabularyItem[];
  onPlayRequest: (request: { startTimeMs: number, endTimeMs: number }) => void;
}

const VocabularyDisplay: React.FC<VocabularyDisplayProps> = ({ vocabularyList, onPlayRequest }) => {
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
                            <th className="p-3 text-center w-20">Play</th>
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
                                <td className="p-3 align-top text-center">
                                  <button
                                    onClick={() => onPlayRequest({ startTimeMs: item.startTimeMs, endTimeMs: item.endTimeMs })}
                                    className="p-2 rounded-full bg-secondary/20 text-secondary hover:bg-secondary hover:text-background transition transform hover:scale-110"
                                    title="Play audio for this line"
                                  >
                                    <Icon path="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" className="w-5 h-5" />
                                  </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const Footer: React.FC<{ buildTimestamp: string }> = ({ buildTimestamp }) => (
    <footer className="text-center text-xs text-textSecondary/50 w-full max-w-5xl">
        <p>Version {__APP_VERSION__} | Build: {buildTimestamp}</p>
    </footer>
);

export default App;