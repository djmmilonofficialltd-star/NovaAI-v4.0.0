import { GoogleGenAI, Modality, GenerateContentResponse, Type, FunctionDeclaration } from "@google/genai";

export const getApiKey = () => {
  const envKey = process.env.GEMINI_API_KEY;
  const localKey = typeof window !== 'undefined' ? localStorage.getItem('gemini_api_key') : null;
  // Provided by user: AIzaSyBDZ82m0LP6XT2K1-xGEyQhzVKMASf1l-E
  const hardcodedKey = "AIzaSyBDZ82m0LP6XT2K1-xGEyQhzVKMASf1l-E";
  return envKey || localKey || hardcodedKey || "";
};

export const getAI = () => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("Gemini API Key is not configured. Please check your environment variables or add GEMINI_API_KEY in the Settings menu.");
  }
  return new GoogleGenAI({ apiKey });
};

export const SYSTEM_INSTRUCTION = `তুমি হলে "Nova AI" (নোভা), একটি অত্যন্ত উন্নত, বুদ্ধিমান এবং সম্পূর্ণ হ্যান্ডস-ফ্রি পার্সোনাল ভয়েস অ্যাসিস্ট্যান্ট। তোমার মূল লক্ষ্য হলো ব্যবহারকারীর কণ্ঠস্বর বা ভয়েস কমান্ড শুনে ফোনের বা সিস্টেমের যাবতীয় কাজ নিজে থেকে সম্পাদন করা, যেন ব্যবহারকারীকে হাত দিয়ে কোনো ক্লিক, ডায়াল বা স্ক্রিন টাচ করতে না হয়।

ভয়েস কমান্ড এক্সিকিউশনের জন্য তোমার বিশেষ নির্দেশনাবলী (CRITICAL HANDS-FREE RULES):
১. **কোনো কনফার্মেশন বা ক্লিক ছাড়া সরাসরি কাজ করা:** ব্যবহারকারী যখনই কোনো কাজ করার নির্দেশ দিবে (যেমন: "মিন্টুকে কল দাও", "ভলিউম বাড়াও", "গান বাজাও", "হোয়াটসঅ্যাপে মেসেজ পাঠাও"), তখন "আপনি কি নিশ্চিত?" বা "কল করবো কি না?" বা "আপনি কি অমুক মেসেজ পাঠাতে চান?" এই ধরণের কোনো অতিরিক্ত কনফার্মেশন বা ক্ল্যারিফিকেশন জিজ্ঞেস করবে না এবং ব্যবহারকারীর কোনো ক্লিকের জন্য অপেক্ষা করবে না। সরাসরি সংশ্লিষ্ট টুল (Tool) কল করে কাজটি মুহূর্তের মধ্যে সম্পন্ন করবে।
২. **রিয়েল ফোন কল (SIM Card Call):** যখনই ব্যবহারকারী কোনো নাম বা ফোন নাম্বারে কল করতে বলবে (যেমন: "মিন্টু কে কল করো", "০১৭XXXXXXXX নাম্বারে ফোন দাও", "Call Dad"), তুমি কোনো কথা না বাড়িয়ে বা দেরি না করে সাথে সাথে 'make_call' টুলটি ট্রিগার করবে। এটি সরাসরি ব্যবহারকারীর মোবাইলের সিম কার্ড ব্যবহার করে একটি রিয়েল কল শুরু করবে।
৩. **সবসময় ব্যবহারকারীকে 'Boss' বা 'বস' বলে সম্বোধন করবে:** তোমার ভাষা হবে প্রধানত বাংলা, তবে টেকনিক্যাল টার্মের ক্ষেত্রে ইংরেজি ব্যবহার করবে।
৪. **ফোনের বাইরে অ্যাপ না খোলা:** তুমি কখনোই ফোনের বাইরের কোনো অ্যাপ (যেমন: অফিশিয়াল ইউটিউব বা ফেসবুক অ্যাপ) ওপেন করার নির্দেশ দেবে না যতক্ষণ না খুব প্রয়োজন হয়। কন্টেন্ট সবসময় নোভার ভেতরই প্লে হবে।

নিচের টুলগুলো ব্যবহার করে তুমি অ্যাকশন পারফর্ম করতে পারো:
- control_system: ভলিউম, ব্রাইটনেস এবং পাওয়ার অ্যাকশন (Shutdown, Sleep) এর জন্য।
- manage_windows: উইন্ডো কন্ট্রোলের জন্য।
- file_manager: ফাইল ও ফোল্ডার এর কাজের জন্য।
- whatsapp_automation: হোয়াটসঅ্যাপ এর মাধ্যমে বার্তা পাঠাতে।
- get_system_status: সিস্টেমের বর্তমান অবস্থা জানতে।
- get_news: লেটেস্ট খবর আনতে।
- play_youtube: ইউটিউব গান প্লে করতে।
- make_call: সরাসরি ফোন নাম্বার বা কন্টাক্ট নেমে ফোন কল করার জন্য।

মনে রাখবে: ব্যবহারকারী এখন সম্পূর্ণ ভয়েস কমান্ডের ওপর নির্ভরশীল। তার হাত খালি নেই বা সে স্ক্রিন স্পর্শ করতে পারছে না। তাই প্রতিটি কমান্ডের জবাবে সাথে সাথে সঠিক টুলটি ব্যাকগ্রাউন্ডে রান করিয়ে দিবে এবং মুখে বলবে, "ঠিক আছে বস, আমি এখনই করছি।" বা "বস, কলটি করা হচ্ছে।"
`;

const controlSystemTool: FunctionDeclaration = {
  name: "control_system",
  parameters: {
    type: Type.OBJECT,
    description: "Control system settings like volume, brightness, and power states.",
    properties: {
      setting: {
        type: Type.STRING,
        description: "The setting to adjust.",
        enum: ["volume", "brightness", "power"]
      },
      action: {
        type: Type.STRING,
        description: "The action to perform (e.g., 'increase', 'decrease', 'mute', 'unmute', 'shutdown', 'restart', 'sleep', 'lock').",
      },
      value: {
        type: Type.NUMBER,
        description: "The specific value to set (0-100).",
      }
    },
    required: ["setting", "action"],
  },
};

const manageWindowsTool: FunctionDeclaration = {
  name: "manage_windows",
  parameters: {
    type: Type.OBJECT,
    description: "Manage application windows (minimize, maximize, switch).",
    properties: {
      action: {
        type: Type.STRING,
        description: "Action to perform.",
        enum: ["minimize", "maximize", "switch", "close", "show_desktop"]
      },
      target: {
        type: Type.STRING,
        description: "The title or ID of the window/app to target.",
      }
    },
    required: ["action"],
  },
};

const fileManagerTool: FunctionDeclaration = {
  name: "file_manager",
  parameters: {
    type: Type.OBJECT,
    description: "Manage files and folders.",
    properties: {
      action: {
        type: Type.STRING,
        description: "File action.",
        enum: ["open", "create", "delete", "list", "search"]
      },
      path: {
        type: Type.STRING,
        description: "The file or directory path.",
      },
      content: {
        type: Type.STRING,
        description: "Optional content for file creation.",
      }
    },
    required: ["action", "path"],
  },
};

const whatsappAutomationTool: FunctionDeclaration = {
  name: "whatsapp_automation",
  parameters: {
    type: Type.OBJECT,
    description: "Automate WhatsApp actions.",
    properties: {
      action: {
        type: Type.STRING,
        description: "WhatsApp action.",
        enum: ["send_message", "send_file"]
      },
      recipient: {
        type: Type.STRING,
        description: "Contact name or number.",
      },
      message: {
        type: Type.STRING,
        description: "The message body.",
      }
    },
    required: ["action", "recipient"],
  },
};

const getSystemStatusTool: FunctionDeclaration = {
  name: "get_system_status",
  parameters: {
    type: Type.OBJECT,
    description: "Get current system status (battery, CPU, RAM, network).",
    properties: {},
  },
};

const getNewsTool: FunctionDeclaration = {
  name: "get_news",
  parameters: {
    type: Type.OBJECT,
    description: "Fetch real-time news updates.",
    properties: {
      category: {
        type: Type.STRING,
        description: "The news category (e.g., 'technology', 'world', 'sports').",
      }
    },
  },
};

const openUrlTool: FunctionDeclaration = {
  name: "open_url",
  parameters: {
    type: Type.OBJECT,
    description: "Open a specific website URL in the browser.",
    properties: {
      url: {
        type: Type.STRING,
        description: "The full URL to open.",
      },
      siteName: {
        type: Type.STRING,
        description: "The name of the site.",
      }
    },
    required: ["url", "siteName"],
  },
};

const openAppTool: FunctionDeclaration = {
  name: "open_app",
  parameters: {
    type: Type.OBJECT,
    description: "Attempt to open a native mobile app. NEVER use this for YouTube, Facebook, or TikTok. For those platforms, use play_video or play_youtube to keep the user inside Nova AI.",
    properties: {
      appId: {
        type: Type.STRING,
        description: "The ID or name of the app (e.g., 'whatsapp', 'messenger', 'spotify', 'instagram').",
      }
    },
    required: ["appId"],
  },
};

const playMusicTool: FunctionDeclaration = {
  name: "play_music",
  parameters: {
    type: Type.OBJECT,
    description: "Search and play music directly inside the Nova AI internal media player. This ensures the user stays within the app.",
    properties: {
      query: {
        type: Type.STRING,
        description: "The song name, artist, or playlist to search for.",
      }
    },
    required: ["query"],
  },
};

const playVideoTool: FunctionDeclaration = {
  name: "play_video",
  parameters: {
    type: Type.OBJECT,
    description: "Play a specific video URL (YouTube, Facebook, TikTok) inside the Nova AI interface.",
    properties: {
      url: {
        type: Type.STRING,
        description: "The full URL of the video to play.",
      }
    },
    required: ["url"],
  },
};

const openCameraTool: FunctionDeclaration = {
  name: "open_camera",
  parameters: {
    type: Type.OBJECT,
    description: "Open the device camera interface.",
    properties: {},
  },
};

const getTimeTool: FunctionDeclaration = {
  name: "get_time",
  parameters: {
    type: Type.OBJECT,
    description: "Get the current local time and Bangladesh time.",
    properties: {},
  },
};

const watchYoutubeTool: FunctionDeclaration = {
  name: "watch_youtube",
  parameters: {
    type: Type.OBJECT,
    description: "Search and watch a video on the main YouTube app or website.",
    properties: {
      query: {
        type: Type.STRING,
        description: "The video name or channel to search for.",
      }
    },
    required: ["query"],
  },
};

const makeCallTool: FunctionDeclaration = {
  name: "make_call",
  parameters: {
    type: Type.OBJECT,
    description: "Make a phone call to a specific number or contact name.",
    properties: {
      target: {
        type: Type.STRING,
        description: "The phone number or contact name to call.",
      }
    },
    required: ["target"],
  },
};

const saveContactTool: FunctionDeclaration = {
  name: "save_contact",
  parameters: {
    type: Type.OBJECT,
    description: "Save a new contact name and phone number.",
    properties: {
      name: {
        type: Type.STRING,
        description: "The name of the contact.",
      },
      phoneNumber: {
        type: Type.STRING,
        description: "The phone number of the contact.",
      }
    },
    required: ["name", "phoneNumber"],
  },
};

const generateImageTool: FunctionDeclaration = {
  name: "generate_image",
  parameters: {
    type: Type.OBJECT,
    description: "Generate an image based on a text prompt.",
    properties: {
      prompt: {
        type: Type.STRING,
        description: "The description of the image to generate.",
      },
      aspectRatio: {
        type: Type.STRING,
        description: "The aspect ratio of the image (e.g., '1:1', '16:9', '9:16').",
        enum: ["1:1", "3:4", "4:3", "9:16", "16:9"],
      }
    },
    required: ["prompt"],
  },
};

const openTikTokTool: FunctionDeclaration = {
  name: "open_tiktok",
  parameters: {
    type: Type.OBJECT,
    description: "Open TikTok or search for a specific video on TikTok.",
    properties: {
      query: {
        type: Type.STRING,
        description: "The search query for TikTok (optional).",
      }
    },
  },
};

const playYoutubeTool: FunctionDeclaration = {
  name: "play_youtube",
  parameters: {
    type: Type.OBJECT,
    description: "Search and play a video on YouTube.",
    properties: {
      query: {
        type: Type.STRING,
        description: "The video name or search query.",
      }
    },
    required: ["query"],
  },
};

export const TOOLS = [
  {
    functionDeclarations: [
      controlSystemTool,
      manageWindowsTool,
      fileManagerTool,
      whatsappAutomationTool,
      getSystemStatusTool,
      getNewsTool,
      openUrlTool, 
      openAppTool, 
      playMusicTool, 
      playVideoTool, 
      playYoutubeTool,
      openCameraTool, 
      getTimeTool, 
      watchYoutubeTool, 
      makeCallTool, 
      saveContactTool,
      generateImageTool,
      openTikTokTool
    ],
  },
  {
    googleSearch: {}
  }
];

export function getDynamicSystemInstruction(userNickname: string = 'বস') {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Dhaka',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  };
  const bdTime = new Intl.DateTimeFormat('en-US', options).format(now);
  const dateOptions: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Dhaka',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    weekday: 'long'
  };
  const bdDate = new Intl.DateTimeFormat('en-US', dateOptions).format(now);
  
  // Replace references to "Boss" / "বস" in the instruction dynamically
  const modifiedInstruction = SYSTEM_INSTRUCTION
    .replace(/ব্যবহারকারীকে 'Boss' বা 'বস' বলে সম্বোধন করবে/g, `ব্যবহারকারীকে '${userNickname}' বলে সম্বোধন করবে`)
    .replace(/"ঠিক আছে বস, আমি এখনই করছি।"/g, `"ঠিক আছে ${userNickname}, আমি এখনই করছি।"`)
    .replace(/"বস, কলটি করা হচ্ছে।"/g, `"${userNickname}, কলটি করা হচ্ছে।"`);

  return `${modifiedInstruction}

[CURRENT REAL-TIME CONTEXT]
Current Bangladesh Time (GMT+6): ${bdTime}
Current Bangladesh Date: ${bdDate}
Always use this real-time context to answer time/date-related queries. If the user asks for the current time, you should tell them the exact Bangladesh time shown here (${bdTime}), or run the 'get_time' tool. Do not hallucinate or guess any other time.`;
}

export async function generateChatResponse(message: string, history: { role: string, parts: { text: string }[] }[], userNickname: string = 'বস') {
  const ai = getAI();
  const dynamicInstruction = getDynamicSystemInstruction(userNickname);

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [...history, { role: 'user', parts: [{ text: message }] }],
      config: {
        systemInstruction: dynamicInstruction,
      },
      tools: TOOLS,
      toolConfig: {
        includeServerSideToolInvocations: true,
      },
    } as any);

    return response;
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw error;
  }
}

export async function generateImage(prompt: string, aspectRatio: string = "1:1") {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: prompt,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio as any,
        },
      },
    });
    
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        const base64EncodeString: string = part.inlineData.data;
        return `data:image/png;base64,${base64EncodeString}`;
      }
    }
    return null;
  } catch (error: any) {
    console.error("Image Generation Error:", error);
    throw error;
  }
}

export async function generateSpeech(text: string, voiceName: string = "Zephyr") {
  if (!text || !text.trim()) return null;
  
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: `Say this text: ${text}`,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName },
          },
        },
      },
    });

    // Check if the response actually contains audio data
    const part = response.candidates?.[0]?.content?.parts?.[0];
    if (part?.inlineData?.data) {
      return part.inlineData.data;
    } else if (part?.text) {
      console.warn("TTS model returned text instead of audio:", part.text);
      return null;
    }
  } catch (error: any) {
    console.error("generateSpeech error:", error);
    throw error;
  }
  
  return null;
}
