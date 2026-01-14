import React, { useState, useEffect } from 'react';

const mockSong = {
  title: "Tití Me Preguntó",
  artist: "Bad Bunny",
  vocabWords: [
    { word: "bicho", definition: "Puerto Rican slang for 'guy' or 'dude', can also mean 'thing'", lyricContext: "Y me tienen bien bicho", lyricTranslation: "And they've got me acting crazy", unlocked: true },
    { word: "bellaquear", definition: "To flirt aggressively or act provocatively, from 'bellaco' (naughty)", lyricContext: "Ella quiere bellaquear", lyricTranslation: "She wants to get freaky", unlocked: true },
    { word: "perrear", definition: "To dance reggaeton grinding style, essential Puerto Rican club culture", lyricContext: "Vamo' a perrear", lyricTranslation: "Let's dance dirty", unlocked: false },
    { word: "janguear", definition: "Spanglish for 'hang out' - borrowed from English 'hang'", lyricContext: "Salimo' a janguear", lyricTranslation: "We went out to hang", unlocked: false },
    { word: "gata", definition: "Literally 'cat', slang for an attractive, confident woman", lyricContext: "Esa gata está dura", lyricTranslation: "That girl is fire", unlocked: false },
    { word: "flow", definition: "Style, swagger, musical rhythm - universal hip-hop term", lyricContext: "Tengo el flow", lyricTranslation: "I've got the flow", unlocked: false },
  ]
};

const mockLyrics = [
  { spanish: "Yo no sé qué hacer con tantas nenas que me escriben", english: "I don't know what to do with so many girls who text me", vocabWord: null, englishVocabWord: null },
  { spanish: "La disco está llena y llegaron las bellacas", english: "The club is packed and the freaky girls showed up", vocabWord: "bellacas", englishVocabWord: "freaky" },
  { spanish: "Después que me la como ella siempre quiere más", english: "After I devour her she always wants more", vocabWord: null, englishVocabWord: null },
  { spanish: "Ella quiere bellaquear conmigo todas las noches", english: "She wants to get freaky with me every night", vocabWord: "bellaquear", englishVocabWord: "freaky" },
  { spanish: "Vamo' a perrear hasta que salga el sol", english: "Let's dance dirty until the sun comes up", vocabWord: "perrear", englishVocabWord: "dance" },
];

const mockStats = {
  currentStreak: 3,
  longestStreak: 7,
  songsCompleted: 8,
  vocabUnlocked: 24,
  totalVocab: 42,
  minutesListened: 47
};

const Icons = {
  musicNote: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M9 18V5l12-2v13" stroke="currentColor" strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="6" cy="18" r="3" fill="currentColor"/>
      <circle cx="18" cy="16" r="3" fill="currentColor"/>
    </svg>
  ),
  award: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <circle cx="12" cy="9" r="6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 14.5v7l3-2 3 2v-7" />
    </svg>
  ),
  flame: (
    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
      <path fillRule="evenodd" d="M12.963 2.286a.75.75 0 00-1.071-.136 9.742 9.742 0 00-3.539 6.177A7.547 7.547 0 016.648 6.61a.75.75 0 00-1.152.082A9 9 0 1015.68 4.534a7.46 7.46 0 01-2.717-2.248zM15.75 14.25a3.75 3.75 0 11-7.313-1.172c.628.465 1.35.81 2.133 1a5.99 5.99 0 011.925-3.545 3.75 3.75 0 013.255 3.717z" clipRule="evenodd" />
    </svg>
  ),
  book: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
  ),
  play: (
    <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
      <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
    </svg>
  ),
  playLarge: (
    <svg className="w-10 h-10 ml-1" fill="currentColor" viewBox="0 0 24 24">
      <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
    </svg>
  ),
  chevronLeft: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  ),
  chevronRight: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  ),
  close: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  lock: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  ),
  check: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  ),
  trophy: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0116.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.04 6.04 0 01-2.27.853m0 0a6.052 6.052 0 01-2.27-.853" />
    </svg>
  ),
  music: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V4.5A2.25 2.25 0 0016.5 2.25h-.878a2.25 2.25 0 00-1.948 1.127L9 9m0 0V4.5a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 4.5v3.75" />
    </svg>
  ),
  clock: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
};

export default function KaraokeAppIPhoneV3() {
  const [currentLyricIndex, setCurrentLyricIndex] = useState(0);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [showMetadata, setShowMetadata] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [unlockedCount, setUnlockedCount] = useState(2);
  const [activeVocabSegment, setActiveVocabSegment] = useState(-1);
  const [showVocabToast, setShowVocabToast] = useState(false);
  const [toastWord, setToastWord] = useState('');
  const [activeScreen, setActiveScreen] = useState('player');
  
  const currentLyric = mockLyrics[currentLyricIndex];
  const spanishWords = currentLyric.spanish.split(' ');
  const englishWords = currentLyric.english.split(' ');
  const totalVocab = mockSong.vocabWords.length;
  const allUnlocked = unlockedCount >= totalVocab;

  useEffect(() => {
    const timer = setTimeout(() => setShowMetadata(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setCurrentWordIndex(prev => {
        const maxWords = Math.max(spanishWords.length, englishWords.length);
        if (prev >= maxWords - 1) {
          setCurrentLyricIndex(li => (li + 1) % mockLyrics.length);
          return 0;
        }
        return prev + 1;
      });
    }, 400);
    return () => clearInterval(timer);
  }, [isPlaying, spanishWords.length, englishWords.length]);

  useEffect(() => {
    if (currentLyric.vocabWord) {
      const vocabIndex = mockSong.vocabWords.findIndex(v => v.word === currentLyric.vocabWord || currentLyric.vocabWord.includes(v.word));
      if (vocabIndex !== -1) {
        setActiveVocabSegment(vocabIndex);
        setUnlockedCount(prev => Math.min(vocabIndex + 1, totalVocab));
        setToastWord(currentLyric.vocabWord);
        setShowVocabToast(true);
        setTimeout(() => setShowVocabToast(false), 2000);
      }
    } else {
      setActiveVocabSegment(-1);
    }
  }, [currentLyricIndex]);

  const handleVideoTap = () => {
    setIsPlaying(!isPlaying);
  };

  const ScreenSelector = () => (
    <div className="absolute -top-12 left-0 right-0 flex justify-center gap-2 z-50">
      {['player', 'vocab', 'stats'].map(screen => (
        <button
          key={screen}
          onClick={() => setActiveScreen(screen)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
            activeScreen === screen 
              ? 'bg-purple-500 text-white' 
              : 'bg-zinc-700 text-zinc-300'
          }`}
        >
          {screen.charAt(0).toUpperCase() + screen.slice(1)}
        </button>
      ))}
    </div>
  );

  const PlayerScreen = () => (
    <div className="h-full flex flex-col">
      {/* Top Bar - Above video */}
      <div className="flex-shrink-0 px-4 pt-12 pb-2 flex items-center justify-between bg-black">
        <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
          <path d="M9 18V5l12-2v13" stroke="currentColor" strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="6" cy="18" r="3" fill="currentColor"/>
          <circle cx="18" cy="16" r="3" fill="currentColor"/>
        </svg>
        <button 
          onClick={() => setActiveScreen('stats')}
          className="w-9 h-9 rounded-full flex items-center justify-center text-orange-400 hover:text-orange-300 transition-colors"
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path fillRule="evenodd" d="M12.963 2.286a.75.75 0 00-1.071-.136 9.742 9.742 0 00-3.539 6.177A7.547 7.547 0 016.648 6.61a.75.75 0 00-1.152.082A9 9 0 1015.68 4.534a7.46 7.46 0 01-2.717-2.248zM15.75 14.25a3.75 3.75 0 11-7.313-1.172c.628.465 1.35.81 2.133 1a5.99 5.99 0 011.925-3.545 3.75 3.75 0 013.255 3.717z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* Video Player Area */}
      <div 
        className="relative bg-zinc-900 cursor-pointer flex-shrink-0"
        style={{ height: 180 }}
        onClick={handleVideoTap}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/40 via-black to-red-900/30" />
        
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-20">
            <div className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
              {Icons.playLarge}
            </div>
          </div>
        )}
        
        <div 
          className={`absolute bottom-3 left-4 z-10 transition-opacity duration-1000 ${
            showMetadata ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">Now Playing</div>
          <div className="font-bold text-base leading-tight">{mockSong.title}</div>
          <div className="text-zinc-400 text-sm">{mockSong.artist}</div>
        </div>

        <div className="absolute top-1/2 left-2 -translate-y-1/2 text-zinc-700">
          {Icons.chevronLeft}
        </div>
        <div className="absolute top-1/2 right-2 -translate-y-1/2 text-zinc-700">
          {Icons.chevronRight}
        </div>
      </div>

      {/* Lyrics Display - Fills remaining space */}
      <div className="flex-1 flex flex-col justify-center px-4 py-4">
        {/* Spanish lyric - large, 4-5 words per line */}
        <div className="mb-8">
          <div style={{ fontSize: 38, lineHeight: 1.1, fontWeight: 700 }}>
            {spanishWords.map((word, index) => {
              const isHighlighted = index <= currentWordIndex;
              const isVocab = currentLyric.vocabWord && word.toLowerCase().includes(currentLyric.vocabWord.substring(0, 5));
              const isVocabActive = isVocab && isHighlighted;
              
              return (
                <span 
                  key={index}
                  className={`inline transition-all duration-150 ${
                    isVocabActive 
                      ? 'text-purple-400' 
                      : isVocab
                        ? 'text-purple-900'
                      : isHighlighted 
                        ? 'text-yellow-300' 
                        : 'text-zinc-600'
                  }`}
                  style={{ 
                    fontWeight: isVocab ? 800 : 700,
                    textShadow: isVocabActive ? '0 0 20px rgba(192, 132, 252, 0.8), 0 0 40px rgba(192, 132, 252, 0.5)' : 'none'
                  }}
                >
                  {word}{' '}
                </span>
              );
            })}
          </div>
        </div>

        {/* English translation - noticeably smaller */}
        <div>
          <div style={{ fontSize: 22, lineHeight: 1.25 }}>
            {englishWords.map((word, index) => {
              const isHighlighted = index <= currentWordIndex;
              const isVocab = currentLyric.englishVocabWord && word.toLowerCase().includes(currentLyric.englishVocabWord.toLowerCase());
              const isVocabActive = isVocab && isHighlighted;
              
              return (
                <span 
                  key={index}
                  className={`inline transition-all duration-150 ${
                    isVocabActive
                      ? 'text-purple-400'
                      : isVocab
                        ? 'text-purple-900'
                      : isHighlighted 
                        ? 'text-zinc-400' 
                        : 'text-zinc-700'
                  }`}
                  style={{
                    textShadow: isVocabActive ? '0 0 15px rgba(192, 132, 252, 0.7), 0 0 30px rgba(192, 132, 252, 0.4)' : 'none'
                  }}
                >
                  {word}{' '}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Vocab Toast */}
      <div 
        className={`absolute left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${
          showVocabToast 
            ? 'bottom-28 opacity-100 translate-y-0' 
            : 'bottom-24 opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-2 bg-purple-500 text-white px-4 py-2 rounded-full shadow-lg shadow-purple-500/30 text-sm">
          <span className="font-semibold">{toastWord}</span>
          <span className="text-purple-200">+1 vocab</span>
        </div>
      </div>

      {/* Vocab Bar (Collapsed) */}
      <div className="flex-shrink-0">
        <button 
          onClick={() => setActiveScreen('vocab')}
          className="w-full bg-zinc-900/95 backdrop-blur border-t border-zinc-800 px-4 py-3 pb-8"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-zinc-400">
              {Icons.book}
              <span className="text-sm font-medium">Vocab</span>
            </div>
            
            <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-sm font-semibold transition-all ${
              allUnlocked 
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' 
                : 'bg-zinc-800 text-zinc-300'
            }`}>
              <span>{unlockedCount}/{totalVocab}</span>
            </div>
          </div>
          
          <div className="flex gap-1.5">
            {mockSong.vocabWords.map((vocab, index) => (
              <div 
                key={index}
                className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                  index === activeVocabSegment
                    ? 'bg-purple-400 shadow-[0_0_8px_2px_rgba(168,85,247,0.4)] scale-y-150'
                    : index < unlockedCount
                      ? 'bg-purple-500/80'
                      : 'bg-zinc-700'
                }`}
              />
            ))}
          </div>
        </button>
        
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/30 rounded-full" />
      </div>
    </div>
  );

  const VocabScreen = () => (
    <div className="h-full flex flex-col bg-black">
      <div className="px-4 pt-12 pb-4 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400">
              {Icons.book}
            </div>
            <div>
              <h1 className="text-xl font-bold">Vocabulary</h1>
              <p className="text-sm text-zinc-500">{mockSong.title}</p>
            </div>
          </div>
          <button 
            onClick={() => setActiveScreen('player')}
            className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400"
          >
            {Icons.close}
          </button>
        </div>
        
        <div className="mt-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-zinc-500">Progress</span>
            <span className="text-purple-400 font-semibold">{unlockedCount}/{totalVocab} unlocked</span>
          </div>
          <div className="flex gap-1.5">
            {mockSong.vocabWords.map((_, index) => (
              <div 
                key={index}
                className={`h-2 flex-1 rounded-full ${
                  index < unlockedCount ? 'bg-purple-500' : 'bg-zinc-800'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 pb-10 space-y-3">
        {mockSong.vocabWords.map((vocab, index) => {
          const isUnlocked = index < unlockedCount;
          
          return (
            <div 
              key={index}
              className={`rounded-2xl p-4 transition-all ${
                isUnlocked 
                  ? 'bg-zinc-900' 
                  : 'bg-zinc-900/50'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-2xl font-bold ${isUnlocked ? 'text-purple-400' : 'text-zinc-600'}`}>
                    {vocab.word}
                  </span>
                  {isUnlocked && (
                    <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400">
                      {Icons.check}
                    </div>
                  )}
                </div>
                
                <button 
                  className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
                    isUnlocked 
                      ? 'bg-purple-500 text-white' 
                      : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                  }`}
                  disabled={!isUnlocked}
                >
                  {Icons.play}
                </button>
              </div>
              
              <p className={`text-base mb-3 leading-relaxed ${isUnlocked ? 'text-zinc-300' : 'text-zinc-600'}`}>
                {vocab.definition}
              </p>
              
              {isUnlocked && (
                <div className="bg-black/50 rounded-xl p-3 border-l-2 border-purple-500">
                  <div className="text-purple-300 font-medium">"{vocab.lyricContext}"</div>
                  <div className="text-zinc-500 text-sm mt-1">{vocab.lyricTranslation}</div>
                </div>
              )}
              
              {!isUnlocked && (
                <div className="flex items-center gap-2 text-zinc-600 text-sm">
                  {Icons.lock}
                  <span>Keep listening to unlock</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/30 rounded-full" />
    </div>
  );

  const StatsScreen = () => (
    <div className="h-full flex flex-col bg-black">
      <div className="px-4 pt-12 pb-4 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Your Progress</h1>
          <button 
            onClick={() => setActiveScreen('player')}
            className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400"
          >
            {Icons.close}
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 pb-10">
        <div className="bg-gradient-to-br from-orange-500/20 to-yellow-500/10 rounded-2xl p-5 mb-4 border border-orange-500/20">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-orange-500/20 flex items-center justify-center text-orange-400">
              {Icons.flame}
            </div>
            <div>
              <div className="text-4xl font-black text-orange-400">{mockStats.currentStreak}</div>
              <div className="text-sm text-orange-300/70">Day Streak</div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-orange-500/20 text-sm text-zinc-500">
            Personal best: {mockStats.longestStreak} days
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-zinc-900 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-zinc-500 mb-2">
              {Icons.music}
              <span className="text-xs uppercase tracking-wide">Songs</span>
            </div>
            <div className="text-3xl font-bold">{mockStats.songsCompleted}</div>
            <div className="text-xs text-zinc-600 mt-1">completed</div>
          </div>
          
          <div className="bg-zinc-900 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-zinc-500 mb-2">
              {Icons.book}
              <span className="text-xs uppercase tracking-wide">Vocab</span>
            </div>
            <div className="text-3xl font-bold text-purple-400">{mockStats.vocabUnlocked}</div>
            <div className="text-xs text-zinc-600 mt-1">words learned</div>
          </div>
          
          <div className="bg-zinc-900 rounded-2xl p-4 col-span-2">
            <div className="flex items-center gap-2 text-zinc-500 mb-2">
              {Icons.clock}
              <span className="text-xs uppercase tracking-wide">Time Learning</span>
            </div>
            <div className="text-3xl font-bold">{mockStats.minutesListened} <span className="text-lg font-normal text-zinc-500">min</span></div>
          </div>
        </div>
        
        <div className="mb-4">
          <h2 className="text-lg font-semibold mb-3">Achievements</h2>
          <div className="space-y-2">
            {[
              { name: 'First Song', desc: 'Complete your first song', done: true },
              { name: '10 Words', desc: 'Learn 10 vocabulary words', done: true },
              { name: '7 Day Streak', desc: 'Practice 7 days in a row', done: false },
              { name: 'Song Master', desc: 'Complete 10 songs', done: false },
            ].map((achievement, i) => (
              <div 
                key={i}
                className={`flex items-center gap-3 p-3 rounded-xl ${
                  achievement.done ? 'bg-zinc-900' : 'bg-zinc-900/50'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  achievement.done 
                    ? 'bg-yellow-500/20 text-yellow-400' 
                    : 'bg-zinc-800 text-zinc-600'
                }`}>
                  {Icons.trophy}
                </div>
                <div className="flex-1">
                  <div className={`font-medium ${achievement.done ? 'text-white' : 'text-zinc-500'}`}>
                    {achievement.name}
                  </div>
                  <div className="text-xs text-zinc-600">{achievement.desc}</div>
                </div>
                {achievement.done && (
                  <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center text-green-400">
                    {Icons.check}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        
        <div className="bg-zinc-900 rounded-2xl p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-zinc-500">Overall vocab progress</span>
            <span className="text-purple-400 font-medium">{mockStats.vocabUnlocked}/{mockStats.totalVocab}</span>
          </div>
          <div className="bg-zinc-800 rounded-full h-3 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all"
              style={{ width: `${(mockStats.vocabUnlocked / mockStats.totalVocab) * 100}%` }}
            />
          </div>
        </div>
      </div>
      
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/30 rounded-full" />
    </div>
  );

  return (
    <div className="flex items-center justify-center min-h-screen bg-zinc-800 p-4">
      <div 
        className="relative bg-black rounded-[3rem] overflow-hidden shadow-2xl border-[14px] border-zinc-900"
        style={{ width: 393, height: 852 }}
      >
        <ScreenSelector />
        
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[126px] h-[34px] bg-black rounded-b-3xl z-50" />
        
        <div className="h-full overflow-hidden bg-black text-white font-sans relative">
          {activeScreen === 'player' && <PlayerScreen />}
          {activeScreen === 'vocab' && <VocabScreen />}
          {activeScreen === 'stats' && <StatsScreen />}
        </div>
      </div>
    </div>
  );
}
