import { tr } from "@/lib/tr";
import { motion, AnimatePresence } from 'framer-motion';
import { Circle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface GroupPresenceBarProps {
  onlineCount: number;
  onlineUsers: Array<{ id: string; name: string; avatar_url?: string }>;
  typingUsers: Array<{ id: string; name: string }>;
}

const GroupPresenceBar = ({ onlineCount, onlineUsers, typingUsers }: GroupPresenceBarProps) => {
  return (
    <div className="flex items-center gap-3 px-5 py-1.5">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <Circle className="w-2 h-2 fill-green-500 text-green-500" />
          <span className="text-[10px] font-bold text-muted-foreground/40">{onlineCount} online</span>
        </div>
        {onlineUsers.length > 0 && (
          <div className="flex -space-x-1.5">
            {onlineUsers.slice(0, 4).map((user, index) => (
              <motion.div key={user.id} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: index * 0.05 }}>
                <Avatar className="w-5 h-5 border-[1.5px] border-background">
                  <AvatarImage src={user.avatar_url} />
                  <AvatarFallback className="bg-primary/10 text-primary text-[8px] font-bold">{user.name.charAt(0)}</AvatarFallback>
                </Avatar>
              </motion.div>
            ))}
            {onlineUsers.length > 4 && (
              <div className="w-5 h-5 rounded-full bg-muted/50 border-[1.5px] border-background flex items-center justify-center">
                <span className="text-[8px] font-bold text-muted-foreground/60">+{onlineUsers.length - 4}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {typingUsers.length > 0 && (
          <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="flex-1 flex items-center gap-1.5">
            {/* Yazır nöqtələri — framer əvəzinə CSS keyframes (yalnız yazarkən mount olunur) */}
            <style>{'@keyframes anacan-typing-dot{0%,100%{transform:scale(1)}50%{transform:scale(1.3)}}'}</style>
            <div className="flex gap-[3px]">
              {[0, 0.15, 0.3].map((delay, i) => (
                <span key={i} className="w-1 h-1 rounded-full bg-primary/60" style={{ animation: `anacan-typing-dot 0.6s ease-in-out ${delay}s infinite` }} />
              ))}
            </div>
            <span className="text-[10px] text-muted-foreground/40 font-medium">
              {typingUsers.length === 1 ? `${typingUsers[0].name} ${tr("community_is_typing", "yazır...")}` : `${typingUsers.length} ${tr("community_people_are_typing", "nəfər yazır...")}`}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GroupPresenceBar;
