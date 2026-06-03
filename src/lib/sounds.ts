export type NotificationSoundType = 'classic' | 'crystal' | 'digital' | 'ambient' | 'minimal';

export interface SoundOption {
  id: NotificationSoundType;
  label: string;
  description: string;
}

export const SOUND_OPTIONS: SoundOption[] = [
  { id: 'classic', label: 'Classic Chime', description: 'Sweet, familiar dual-harmonic chime' },
  { id: 'crystal', label: 'Crystal Bell', description: 'Sharp, pure resonance with soft decay' },
  { id: 'digital', label: 'Digital Echo', description: 'Vibrant, ascending electronic beacon' },
  { id: 'ambient', label: 'Ambient Harmony', description: 'Warm, multi-harmonic soft chord' },
  { id: 'minimal', label: 'Minimal Tick', description: 'Subtle, crisp high-frequency clip' }
];

export const playNotificationSound = (type: NotificationSoundType = 'classic') => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = audioCtx.currentTime;

    switch (type) {
      case 'classic': {
        // First high tone
        const osc1 = audioCtx.createOscillator();
        const gain1 = audioCtx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(587.33, now); // D5
        osc1.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5

        gain1.gain.setValueAtTime(0.12, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc1.connect(gain1);
        gain1.connect(audioCtx.destination);
        osc1.start(now);
        osc1.stop(now + 0.35);

        // Second trailing tone
        setTimeout(() => {
          try {
            const ctx2 = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc2 = ctx2.createOscillator();
            const gain2 = ctx2.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(880, ctx2.currentTime); // A5
            osc2.frequency.exponentialRampToValueAtTime(1174.66, ctx2.currentTime + 0.15); // D6

            gain2.gain.setValueAtTime(0.10, ctx2.currentTime);
            gain2.gain.exponentialRampToValueAtTime(0.001, ctx2.currentTime + 0.4);

            osc2.connect(gain2);
            gain2.connect(ctx2.destination);
            osc2.start();
            osc2.stop(ctx2.currentTime + 0.4);
          } catch {}
        }, 120);
        break;
      }
      case 'crystal': {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1567.98, now); // G6
        
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.8);
        break;
      }
      case 'digital': {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.linearRampToValueAtTime(1760, now + 0.15);
        
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.25);
        break;
      }
      case 'ambient': {
        const freqs = [523.25, 659.25, 783.99]; // C5, E5, G5
        freqs.forEach((freq, idx) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.03);
          
          gain.gain.setValueAtTime(0.05, now + idx * 0.03);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6 + idx * 0.05);
          
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(now + idx * 0.03);
          osc.stop(now + 0.6 + idx * 0.05);
        });
        break;
      }
      case 'minimal': {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(3000, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.04);
        
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.05);
        break;
      }
    }
  } catch (e) {
    console.warn('Audio synthesis failed, user interaction may be required:', e);
  }
};
