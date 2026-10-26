import { useState, useRef } from 'react';
import { getLocaleTag } from '@/lib/i18n';
import { motion } from 'framer-motion';
import { Play, Pause, Download } from 'lucide-react';

interface ChatMessageBubbleProps {
  message: {
    id: string;
    content: string | null;
    message_type: string;
    created_at: string;
  };
  isMe: boolean;
}

const ChatMessageBubble = ({ message, isMe }: ChatMessageBubbleProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString(getLocaleTag(), { hour: '2-digit', minute: '2-digit' });
  };

  const formatAudioTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleAudio = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleAudioTimeUpdate = () => {
    if (!audioRef.current) return;
    setAudioProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
  };

  const handleAudioLoaded = () => {
    if (!audioRef.current) return;
    setAudioDuration(audioRef.current.duration);
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setAudioProgress(0);
  };

  // Love message
  if (message.message_type === 'love') {
    return (
      <motion.div
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 0.5 }}
        className="text-4xl"
      >
        ❤️
      </motion.div>
    );
  }

  // Image message
  if (message.message_type === 'image' && message.content) {
    return (
      <div className={`max-w-[75%] rounded-2xl overflow-hidden ${isMe ? 'rounded-ee-md' : 'rounded-es-md'}`}>
        <a href={message.content} target="_blank" rel="noopener noreferrer">
          <img
            src={message.content}
            alt="Shared image"
            className="max-w-full max-h-64 object-cover"
            loading="lazy"
          />
        </a>
        <div className={`px-3 py-1.5 ${isMe ? 'bg-primary' : 'bg-muted'}`}>
          <p className={`text-[10px] ${isMe ? 'text-white/70' : 'text-muted-foreground'}`}>
            {formatTime(message.created_at)}
          </p>
        </div>
      </div>
    );
  }

  // Audio message
  if (message.message_type === 'audio' && message.content) {
    return (
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-2xl min-w-[200px] ${
          isMe ? 'bg-primary rounded-ee-md' : 'bg-muted rounded-es-md'
        }`}
      >
        <audio
          ref={audioRef}
          src={message.content}
          onTimeUpdate={handleAudioTimeUpdate}
          onLoadedMetadata={handleAudioLoaded}
          onEnded={handleAudioEnded}
          preload="metadata"
        />
        <motion.button
          onClick={toggleAudio}
          className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
            isMe ? 'bg-white/20' : 'bg-primary/10'
          }`}
          whileTap={{ scale: 0.9 }}
        >
          {isPlaying ? (
            <Pause className={`w-4 h-4 ${isMe ? 'text-white' : 'text-primary'}`} />
          ) : (
            <Play className={`w-4 h-4 ${isMe ? 'text-white' : 'text-primary'}`} />
          )}
        </motion.button>
        <div className="flex-1 min-w-0">
          <div className={`h-1 rounded-full ${isMe ? 'bg-white/30' : 'bg-primary/20'}`}>
            <div
              className={`h-full rounded-full ${isMe ? 'bg-white' : 'bg-primary'}`}
              style={{ width: `${audioProgress}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className={`text-[10px] ${isMe ? 'text-white/70' : 'text-muted-foreground'}`}>
              {formatAudioTime(audioDuration * (audioProgress / 100))}
            </span>
            <span className={`text-[10px] ${isMe ? 'text-white/70' : 'text-muted-foreground'}`}>
              {formatTime(message.created_at)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Text message (default)
  return (
    <div
      className={`max-w-[75%] px-4 py-2.5 rounded-2xl ${
        isMe
          ? 'bg-primary text-white rounded-ee-md'
          : 'bg-muted text-foreground rounded-es-md'
      }`}
    >
      <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
      <p className={`text-[10px] mt-1 ${isMe ? 'text-white/70' : 'text-muted-foreground'}`}>
        {formatTime(message.created_at)}
      </p>
    </div>
  );
};

export default ChatMessageBubble;
