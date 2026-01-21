import React, { useEffect } from 'react';
import type { ProgressData } from '../hooks/useProgress';
import { analytics } from '../utils/analytics';

// Icons
const CloseIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const FlameIcon = ({ className = "w-8 h-8" }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path fillRule="evenodd" d="M12.963 2.286a.75.75 0 00-1.071-.136 9.742 9.742 0 00-3.539 6.177A7.547 7.547 0 016.648 6.61a.75.75 0 00-1.152.082A9 9 0 1015.68 4.534a7.46 7.46 0 01-2.717-2.248zM15.75 14.25a3.75 3.75 0 11-7.313-1.172c.628.465 1.35.81 2.133 1a5.99 5.99 0 011.925-3.545 3.75 3.75 0 013.255 3.717z" clipRule="evenodd" />
  </svg>
);

const TrophyIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path fillRule="evenodd" d="M5.166 2.621v.858c-1.035.148-2.059.33-3.071.543a.75.75 0 00-.584.859 6.753 6.753 0 006.138 5.6 6.73 6.73 0 002.743 1.346A6.707 6.707 0 019.279 15H8.54c-1.036 0-1.875.84-1.875 1.875V19.5h-.75a2.25 2.25 0 00-2.25 2.25c0 .414.336.75.75.75h15.19c.414 0 .75-.336.75-.75a2.25 2.25 0 00-2.25-2.25h-.75v-2.625c0-1.036-.84-1.875-1.875-1.875h-.739a6.706 6.706 0 01-1.112-3.173 6.73 6.73 0 002.743-1.347 6.753 6.753 0 006.139-5.6.75.75 0 00-.585-.858 47.077 47.077 0 00-3.07-.543V2.62a.75.75 0 00-.658-.744 49.22 49.22 0 00-6.093-.377c-2.063 0-4.096.128-6.093.377a.75.75 0 00-.657.744zm0 2.629c0 1.196.312 2.32.857 3.294A5.266 5.266 0 013.16 5.337a45.6 45.6 0 012.006-.343v.256zm13.5 0v-.256c.674.1 1.343.214 2.006.343a5.265 5.265 0 01-2.863 3.207 6.72 6.72 0 00.857-3.294z" clipRule="evenodd" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);

const LockIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
  </svg>
);

const MusicNoteIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
  </svg>
);

const BookIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
  </svg>
);

const ClockIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const FeedbackIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
  </svg>
);

const FEEDBACK_URL = 'https://forms.gle/w81hKnbPLuG2v1eQ8';

interface Achievement {
  id: string;
  title: string;
  description: string;
  isUnlocked: boolean;
}

interface StatsPanelProps {
  progress: ProgressData;
  onClose: () => void;
}

export const StatsPanel: React.FC<StatsPanelProps> = ({
  progress,
  onClose,
}) => {
  // Track stats panel view on mount
  useEffect(() => {
    analytics.statsView({
      songsCompleted: progress.stats.totalSongsCompleted,
      vocabUnlocked: progress.stats.totalVocabUnlocked,
      minutesListened: progress.stats.totalMinutesListened,
      streak: progress.streak.current,
    });
  }, []); // Only track once on mount

  // Define achievements based on progress
  const achievements: Achievement[] = [
    {
      id: 'first-song',
      title: 'First Song',
      description: 'Complete your first song',
      isUnlocked: progress.stats.totalSongsCompleted >= 1,
    },
    {
      id: 'vocab-10',
      title: '10 Words',
      description: 'Unlock 10 vocabulary words',
      isUnlocked: progress.stats.totalVocabUnlocked >= 10,
    },
    {
      id: 'vocab-25',
      title: '25 Words',
      description: 'Unlock 25 vocabulary words',
      isUnlocked: progress.stats.totalVocabUnlocked >= 25,
    },
    {
      id: 'streak-3',
      title: '3 Day Streak',
      description: 'Maintain a 3-day learning streak',
      isUnlocked: progress.streak.longest >= 3,
    },
    {
      id: 'streak-7',
      title: '7 Day Streak',
      description: 'Maintain a 7-day learning streak',
      isUnlocked: progress.streak.longest >= 7,
    },
    {
      id: 'songs-5',
      title: '5 Songs',
      description: 'Complete 5 different songs',
      isUnlocked: progress.stats.totalSongsCompleted >= 5,
    },
  ];

  const unlockedAchievements = achievements.filter((a) => a.isUnlocked).length;

  return (
    <div className="h-dvh flex flex-col bg-black">
      {/* Header - stays fixed at top */}
      <div className="flex-shrink-0 px-4 pt-12 pb-4 border-b border-zinc-800 safe-area-top bg-black">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Your Progress</h1>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-zinc-300 transition-colors"
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      {/* Content - scrollable area with safe area padding at bottom */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 safe-area-bottom">
        {/* Feedback button */}
        <a
          href={FEEDBACK_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-zinc-700 hover:border-zinc-600 text-zinc-400 hover:text-zinc-300 text-sm transition-colors"
        >
          <FeedbackIcon />
          <span>Share your feedback</span>
        </a>

        {/* Streak Card */}
        <div className="bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-2xl p-5 border border-orange-500/30">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-orange-500/20 flex items-center justify-center text-orange-400">
              <FlameIcon className="w-10 h-10" />
            </div>
            <div>
              <div className="text-4xl font-bold text-orange-400">
                {progress.streak.current}
              </div>
              <div className="text-zinc-400 text-sm">Day Streak</div>
              <div className="text-zinc-500 text-xs mt-1">
                Best: {progress.streak.longest} days
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={<MusicNoteIcon />}
            value={progress.stats.totalSongsCompleted}
            label="Songs"
            color="purple"
          />
          <StatCard
            icon={<BookIcon />}
            value={progress.stats.totalVocabUnlocked}
            label="Vocab"
            color="pink"
          />
        </div>

        {/* Time Spent */}
        <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400">
              <ClockIcon />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">
                {progress.stats.totalMinutesListened} min
              </div>
              <div className="text-zinc-500 text-sm">Time Learning</div>
            </div>
          </div>
        </div>

        {/* Achievements Section */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Achievements</h2>
            <span className="text-zinc-500 text-sm">
              {unlockedAchievements}/{achievements.length}
            </span>
          </div>

          <div className="space-y-2">
            {achievements.map((achievement) => (
              <AchievementCard key={achievement.id} achievement={achievement} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

interface StatCardProps {
  icon: React.ReactNode;
  value: number;
  label: string;
  color: 'purple' | 'pink' | 'orange' | 'blue';
}

const StatCard: React.FC<StatCardProps> = ({ icon, value, label, color }) => {
  const colorClasses = {
    purple: 'bg-purple-500/20 text-purple-400',
    pink: 'bg-pink-500/20 text-pink-400',
    orange: 'bg-orange-500/20 text-orange-400',
    blue: 'bg-blue-500/20 text-blue-400',
  };

  return (
    <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
      <div className={`w-10 h-10 rounded-xl ${colorClasses[color]} flex items-center justify-center mb-3`}>
        {icon}
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-zinc-500 text-sm">{label}</div>
    </div>
  );
};

const AchievementCard: React.FC<{ achievement: Achievement }> = ({ achievement }) => {
  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-xl border ${
        achievement.isUnlocked
          ? 'bg-zinc-900 border-yellow-500/30'
          : 'bg-zinc-900/50 border-zinc-800'
      }`}
    >
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center ${
          achievement.isUnlocked
            ? 'bg-yellow-500/20 text-yellow-400'
            : 'bg-zinc-800 text-zinc-600'
        }`}
      >
        <TrophyIcon />
      </div>
      <div className="flex-1">
        <div
          className={`font-semibold ${
            achievement.isUnlocked ? 'text-white' : 'text-zinc-500'
          }`}
        >
          {achievement.title}
        </div>
        <div className="text-zinc-600 text-xs">{achievement.description}</div>
      </div>
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center ${
          achievement.isUnlocked
            ? 'bg-green-500/20 text-green-400'
            : 'bg-zinc-800 text-zinc-600'
        }`}
      >
        {achievement.isUnlocked ? <CheckIcon /> : <LockIcon />}
      </div>
    </div>
  );
};

export default StatsPanel;
