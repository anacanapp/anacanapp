import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export interface PendingTimerStop {
  id: string;
  type: string;
  feedType?: 'left' | 'right';
  startTime: number; // ms epoch
  stoppedAt: number; // ms epoch
}

export interface LiveActivityPlugin {
  /** Taymeri kilid ekranında göstər (iOS: Live Activity, Android: FGS bildirişi) */
  startActivity(options: {
    id: string;
    type: string;
    label: string;
    subLabel?: string;   // Android bildiriş alt mətni
    stopLabel?: string;  // Android "Dayandır" düyməsi mətni
    startTime: number;   // ms epoch
    feedType?: string;
    channelName?: string; // Android bildiriş kanalının lokallaşdırılmış adı
    channelDesc?: string; // Android kanal təsviri
  }): Promise<void>;
  /** timerId verilməsə hamısını dayandırır */
  stopActivity(options?: { timerId?: string }): Promise<void>;
  /** Widget/bildirişdən dayandırılmış, hələ emal olunmamış taymerlər */
  getPendingStops(): Promise<{ stops: PendingTimerStop[] }>;
  clearPendingStops(): Promise<void>;
  /** Android: bildiriş düyməsi basılan anda (tətbiq açıqdırsa) */
  addListener(
    eventName: 'timerStopped',
    listener: (stop: PendingTimerStop) => void
  ): Promise<PluginListenerHandle>;
}

const LiveActivity = registerPlugin<LiveActivityPlugin>('LiveActivity');

export default LiveActivity;
