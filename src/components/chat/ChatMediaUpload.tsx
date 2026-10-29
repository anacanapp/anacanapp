import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Image, Mic, X, Square, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { hapticFeedback } from '@/lib/native';
import { useToast } from '@/hooks/use-toast';
import { createAudioRecorder, getAudioErrorToast, openMicrophone, releaseAudioRecording } from '@/lib/audioRecording';

interface ChatMediaUploadProps {
  onUpload: (type: 'image' | 'audio', url: string) => void;
  disabled?: boolean;
}

const ChatMediaUpload = ({ onUpload, disabled }: ChatMediaUploadProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      recordingControllerRef.current?.abort();
      recordingControllerRef.current = null;
      cleanupRecording();
    };
  }, []);

  const cleanupRecording = () => {
    if (timerRef.current !== null) clearInterval(timerRef.current);
    timerRef.current = null;
    releaseAudioRecording(mediaRecorderRef.current, streamRef.current);
    mediaRecorderRef.current = null;
    streamRef.current = null;
    audioChunksRef.current = [];
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      console.error('Invalid file type');
      return;
    }

    await uploadFile(file, 'image');
  };

  const uploadFile = async (file: Blob, type: 'image' | 'audio', signal?: AbortSignal) => {
    if (!mountedRef.current || signal?.aborted) return;
    setUploading(true);
    void hapticFeedback.light().catch(() => {});

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!mountedRef.current || signal?.aborted) return;
      if (!user) throw new Error('Not authenticated');

      let ext = 'jpg';
      let contentType = 'image/jpeg';
      
      if (type === 'audio') {
        const fileType = file.type || '';
        if (fileType.includes('mp4')) ext = 'mp4';
        else if (fileType.includes('ogg')) ext = 'ogg';
        else if (fileType.includes('webm')) ext = 'webm';
        else ext = 'm4a';
        
        contentType = fileType || 'audio/mp4';
      } else {
        const fileType = file.type || '';
        if (fileType.includes('png')) ext = 'png';
        else if (fileType.includes('gif')) ext = 'gif';
        contentType = fileType || 'image/jpeg';
      }

      const fileName = `${user.id}/${Date.now()}.${ext}`;

      const { data, error } = await supabase.storage
        .from('chat-media')
        .upload(fileName, file, {
          contentType,
          upsert: false
        });

      if (error) throw error;
      if (!mountedRef.current || signal?.aborted) {
        try {
          const { error: removalError } = await supabase.storage.from('chat-media').remove([data.path]);
          if (removalError) throw removalError;
        } catch {
          console.error('Failed to remove cancelled chat media upload');
        }
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('chat-media')
        .getPublicUrl(data.path);

      onUpload(type, publicUrl);
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      if (mountedRef.current && !signal?.aborted) setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const startRecording = async () => {
    if (recordingControllerRef.current || !mountedRef.current || disabled || uploading) return;
    const controller = new AbortController();
    recordingControllerRef.current = controller;
    let stream: MediaStream | null = null;
    try {
      stream = await openMicrophone();
      if (controller.signal.aborted) {
        releaseAudioRecording(null, stream);
        return;
      }
      streamRef.current = stream;

      const mediaRecorder = createAudioRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (!controller.signal.aborted && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (controller.signal.aborted) return;
        const actualMimeType = mediaRecorder.mimeType || audioChunksRef.current[0]?.type;
        const audioBlob = new Blob(audioChunksRef.current, { type: actualMimeType });
        cleanupRecording();
        setIsRecording(false);
        try {
          if (!audioBlob.size || !audioBlob.type) {
            toast(getAudioErrorToast(new Error('No recorded audio or MIME type'), 'audio'));
            return;
          }
          await uploadFile(audioBlob, 'audio', controller.signal);
        } finally {
          if (recordingControllerRef.current === controller) recordingControllerRef.current = null;
        }
      };
      mediaRecorder.onerror = (error) => {
        if (controller.signal.aborted) return;
        cancelRecording();
        toast(getAudioErrorToast(error, 'audio'));
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      void hapticFeedback.medium().catch(() => {});

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error('Failed to start recording:', error);
      cancelRecording();
      toast(getAudioErrorToast(error, stream ? 'audio' : 'microphone'));
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== 'recording') return;
    try {
      recorder.stop();
      setIsRecording(false);
      if (timerRef.current !== null) clearInterval(timerRef.current);
      timerRef.current = null;
      void hapticFeedback.heavy().catch(() => {});
    } catch (error) {
      cancelRecording();
      toast(getAudioErrorToast(error, 'audio'));
    }
  };

  const cancelRecording = () => {
    recordingControllerRef.current?.abort();
    recordingControllerRef.current = null;
    cleanupRecording();
    if (mountedRef.current) {
      setIsRecording(false);
      setRecordingTime(0);
      setUploading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (uploading) {
    return (
      <div className="flex items-center gap-2 px-2">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  if (isRecording) {
    return (
      <div className="flex items-center gap-2 px-2">
        <motion.div
          className="w-3 h-3 rounded-full bg-red-500"
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
        />
        <span className="text-sm text-muted-foreground min-w-[40px]">
          {formatTime(recordingTime)}
        </span>
        <motion.button
          onClick={cancelRecording}
          className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
          whileTap={{ scale: 0.9 }}
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </motion.button>
        <motion.button
          onClick={stopRecording}
          className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center"
          whileTap={{ scale: 0.9 }}
        >
          <Square className="w-3 h-3 text-white fill-white" />
        </motion.button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageSelect}
        className="hidden"
      />
      <motion.button
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
        className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-50"
        whileTap={{ scale: 0.9 }}
      >
        <Image className="w-5 h-5" />
      </motion.button>
      <motion.button
        onClick={startRecording}
        disabled={disabled}
        className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-50"
        whileTap={{ scale: 0.9 }}
      >
        <Mic className="w-5 h-5" />
      </motion.button>
    </div>
  );
};

export default ChatMediaUpload;
