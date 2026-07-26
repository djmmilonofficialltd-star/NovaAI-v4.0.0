export async function playPCM(
  base64Data: string, 
  audioContext: AudioContext, 
  sampleRate: number = 24000,
  onSourceCreated?: (source: AudioBufferSourceNode) => void
) {
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }

  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const pcmData = new Int16Array(bytes.buffer);
  const floatData = new Float32Array(pcmData.length);
  for (let i = 0; i < pcmData.length; i++) {
    floatData[i] = pcmData[i] / 32768.0;
  }

  const buffer = audioContext.createBuffer(1, floatData.length, sampleRate);
  buffer.getChannelData(0).set(floatData);

  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  source.connect(audioContext.destination);
  
  if (onSourceCreated) {
    onSourceCreated(source);
  }

  source.start();

  return new Promise<void>((resolve) => {
    source.onended = () => resolve();
  });
}

export function playCallSound(type: 'ringing' | 'ended' | 'connected' | 'on-hold', audioContext: AudioContext) {
  if (!audioContext) return;
  
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  if (type === 'ringing') {
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
    
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.05, audioContext.currentTime + 0.1);
    gainNode.gain.linearRampToValueAtTime(0.05, audioContext.currentTime + 1.5);
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 1.6);
    
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 2);
  } else if (type === 'ended') {
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.5);
    
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.5);
    
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.5);
  } else if (type === 'connected') {
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.2);
    
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.2);
  } else if (type === 'on-hold') {
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(500, audioContext.currentTime);
    
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.05, audioContext.currentTime + 0.05);
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.2);
    
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.2);
  }
}
