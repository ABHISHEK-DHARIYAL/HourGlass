// Purpose: Web Audio API synth sound generator for offline audio chime notifications

/**
 * Play a high-fidelity synthetic sound using the browser's Web Audio API.
 * This guarantees offline support and pristine, crisp, modern, app-like audio chimes without downloading assets.
 */
export function playNotificationSound(type: 'success' | 'alert' | 'info' | 'break' = 'info') {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    
    const ctx = new AudioContextClass();
    const dest = ctx.destination;
    
    // Synthesize physical-sounding tones
    if (type === 'success') {
      // Elegant warm digital rising chime (major triad)
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);
        
        gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.08);
        gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + idx * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.4);
        
        osc.connect(gain);
        gain.connect(dest);
        
        osc.start(ctx.currentTime + idx * 0.08);
        osc.stop(ctx.currentTime + idx * 0.08 + 0.45);
      });
    } else if (type === 'alert') {
      // Dual-tone high-attention warning alert chime
      const notes = [587.33, 587.33]; // D5
      notes.forEach((freq, idx) => {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc1.type = 'triangle';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.2);
        osc2.frequency.setValueAtTime(freq * 1.5, ctx.currentTime + idx * 0.2);
        
        gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.2);
        gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + idx * 0.2 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.2 + 0.35);
        
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(dest);
        
        osc1.start(ctx.currentTime + idx * 0.2);
        osc2.start(ctx.currentTime + idx * 0.2);
        osc1.stop(ctx.currentTime + idx * 0.2 + 0.4);
        osc2.stop(ctx.currentTime + idx * 0.2 + 0.4);
      });
    } else if (type === 'break') {
      // Relaxation breath-like double-sine hum
      const osc = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(330, ctx.currentTime + 1.2);
      
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(3, ctx.currentTime);
      
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(400, ctx.currentTime);
      
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.5);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.8);
      
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(dest);
      
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 2.0);
    } else {
      // Muted modern ambient notification ping (info)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
      
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      
      osc.connect(gain);
      gain.connect(dest);
      
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.6);
    }
  } catch (e) {
    console.warn('AudioContext playback blocked or failed:', e);
  }
}
