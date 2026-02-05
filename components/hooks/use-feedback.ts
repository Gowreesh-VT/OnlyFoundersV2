import { useCallback } from 'react';

type FeedbackType = 'success' | 'process' | 'error' | 'click' | 'light';

export const useFeedback = () => {
    const triggerHaptic = useCallback((type: FeedbackType = 'click') => {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            switch (type) {
                case 'success':
                    navigator.vibrate([10, 30, 10, 30]);
                    break;
                case 'error':
                    navigator.vibrate([50, 20, 50, 20, 50]);
                    break;
                case 'process':
                    navigator.vibrate([15]);
                    break;
                case 'light':
                    navigator.vibrate(8);
                    break;
                case 'click':
                default:
                    navigator.vibrate(10);
                    break;
            }
        }
    }, []);

    const playSound = useCallback((type: FeedbackType = 'click') => {
        if (typeof window === 'undefined') return;

        try {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContext) return;

            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            const now = ctx.currentTime;

            switch (type) {
                case 'success':
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(587.33, now); // D5
                    osc.frequency.exponentialRampToValueAtTime(1174.66, now + 0.1); // D6
                    gain.gain.setValueAtTime(0.05, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
                    osc.start(now);
                    osc.stop(now + 0.2);
                    break;
                case 'error':
                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(150, now);
                    osc.frequency.exponentialRampToValueAtTime(100, now + 0.2);
                    gain.gain.setValueAtTime(0.1, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
                    osc.start(now);
                    osc.stop(now + 0.2);
                    break;
                case 'click':
                default:
                    osc.type = 'sine'; // Softer click
                    osc.frequency.setValueAtTime(800, now);
                    gain.gain.setValueAtTime(0.03, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
                    osc.start(now);
                    osc.stop(now + 0.05);
                    break;
            }
        } catch (e) {
            console.error('Audio feedback failed', e);
        }
    }, []);

    const trigger = useCallback((type: FeedbackType = 'click') => {
        triggerHaptic(type);
        playSound(type);
    }, [triggerHaptic, playSound]);

    return { trigger, triggerHaptic, playSound };
};
