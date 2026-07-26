import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { SYSTEM_INSTRUCTION, TOOLS, getApiKey, getDynamicSystemInstruction } from "./geminiService";

export class NovaLiveAssistant {
  private session: any = null;
  private audioContext: AudioContext | null = null;
  private nextStartTime: number = 0;
  private isInterrupted: boolean = false;
  private heartbeatInterval: any = null;
  private isIntentionalDisconnect: boolean = false;

  constructor(
    private onMessage: (text: string) => void,
    private onAudioStart: () => void,
    private onAudioEnd: () => void,
    private onError: (err: any) => void,
    private onFunctionCall: (name: string, args: any) => void,
    private voiceName: string = "Zephyr"
  ) {}

  async connect() {
    this.isIntentionalDisconnect = false;
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Your browser does not support microphone access or it is blocked by security settings.");
      }

      // Request microphone permission with noise suppression and echo cancellation
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      }).catch(err => {
        console.error("getUserMedia error in liveAssistant:", err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDismissedError' || err.name === 'SecurityError') {
          throw err;
        }
        // Try fallback with minimal constraints ONLY if it's a constraint/hardware support error
        return navigator.mediaDevices.getUserMedia({ audio: true });
      });
      
      const apiKey = getApiKey();
      if (!apiKey) {
        throw new Error("Gemini API Key is not configured. Please check your environment variables or add GEMINI_API_KEY in the Settings menu.");
      }
      
      const ai = new GoogleGenAI({ apiKey });
      this.audioContext = new AudioContext({ sampleRate: 16000 });
      
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      this.nextStartTime = this.audioContext.currentTime;

      this.session = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: this.voiceName } },
          },
          systemInstruction: getDynamicSystemInstruction() + "\n\nCRITICAL: You are in PERSISTENT BACKGROUND MODE. Stay focused on the user's voice commands. You are bilingual (Bengali/English). If the user speaks in Bengali, respond in Bengali. Do not disconnect unless explicitly told. AVOID REPETITIVE RESPONSES. Wait for the user to finish speaking. Do not generate multiple responses for a single command. Keep your personality dynamic and helpful.",
          inputAudioTranscription: {
            // Enable transcription for better understanding
          },
        },
        tools: TOOLS,
        toolConfig: {
          includeServerSideToolInvocations: true,
        },
        callbacks: {
          onopen: () => {
            console.log("Live connection opened");
            this.setupMic(stream);
            // Heartbeat to keep connection alive
            this.heartbeatInterval = setInterval(() => {
              if (this.session) {
                this.session.sendRealtimeInput({ text: " " });
              }
            }, 30000);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.modelTurn?.parts) {
              const audioPart = message.serverContent.modelTurn.parts.find(p => p.inlineData);
              const textPart = message.serverContent.modelTurn.parts.find(p => p.text);

              if (textPart?.text) {
                this.onMessage(textPart.text);
              }

              if (audioPart?.inlineData?.data) {
                this.playAudio(audioPart.inlineData.data);
              }
            }

            if (message.toolCall) {
              const calls = message.toolCall.functionCalls;
              if (calls) {
                calls.forEach(call => {
                  this.onFunctionCall(call.name, call.args);
                  // Send response back to model
                  this.session.sendToolResponse({
                    functionResponses: [{
                      name: call.name,
                      response: { result: "Success" },
                      id: call.id
                    }]
                  });
                });
              }
            }

            if (message.serverContent?.interrupted) {
              this.isInterrupted = true;
              this.nextStartTime = this.audioContext?.currentTime || 0;
            }
          },
          onerror: (err) => {
            if (this.isIntentionalDisconnect) return;
            console.error("Live Session Error:", err);
            this.onError(err);
          },
          onclose: () => {
            if (this.isIntentionalDisconnect) return;
            console.log("Live connection closed");
            this.onError(new Error("Live Assistant connection lost."));
          },
        },
      } as any);
    } catch (err: any) {
      console.error("Connection error:", err);
      const isIframe = typeof window !== 'undefined' && window.self !== window.top;
      const iframeTip = isIframe ? " (যেহেতু আপনি অ্যাপটি প্রিভিউ উইন্ডোতে চালাচ্ছেন, ব্রাউজারের সিকিউরিটি পলিসির কারণে মাইক্রোফোন ব্লক হতে পারে। দয়া করে উপরের ডানদিকের 'Open in new tab' বাটনে ক্লিক করে নতুন ট্যাবে অ্যাপটি ওপেন করুন।)" : "";
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDismissedError' || err.name === 'SecurityError') {
        this.onError(new Error("Microphone access denied. Please click the microphone icon in your browser's address bar to grant permission." + iframeTip));
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        this.onError(new Error("No microphone found. Please connect a microphone and try again."));
      } else {
        this.onError(new Error(`System Error: ${err.message || "Unknown error occurred during initialization"}`));
      }
    }
  }

  private setupMic(stream: MediaStream) {
    try {
      if (!this.audioContext) return;
      
      const source = this.audioContext.createMediaStreamSource(stream);
      
      // Add a gain node to boost input if needed
      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = 1.5; // Boost by 50%

      // Add a high-pass filter to remove low-frequency background rumble (noise)
      const filter = this.audioContext.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 150; // Cut off frequencies below 150Hz (typical for voice)
      
      const processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      source.connect(gainNode);
      gainNode.connect(filter);
      filter.connect(processor);
      processor.connect(this.audioContext.destination);

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Simple noise gate: Calculate RMS volume
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        
        // Only send audio if volume is above threshold (0.005 is a safe starting point)
        if (rms > 0.005) {
          const pcmData = this.floatTo16BitPCM(inputData);
          const base64Data = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
          
          if (this.session) {
            this.session.sendRealtimeInput({
              audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
            });
          }
        }
      };
    } catch (err: any) {
      this.onError(err);
    }
  }

  private floatTo16BitPCM(input: Float32Array) {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return output;
  }

  private async playAudio(base64Data: string) {
    if (!this.audioContext) return;
    
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

    const buffer = this.audioContext.createBuffer(1, floatData.length, 24000);
    buffer.getChannelData(0).set(floatData);

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);

    const start = Math.max(this.audioContext.currentTime, this.nextStartTime);
    source.start(start);
    this.nextStartTime = start + buffer.duration;
    
    this.onAudioStart();
    source.onended = () => this.onAudioEnd();
  }

  disconnect() {
    this.isIntentionalDisconnect = true;
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.session) {
      this.session.close();
      this.session = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
