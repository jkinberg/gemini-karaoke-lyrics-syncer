import React, { useState, useCallback, useRef, useEffect } from 'react';
import JSZip from 'jszip';
import { generateKaraokeData, translateLyrics, generateVocabularyList } from './services/geminiService';
import type { KaraokeData, KaraokeApiResponse, VocabularyItem, KaraokeSegment } from './types';

const placeholderSpanish = `[Estrofa 1]
El sol se pone en el horizonte
Pintando el cielo de color carmesí
Un día más que llega a su fin
Y pienso en ti, solo en ti

[Estribillo]
Eres la melodía en mi canción
El faro que guía mi corazón
En cada nota, en cada rincón
Encuentro tu amor, mi única razón`;

const placeholderEnglish = `[Verse 1]
The sun sets on the horizon
Painting the sky crimson
One more day that comes to an end
And I think of you, only you

[Chorus]
You are the melody in my song
The lighthouse that guides my heart
In every note, in every corner
I find your love, my only reason`;

const Header: React.FC = () => (
  <header className="py-6 text-center">
    <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
      Karaoke Syncer AI
    </h1>
    <p className="mt-3 text-lg text-textSecondary max-w-2xl mx-auto">
      Upload an audio file and provide lyrics to generate perfectly synchronized, timed karaoke files using AI.
    </p>
  </header>
);

const CopyIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
);

const DownloadIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
);

const ArchiveIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" />
        <path fillRule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd" />
    </svg>
);

const UploadIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
);

const FileMusicIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l10-3v13m-10 0l10-3m-10 0a2 2 0 100 4 2 2 0 000-4z" />
    </svg>
);

const TranslateIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m4 13-4-4-4 4M19 5h-2a2 2 0 00-2 2v10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2z" />
    </svg>
);

const SpinnerIcon: React.FC = () => (
    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

const ClearIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const PlayIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
    </svg>
);

const PauseIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1zm4 0a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
);

const ChevronDownIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
);


const formatDuration = (seconds: number | null): string => {
    if (seconds === null || isNaN(seconds)) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

interface AudioInputProps {
  audioFile: File | null;
  setAudioFile: (file: File | null) => void;
  audioDuration: number | null;
  setAudioDuration: (duration: number | null) => void;
  setError: (error: string | null) => void;
}

const AudioInput: React.FC<AudioInputProps> = ({ audioFile, setAudioFile, audioDuration, setAudioDuration, setError }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const validTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/mp4', 'video/mp4', 'audio/x-m4a', 'audio/aac', 'audio/opus', 'audio/3gpp', 'video/3gpp'];

  const handleFile = (file: File) => {
    if (file && validTypes.includes(file.type)) {
      setIsAnalyzing(true);
      setError(null);
      setAudioFile(null);
      setAudioDuration(null);

      const reader = new FileReader();
      reader.onload = (e) => {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContext.decodeAudioData(arrayBuffer)
          .then(audioBuffer => {
            setAudioDuration(audioBuffer.duration);
            setAudioFile(file);
            setError(null);
          })
          .catch(() => {
            setError("Could not analyze the audio file. It may be corrupt or an unsupported format.");
            setAudioFile(null);
            setAudioDuration(null);
          }).finally(() => {
            setIsAnalyzing(false);
          });
      };
      reader.onerror = () => {
        setError("Failed to read the audio file.");
        setAudioFile(null);
        setAudioDuration(null);
        setIsAnalyzing(false);
      };
      reader.readAsArrayBuffer(file);

    } else {
      setError('Invalid file type. Please upload one of the supported formats: MP3, WAV, OGG, FLAC, M4A, AAC, OPUS, 3GP.');
    }
  };

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
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  if (audioFile) {
    return (
      <div className="p-4 bg-surface border border-emerald-700 rounded-lg flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <FileMusicIcon />
          <div>
            <p className="font-semibold text-textPrimary">{audioFile.name}</p>
            <p className="text-sm text-textSecondary">
              {(audioFile.size / 1024 / 1024).toFixed(2)} MB / {formatDuration(audioDuration)}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setAudioFile(null);
            setAudioDuration(null);
          }}
          className="px-3 py-1 text-xs font-medium bg-red-800 hover:bg-red-700 rounded-md transition duration-200"
        >
          Remove
        </button>
      </div>
    );
  }

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`relative p-8 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors duration-200 ${isDragging ? 'border-primary bg-blue-900/50' : 'border-gray-600 hover:border-gray-500'}`}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={validTypes.join(',')}
        onChange={handleChange}
        disabled={isAnalyzing}
      />
      {isAnalyzing && (
        <div className="absolute inset-0 bg-surface/80 flex items-center justify-center rounded-lg">
            <p className="text-textSecondary animate-pulse">Analyzing audio...</p>
        </div>
      )}
      <div className="flex flex-col items-center justify-center space-y-2">
        <UploadIcon />
        <p className="font-semibold text-textPrimary">Drag & drop your audio file here</p>
        <p className="text-sm text-textSecondary">or click to browse</p>
        <p className="text-xs text-gray-500 mt-1">Supported: MP3, WAV, OGG, FLAC, M4A, AAC, OPUS, 3GP</p>
      </div>
    </div>
  );
};

interface LyricsInputProps {
  id: string;
  label: string;
  lang: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
}

const LyricsInput: React.FC<LyricsInputProps> = ({ id, label, lang, value, onChange, placeholder }) => (
  <div className="flex flex-col space-y-2">
    <label htmlFor={id} className="text-sm font-medium text-textSecondary flex items-center">
      {label} <span className="ml-2 text-xs bg-gray-600 px-2 py-0.5 rounded">{lang}</span>
    </label>
    <textarea
      id={id}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full h-64 p-4 bg-surface border border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition duration-200 resize-none font-mono text-sm"
    />
  </div>
);

interface OutputDisplayProps {
  title: string;
  data: KaraokeData | null;
  filename: string;
}

const OutputDisplay: React.FC<OutputDisplayProps> = ({ title, data, filename }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!data) return;
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!data || !filename) return;
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-surface rounded-lg border border-gray-700 overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 p-4 bg-gray-800 border-b border-gray-700">
        <h3 className="font-semibold text-textPrimary truncate">{title}</h3>
        <div className="flex items-center space-x-2 flex-shrink-0">
           <button
             onClick={handleCopy}
             disabled={!data}
             title="Copy JSON"
             className="flex items-center justify-center px-3 py-1.5 text-xs font-medium bg-gray-600 hover:bg-gray-500 rounded-md transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
           >
             {copied ? 'Copied!' : <><CopyIcon /> <span className="hidden sm:inline ml-2">Copy</span></>}
           </button>
           <button
               onClick={handleDownload}
               disabled={!data}
               title="Download JSON"
               className="flex items-center justify-center px-3 py-1.5 text-xs font-medium bg-secondary hover:bg-emerald-600 rounded-md transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
           >
               <DownloadIcon />
               <span className="hidden sm:inline ml-2">Download</span>
           </button>
        </div>
      </div>
      <pre className="p-4 text-xs text-textSecondary overflow-x-auto h-96">
        {data ? JSON.stringify(data, null, 2) : 'JSON output will appear here...'}
      </pre>
    </div>
  );
};

const DifficultyBar: React.FC<{ score: number }> = ({ score }) => {
  const normalizedScore = Math.max(1, Math.min(10, score));
  const hue = 120 - normalizedScore * 12; // 120 (green) to 0 (red)
  const backgroundColor = `hsl(${hue}, 70%, 50%)`;

  return (
    <div className="w-24 bg-gray-600 rounded-full h-2.5" title={`Difficulty: ${score}/10`}>
      <div
        className="h-2.5 rounded-full"
        style={{ width: `${normalizedScore * 10}%`, backgroundColor }}
      ></div>
    </div>
  );
};

const HighlightedText: React.FC<{ text?: string; highlight?: string }> = ({ text = '', highlight = '' }) => {
  if (!highlight.trim() || !text.toLowerCase().includes(highlight.toLowerCase())) {
    return <>{text}</>;
  }
  const regex = new RegExp(`(${highlight})`, 'gi');
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === highlight.toLowerCase() ? (
          <strong key={i} className="font-bold text-emerald-400">{part}</strong>
        ) : (
          part
        )
      )}
    </>
  );
};


const VocabularyDisplay: React.FC<{ vocabList: VocabularyItem[] | null, isLoading: boolean }> = ({ vocabList, isLoading }) => {
  const handleDownloadCsv = () => {
    if (!vocabList || vocabList.length === 0) return;

    const headers = ['Spanish Term', 'English Term', 'Definition', 'Difficulty', 'Spanish Example', 'English Example'];
    const csvRows = [headers.join(',')];

    const escapeCsvCell = (cell: string) => `"${cell.replace(/"/g, '""')}"`;
    
    const transformTextForCsvHighlight = (text: string = '', highlight: string = ''): string => {
        if (!highlight.trim() || !text.toLowerCase().includes(highlight.toLowerCase())) {
            return text;
        }
        const regex = new RegExp(`(${highlight})`, 'gi');
        return text.replace(regex, `**$1**`);
    };

    vocabList.forEach(item => {
      const row = [
        escapeCsvCell(item.term.spanish),
        escapeCsvCell(item.term.english),
        escapeCsvCell(item.definition),
        item.difficulty.toString(),
        escapeCsvCell(transformTextForCsvHighlight(item.example.spanish, item.highlight.spanish)),
        escapeCsvCell(transformTextForCsvHighlight(item.example.english, item.highlight.english))
      ];
      csvRows.push(row.join(','));
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'vocabulary.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  
  const handleDownloadJson = () => {
    if (!vocabList || vocabList.length === 0) return;

    const transformTextForJsonHighlight = (text: string = '', highlight: string = ''): { text: string; highlight: boolean }[] => {
        if (!highlight.trim() || !text.toLowerCase().includes(highlight.toLowerCase())) {
            return [{ text, highlight: false }];
        }
        const regex = new RegExp(`(${highlight})`, 'gi');
        const parts = text.split(regex);
        
        return parts.filter(part => part).map((part) => ({
            text: part,
            highlight: part.toLowerCase() === highlight.toLowerCase(),
        }));
    };

    const exportableData = vocabList.map(({ term, definition, difficulty, example, highlight }) => ({
        term,
        definition,
        difficulty,
        example: {
            spanish: transformTextForJsonHighlight(example.spanish, highlight.spanish),
            english: transformTextForJsonHighlight(example.english, highlight.english),
        },
    }));

    const jsonString = JSON.stringify(exportableData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'vocabulary.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mt-8 border-t border-gray-700 pt-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-4">
        <h2 className="text-2xl font-bold text-center sm:text-left">Key Vocabulary Learnings</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadJson}
            disabled={!vocabList || vocabList.length === 0}
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md transition duration-300 disabled:bg-gray-700 disabled:cursor-not-allowed disabled:text-gray-400"
          >
            <DownloadIcon />
            <span className="ml-2">Download as JSON</span>
          </button>
          <button
            onClick={handleDownloadCsv}
            disabled={!vocabList || vocabList.length === 0}
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-secondary hover:bg-emerald-600 rounded-lg shadow-md transition duration-300 disabled:bg-gray-700 disabled:cursor-not-allowed disabled:text-gray-400"
          >
            <DownloadIcon />
            <span className="ml-2">Download as CSV</span>
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="text-center p-8 bg-surface rounded-lg">
          <p className="text-textSecondary animate-pulse">Generating vocabulary list...</p>
        </div>
      )}

      {!isLoading && vocabList && vocabList.length > 0 && (
         <div className="bg-surface rounded-lg border border-gray-700 overflow-x-auto">
          <table className="w-full text-sm text-left text-textSecondary">
            <thead className="text-xs text-textPrimary uppercase bg-gray-800">
              <tr>
                <th scope="col" className="px-6 py-3">Term</th>
                <th scope="col" className="px-6 py-3">English Definition</th>
                <th scope="col" className="px-6 py-3">Example from Lyrics</th>
                <th scope="col" className="px-6 py-3">Difficulty</th>
              </tr>
            </thead>
            <tbody>
              {vocabList.map((item, index) => (
                <tr key={index} className="bg-surface border-b border-gray-700 hover:bg-gray-800/50">
                  <th scope="row" className="px-6 py-4 font-medium text-textPrimary whitespace-nowrap">
                    <span className="block">{item.term.spanish}</span>
                    <span className="block text-gray-400 font-normal">({item.term.english})</span>
                  </th>
                  <td className="px-6 py-4">{item.definition}</td>
                  <td className="px-6 py-4 italic text-textPrimary">
                    <span className="block">"<HighlightedText text={item.example.spanish} highlight={item.highlight.spanish} />"</span>
                    <span className="block text-gray-400 mt-1">"<HighlightedText text={item.example.english} highlight={item.highlight.english} />"</span>
                  </td>
                  <td className="px-6 py-4">
                    <DifficultyBar score={item.difficulty} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && (!vocabList || vocabList.length === 0) && (
        <div className="text-center p-8 bg-surface rounded-lg">
          <p className="text-textSecondary">Vocabulary list will appear here after generation.</p>
        </div>
      )}
    </div>
  );
};


interface ProgressBarProps {
  progress: number;
}
const ProgressBar: React.FC<ProgressBarProps> = ({ progress }) => (
  <div className="w-full bg-surface rounded-full h-2.5 my-4 border border-gray-700 overflow-hidden">
    <div
      className="bg-gradient-to-r from-blue-500 to-emerald-500 h-2.5 rounded-full transition-all duration-500 ease-out"
      style={{ width: `${progress}%` }}
    ></div>
  </div>
);

// --- KARAOKE PREVIEW COMPONENTS ---

interface LyricPanelProps {
  segments: KaraokeSegment[];
  currentTimeMs: number;
  language: string;
  onSeekTo: (timeMs: number) => void;
}

const LyricPanel: React.FC<LyricPanelProps> = ({ segments, currentTimeMs, language, onSeekTo }) => {
  const activeSegmentRef = useRef<HTMLDivElement>(null);

  const activeSegmentIndex = segments.findIndex(
    (s) => currentTimeMs >= s.startTimeMs && currentTimeMs < s.endTimeMs
  );

  useEffect(() => {
    if (activeSegmentRef.current) {
      activeSegmentRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeSegmentIndex]);

  return (
    <div className="h-64 overflow-y-auto p-4 rounded-lg bg-black/30 scroll-smooth">
      <h3 className="text-lg font-bold text-center mb-4 sticky top-0 bg-surface/80 backdrop-blur-sm py-2">{language}</h3>
      <div className="flex flex-col gap-4 text-center">
        {segments.map((segment, index) => {
          const isActive = index === activeSegmentIndex;
          const isPast = index < activeSegmentIndex;

          let lineContent;
          if (segment.type === 'INSTRUMENTAL') {
            lineContent = <span className="italic">♪ {segment.cueText} ♪</span>;
          } else if (segment.text && segment.words && segment.words.length > 0) {
            if (isActive) {
              // Refactored logic for active, timed lines
              const normalize = (s: string) => s.replace(/[.,!?'"¡¿-]/g, "").toLowerCase();
              const lineParts = segment.text.split(/(\s+)/);
              let timedWordIdx = 0;

              lineContent = lineParts.map((part, partIndex) => {
                if (!part.trim()) {
                  return <React.Fragment key={`space-${partIndex}`}>{part}</React.Fragment>;
                }
                
                if (timedWordIdx < segment.words.length) {
                  const timedWord = segment.words[timedWordIdx];
                  if (normalize(part) === normalize(timedWord.word)) {
                    const isCurrentWord = currentTimeMs >= timedWord.startTimeMs && currentTimeMs < timedWord.endTimeMs;
                    const isPastWord = currentTimeMs >= timedWord.endTimeMs;
                    const wordClass = isCurrentWord
                        ? "text-emerald-400 font-bold"
                        : isPastWord
                        ? "text-textPrimary"
                        : "text-textSecondary";
                    
                    timedWordIdx++;
                    return (
                        <span key={`word-${partIndex}`} className={`transition-colors duration-100 ${wordClass}`}>
                            {part}
                        </span>
                    );
                  }
                }
                
                // For unmatched parts within an active line, treat them as upcoming.
                return (
                    <span key={`unmatched-${partIndex}`} className="transition-colors duration-100 text-textSecondary">
                        {part}
                    </span>
                );
              });
            } else {
              // Inactive timed line, just show the text.
              lineContent = <span>{segment.text}</span>;
            }
          } else {
            // Fallback for any other case (e.g., lyric line without text or words)
            lineContent = <span>{segment.text || ''}</span>;
          }

          return (
            <div
              key={segment.segmentIndex}
              ref={isActive ? activeSegmentRef : null}
              onClick={() => onSeekTo(segment.startTimeMs)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSeekTo(segment.startTimeMs); }}
              className={`transition-all duration-300 ease-in-out p-2 rounded-md cursor-pointer hover:bg-white/10 ${isActive ? 'text-textPrimary font-bold text-2xl' : isPast ? 'text-gray-600 text-lg' : 'text-textSecondary text-lg'}`}
            >
              {lineContent}
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface KaraokePreviewProps {
  karaokeData: KaraokeApiResponse;
  audioFile: File;
}

const KaraokePreview: React.FC<KaraokePreviewProps> = ({ karaokeData, audioFile }) => {
    const [isOpen, setIsOpen] = useState(false);
    const audioRef = useRef<HTMLAudioElement>(null);
    const animationFrameRef = useRef<number | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0); // in seconds
    const [duration, setDuration] = useState(0);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio || !audioFile) return;

        const objectUrl = URL.createObjectURL(audioFile);
        audio.src = objectUrl;

        const handleLoadedMetadata = () => setDuration(audio.duration);
        const handleEnded = () => setIsPlaying(false);

        audio.addEventListener('loadedmetadata', handleLoadedMetadata);
        audio.addEventListener('ended', handleEnded);

        return () => {
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.removeEventListener('ended', handleEnded);
            URL.revokeObjectURL(objectUrl);
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [audioFile]);

    const animate = useCallback(() => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
            animationFrameRef.current = requestAnimationFrame(animate);
        }
    }, []);

    const togglePlayPause = () => {
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
      const newTime = parseFloat(e.target.value);
      if (audioRef.current) {
        audioRef.current.currentTime = newTime;
        setCurrentTime(newTime);
      }
    };
    
    const handleSeekTo = (timeMs: number) => {
        const newTime = timeMs / 1000;
        if (audioRef.current) {
            audioRef.current.currentTime = newTime;
            setCurrentTime(newTime);
        }
    };

    return (
        <div className="mt-8 border-t border-gray-700 pt-8">
            <audio ref={audioRef} />
            <div className="bg-surface rounded-lg border border-gray-700">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full flex justify-between items-center p-4 bg-gray-800 hover:bg-gray-800/80 transition-colors"
                >
                    <h2 className="text-2xl font-bold">Preview Synchronization</h2>
                    <ChevronDownIcon className={`transform transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                    <div className="p-4 space-y-4">
                        <div className="flex items-center gap-4">
                            <button onClick={togglePlayPause} className="text-emerald-400 hover:text-emerald-300 transition-colors">
                                {isPlaying ? <PauseIcon /> : <PlayIcon />}
                            </button>
                            <span className="text-sm font-mono">{formatDuration(currentTime)}</span>
                            <input
                                type="range"
                                min="0"
                                max={duration || 0}
                                value={currentTime}
                                onChange={handleSeek}
                                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                            />
                            <span className="text-sm font-mono">{formatDuration(duration)}</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <LyricPanel segments={karaokeData.spanish.segments} currentTimeMs={currentTime * 1000} language="Spanish" onSeekTo={handleSeekTo} />
                            <LyricPanel segments={karaokeData.english.segments} currentTimeMs={currentTime * 1000} language="English" onSeekTo={handleSeekTo} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const App: React.FC = () => {
  const [spanishLyrics, setSpanishLyrics] = useState<string>('');
  const [englishLyrics, setEnglishLyrics] = useState<string>('');
  const [languageFlow, setLanguageFlow] = useState<'es-en' | 'en-es'>('es-en');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [karaokeData, setKaraokeData] = useState<KaraokeApiResponse | null>(null);
  const [vocabularyList, setVocabularyList] = useState<VocabularyItem[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [isGeneratingVocab, setIsGeneratingVocab] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const progressIntervalRef = useRef<number | null>(null);
  const DURATION_WARNING_THRESHOLD = 600; // 10 minutes
  const buildVersion = '1.1.0';
  const buildTimestamp = new Date().toISOString();

  const handleTranslate = useCallback(async () => {
      setError(null);
      setIsTranslating(true);

      const sourceLang = languageFlow === 'es-en' ? 'es' : 'en';
      const targetLang = languageFlow === 'es-en' ? 'en' : 'es';
      const sourceText = languageFlow === 'es-en' ? spanishLyrics : englishLyrics;

      if (!sourceText.trim()) {
        setError("Source lyrics are empty, cannot translate.");
        setIsTranslating(false);
        return;
      }

      try {
        const translatedText = await translateLyrics(sourceText, sourceLang, targetLang);
        if (targetLang === 'en') {
          setEnglishLyrics(translatedText);
        } else {
          setSpanishLyrics(translatedText);
        }
      } catch (err) {
         if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('An unknown error occurred during translation.');
        }
      } finally {
        setIsTranslating(false);
      }
  }, [languageFlow, spanishLyrics, englishLyrics]);

  const handleSubmit = useCallback(async () => {
    if (!audioFile) {
        setError('Please upload an audio file first.');
        return;
    }
    if (!spanishLyrics || !englishLyrics) {
      setError('Please provide both Spanish and English lyrics.');
      return;
    }
    
    setKaraokeData(null);
    setVocabularyList(null);
    setError(null);
    setIsLoading(true);
    setProgress(0);
    setStatusMessage('Kicking off the process...');
    
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

    progressIntervalRef.current = window.setInterval(() => {
      setProgress(prev => {
        if (prev >= 95) {
          // The interval will be cleared by other logic when isLoading becomes false.
          return 95;
        }
        if (prev < 60) return prev + (Math.random() * 5 + 1);
        if (prev < 85) return prev + (Math.random() * 2 + 1);
        return prev + 0.5;
      });
    }, 400);

    const sanitizeLyrics = (text: string) => {
      return text.replace(/[^\p{L}\p{N}\s.,!?'"()[\]-]/gu, '');
    };
    
    setStatusMessage('Sanitizing lyric inputs...');
    const originalLyricsRaw = languageFlow === 'es-en' ? spanishLyrics : englishLyrics;
    const translatedLyricsRaw = languageFlow === 'es-en' ? englishLyrics : spanishLyrics;

    const originalLyrics = sanitizeLyrics(originalLyricsRaw);
    const translatedLyrics = sanitizeLyrics(translatedLyricsRaw);

    try {
      const result = await generateKaraokeData(audioFile, originalLyrics, translatedLyrics, languageFlow, setStatusMessage);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      setProgress(100);
      setKaraokeData(result);
      
      // Now, generate vocabulary
      setIsGeneratingVocab(true);
      try {
        const vocab = await generateVocabularyList(spanishLyrics, englishLyrics);
        setVocabularyList(vocab);
      } catch (vocabErr) {
        console.error("Could not generate vocabulary list:", vocabErr);
        // Do not set main error, just log it. The primary feature still succeeded.
      } finally {
        setIsGeneratingVocab(false);
      }

      setTimeout(() => {
        setIsLoading(false);
      }, 500);

    } catch (err: unknown) {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred.');
      }
      setIsLoading(false);
    }
  }, [audioFile, spanishLyrics, englishLyrics, languageFlow]);

  const handleDownloadAll = useCallback(() => {
    if (!karaokeData) return;

    const zip = new JSZip();
    zip.file(
      "spanish_karaoke_data.json",
      JSON.stringify(karaokeData.spanish, null, 2)
    );
    zip.file(
      "english_karaoke_data.json",
      JSON.stringify(karaokeData.english, null, 2)
    );

    if (vocabularyList && vocabularyList.length > 0) {
      // Logic for vocabulary.json
      const transformTextForJsonHighlight = (text: string = '', highlight: string = ''): { text: string; highlight: boolean }[] => {
          if (!highlight.trim() || !text.toLowerCase().includes(highlight.toLowerCase())) {
              return [{ text, highlight: false }];
          }
          const regex = new RegExp(`(${highlight})`, 'gi');
          const parts = text.split(regex);
          return parts.filter(part => part).map((part) => ({
              text: part,
              highlight: part.toLowerCase() === highlight.toLowerCase(),
          }));
      };
      const exportableJsonData = vocabularyList.map(({ term, definition, difficulty, example, highlight }) => ({
          term,
          definition,
          difficulty,
          example: {
              spanish: transformTextForJsonHighlight(example.spanish, highlight.spanish),
              english: transformTextForJsonHighlight(example.english, highlight.english),
          },
      }));
      const jsonString = JSON.stringify(exportableJsonData, null, 2);
      zip.file("vocabulary.json", jsonString);

      // Logic for vocabulary.csv
      const headers = ['Spanish Term', 'English Term', 'Definition', 'Difficulty', 'Spanish Example', 'English Example'];
      const csvRows = [headers.join(',')];
      const escapeCsvCell = (cell: string) => `"${cell.replace(/"/g, '""')}"`;
      const transformTextForCsvHighlight = (text: string = '', highlight: string = ''): string => {
          if (!highlight.trim() || !text.toLowerCase().includes(highlight.toLowerCase())) {
              return text;
          }
          const regex = new RegExp(`(${highlight})`, 'gi');
          return text.replace(regex, `**$1**`);
      };
      vocabularyList.forEach(item => {
        const row = [
          escapeCsvCell(item.term.spanish),
          escapeCsvCell(item.term.english),
          escapeCsvCell(item.definition),
          item.difficulty.toString(),
          escapeCsvCell(transformTextForCsvHighlight(item.example.spanish, item.highlight.spanish)),
          escapeCsvCell(transformTextForCsvHighlight(item.example.english, item.highlight.english))
        ];
        csvRows.push(row.join(','));
      });
      const csvString = csvRows.join('\n');
      zip.file("vocabulary.csv", csvString);
    }

    zip.generateAsync({ type: "blob" }).then((content) => {
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'karaoke_and_vocabulary_data.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    });
  }, [karaokeData, vocabularyList]);

  const handleClearAll = useCallback(() => {
    setSpanishLyrics('');
    setEnglishLyrics('');
    setAudioFile(null);
    setAudioDuration(null);
    setKaraokeData(null);
    setVocabularyList(null);
    setIsLoading(false);
    setIsTranslating(false);
    setIsGeneratingVocab(false);
    setError(null);
    setProgress(0);
    setStatusMessage('');
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);
  
  const sourceLyricsEmpty = languageFlow === 'es-en' ? !spanishLyrics.trim() : !englishLyrics.trim();
  const canClear = !!(audioFile || spanishLyrics.trim() || englishLyrics.trim() || karaokeData || error);

  return (
    <div className="min-h-screen bg-background font-sans">
      <main className="container mx-auto px-4 py-8">
        <Header />

        <div className="mt-10">
          <AudioInput 
            audioFile={audioFile} 
            setAudioFile={setAudioFile} 
            audioDuration={audioDuration}
            setAudioDuration={setAudioDuration}
            setError={setError} 
          />
        </div>

        {audioDuration && audioDuration > DURATION_WARNING_THRESHOLD && !isLoading &&(
          <div className="mt-4 p-3 text-center bg-yellow-900/50 border border-yellow-700 text-yellow-300 rounded-lg text-sm">
              <p><strong>Warning:</strong> This audio file is over 10 minutes long ({formatDuration(audioDuration)}). Processing may be slow or fail. For best results, use a shorter file.</p>
          </div>
        )}

        <div className="mt-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4">
            <div>
              <label htmlFor="language-flow" className="block text-sm font-medium text-textSecondary mb-2">
                Language Flow (Original → Translation)
              </label>
              <select
                id="language-flow"
                value={languageFlow}
                onChange={(e) => setLanguageFlow(e.target.value as 'es-en' | 'en-es')}
                className="w-full sm:w-auto p-3 bg-surface border border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition duration-200"
              >
                <option value="es-en">Spanish → English</option>
                <option value="en-es">English → Spanish</option>
              </select>
            </div>
            <div className="mt-4 sm:mt-0 sm:self-end">
                 <button
                    onClick={handleTranslate}
                    disabled={isTranslating || isLoading || sourceLyricsEmpty}
                    className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-gray-600 hover:bg-gray-500 rounded-lg shadow-md transition duration-300 disabled:bg-gray-700 disabled:cursor-not-allowed disabled:text-gray-400"
                >
                    {isTranslating ? <SpinnerIcon /> : <TranslateIcon />}
                    <span className="ml-2">
                      {isTranslating ? 'Translating...' : languageFlow === 'es-en' ? 'Translate to English' : 'Translate to Spanish'}
                    </span>
                </button>
            </div>
          </div>
        </div>
        
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          <LyricsInput
            id="spanish-lyrics"
            label={languageFlow === 'es-en' ? 'Spanish Lyrics (Original)' : 'Spanish Lyrics (Translation)'}
            lang="es-ES"
            value={spanishLyrics}
            onChange={(e) => setSpanishLyrics(e.target.value)}
            placeholder={placeholderSpanish}
          />
          <LyricsInput
            id="english-lyrics"
            label={languageFlow === 'es-en' ? 'English Lyrics (Translation)' : 'English Lyrics (Original)'}
            lang="en-US"
            value={englishLyrics}
            onChange={(e) => setEnglishLyrics(e.target.value)}
            placeholder={'Translation will appear here...'}
          />
        </div>

        <div className="mt-8 flex justify-center items-center gap-4">
          <button
            onClick={handleSubmit}
            disabled={isLoading || !audioFile || isTranslating}
            className="inline-flex items-center justify-center px-8 py-3 text-lg font-semibold text-white bg-primary hover:bg-blue-800 rounded-lg shadow-lg transition duration-300 disabled:bg-gray-500 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Generating...' : 'Generate Synced Files'}
          </button>

           {canClear && !isLoading && (
            <button
              onClick={handleClearAll}
              title="Clear all inputs and results"
              className="inline-flex items-center justify-center px-4 py-3 text-sm font-semibold text-red-300 bg-transparent border border-red-800 hover:bg-red-900/50 rounded-lg transition duration-300"
            >
              <ClearIcon />
              <span className="ml-2">Clear All</span>
            </button>
          )}
        </div>
        
        {isLoading && (
            <div className="mt-6 w-full max-w-xl mx-auto">
                <ProgressBar progress={progress} />
                <p className="text-center text-sm text-textSecondary animate-pulse">
                  {statusMessage}
                </p>
            </div>
        )}

        {error && !isLoading && (
            <div className="mt-6 p-4 text-center bg-red-900/50 border border-red-700 text-red-300 rounded-lg">
                <p><strong>Error:</strong> {error}</p>
            </div>
        )}

        {karaokeData && audioFile && !isLoading && (
          <>
            <div className="mt-8 text-center border-t border-gray-700 pt-8">
                <button
                    onClick={handleDownloadAll}
                    className="inline-flex items-center justify-center px-6 py-2 text-md font-semibold text-white bg-secondary hover:bg-emerald-600 rounded-lg shadow-lg transition duration-300"
                >
                    <ArchiveIcon />
                    <span className="ml-2">Download All (.zip)</span>
                </button>
            </div>
            
            <KaraokePreview karaokeData={karaokeData} audioFile={audioFile} />

            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
              <OutputDisplay
                title="spanish_karaoke_data.json"
                filename="spanish_karaoke_data.json"
                data={karaokeData?.spanish ?? null}
              />
              <OutputDisplay
                title="english_karaoke_data.json"
                filename="english_karaoke_data.json"
                data={karaokeData?.english ?? null}
              />
            </div>

            <VocabularyDisplay vocabList={vocabularyList} isLoading={isGeneratingVocab} />
          </>
        )}
      </main>
      <footer className="text-center py-4 border-t border-gray-800">
        <p className="text-xs text-gray-600">
          Version: {buildVersion} | Build: {buildTimestamp}
        </p>
      </footer>
    </div>
  );
};

export default App;