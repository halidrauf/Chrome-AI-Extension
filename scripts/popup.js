const browserTools = {
  chatUI: null,

  setChatUI(instance) {
    this.chatUI = instance;
  },

  tools: [
    {
      name: "openTab",
      description: "Opens a new browser tab with the specified URL",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "The URL to open in the new tab",
          },
        },
        required: ["url"],
      },
    },
    {
      name: "searchWeb",
      description: "Performs a web search using Google",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query to perform",
          },
        },
        required: ["query"],
      },
    },
    {
      name: "getSelectedText",
      description: "Gets the currently selected text from the active tab",
      parameters: {
        type: "object",
        properties: {
          dummy: {
            type: "string",
            description: "This parameter is not used but required by the API",
          },
        },
      },
    },
    {
      name: "copyToClipboard",
      description: "Copies the specified text to the clipboard",
      parameters: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description: "The text to copy to the clipboard",
          },
        },
        required: ["text"],
      },
    },
    {
      name: "getCurrentTabInfo",
      description: "Gets information about the current tab and analyzes it based on the provided question",
      parameters: {
        type: "object",
        properties: {
          question: {
            type: "string",
            description: "The specific question or analysis prompt about the page content",
          }
        },
        required: ["question"],
      },
    },
    {
      name: "analyzeScreenshot",
      description: "Takes a screenshot of the current tab and analyzes it based on the provided question",
      parameters: {
        type: "object",
        properties: {
          question: {
            type: "string",
            description: "The specific question or analysis prompt about the screenshot",
          }
        },
        required: ["question"],
      },
    },
  ],

  // Tool implementations
  async openTab({ url }) {
    if (chrome.tabs) {
      await chrome.tabs.create({ url });
      return `Opened new tab with URL: ${url}`;
    }
    window.open(url, "_blank");
    return `Opened new tab with URL: ${url}`;
  },

  async searchWeb({ query }) {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(
      query
    )}`;
    if (chrome.tabs) {
      await chrome.tabs.create({ url: searchUrl });
      return `Performed web search for: ${query}`;
    }
    window.open(searchUrl, "_blank");
    return `Performed web search for: ${query}`;
  },

  async getSelectedText({ dummy }) {
    if (chrome.tabs) {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: "getSelectedText",
      });
      return response.selectedText || "No text selected";
    }
    return "Feature not available outside of Chrome extension";
  },

  async copyToClipboard({ text }) {
    await navigator.clipboard.writeText(text);
    return `Copied to clipboard: ${text}`;
  },

  async getCurrentTabInfo({ question }) {
    if (!chrome.tabs) {
      return "Feature not available outside of Chrome extension";
    }

    try {
      // Get the active tab
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab || !tab.id) {
        throw new Error("No active tab found");
      }

      // Try to inject content script if not already injected
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["scripts/content.js"],
        });
      } catch (error) {
        console.log(
          "Content script already injected or couldn't be injected:",
          error
        );
      }

      // Get page content through content script
      const result = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => {
          // Helper function to get main content
          function getMainContent() {
            // Try to find main content containers
            const contentSelectors = [
              'article',
              '[role="main"]',
              'main',
              '.main-content',
              '#main-content'
            ];
            
            for (const selector of contentSelectors) {
              const element = document.querySelector(selector);
              if (element) {
                return element.innerText;
              }
            }
            
            // Fallback to body text if no main content found
            return document.body.innerText;
          }

          return {
            url: window.location.href,
            title: document.title,
            content: getMainContent().substring(0, 15000),
            meta: {
              description: document.querySelector('meta[name="description"]')?.content || '',
              keywords: document.querySelector('meta[name="keywords"]')?.content || ''
            }
          };
        },
      });

      if (!result || !result[0]) {
        throw new Error("Failed to execute content script");
      }

      const pageInfo = result[0].result;

      // Format the content for Gemini to analyze using the provided question
      const prompt = `Analyze this webpage content to answer the following question: "${question}"

Content from: ${pageInfo.title} (${pageInfo.url})

${pageInfo.content}

Please provide a clear, focused response addressing the question. Format your response in markdown.`;

      // Use chatUI instance to call Gemini API
      const response = await this.chatUI.callGeminiAPI(prompt);
      return response;
    } catch (error) {
      console.error("Error getting tab info:", error);
      return `Failed to analyze page content: ${error.message}`;
    }
  },

  async analyzeScreenshot({ question }) {
    if (!chrome.tabs) {
      return "Feature not available outside of Chrome extension";
    }

    try {
      // Get the active tab
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab || !tab.id) {
        throw new Error("No active tab found");
      }

      // Capture the visible tab area
      const screenshot = await chrome.tabs.captureVisibleTab(null, {
        format: 'png'
      });

      // Convert data URL to base64
      const base64Data = screenshot.split(',')[1];

      // Create image data object
      const imageData = {
        mimeType: 'image/png',
        base64Data: base64Data
      };

      // Call Gemini API with the screenshot and question
      const response = await this.chatUI.callGeminiAPI(question, imageData);
      return response;

    } catch (error) {
      console.error("Error capturing screenshot:", error);
      return `Failed to analyze screenshot: ${error.message}`;
    }
  },
};

class ChatUI {
  constructor() {
    // DOM Elements with null checks
    this.messagesContainer = document.getElementById("chat-messages");
    this.userInput = document.getElementById("user-input");
    this.sendButton = document.getElementById("send-button");
    this.settingsButton = document.getElementById("settings-button");
    this.settingsPanel = document.getElementById("settings-panel");
    this.closeSettings = document.getElementById("close-settings");
    this.apiKeyInput = document.getElementById("api-key");
    this.saveSettingsButton = document.getElementById("save-settings");
    this.toggleVisibility = document.querySelector(".toggle-visibility");
    this.modelSelect = document.getElementById("model-select");
    this.micButton = document.querySelector(".mic-button");
    this.isRecording = false;
    this.recognition = null;

    // Verify all required elements are present
    if (!this.messagesContainer || !this.userInput || !this.sendButton) {
      console.error("Required DOM elements not found");
      return;
    }

    // Message history
    this.messageHistory = [];

    // Add initial message
    this.addMessage("assistant", "Hello! How can I help you today?");

    // Initialize in sequence
    this.initializeApp();

    if (this.micButton) {
      this.initializeVoiceInput();
    }

    this.initializeImageInput();

    // Pass this instance to browserTools
    browserTools.setChatUI(this);
  }

  async initializeApp() {
    try {
      // Load models first
      await this.loadModels();

      // Initialize model selector before loading saved model
      this.initializeModelSelector();
      
      // Load saved model or set default to gemini-1.5-flash-8b
      await this.loadSavedModel();
      
      // Then initialize everything else
      this.bindEvents();
      this.bindSettingsEvents();
      await this.loadMessages();
      await this.loadApiKey();
    } catch (error) {
      console.error("Error initializing app:", error);
      this.addMessage(
        "error",
        "Failed to initialize the application. Please try refreshing."
      );
    }
  }

  bindEvents() {
    // Only bind if elements exist
    if (this.sendButton) {
      this.sendButton.addEventListener("click", () => this.handleSend());
    }

    if (this.userInput) {
      this.userInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          this.handleSend();
        }
      });

      this.userInput.addEventListener("input", () => {
        this.userInput.style.height = "auto";
        this.userInput.style.height = `${Math.min(
          this.userInput.scrollHeight,
          150
        )}px`;
      });
    }
  }

  bindSettingsEvents() {
    if (!this.settingsButton || !this.settingsPanel || !this.closeSettings) {
      console.warn("Settings elements not found");
      return;
    }

    this.settingsButton.addEventListener("click", () => {
      this.settingsPanel.classList.add("active");
    });

    this.closeSettings.addEventListener("click", () => {
      this.settingsPanel.classList.remove("active");
    });

    if (this.toggleVisibility && this.apiKeyInput) {
      this.toggleVisibility.addEventListener("click", () => {
        const type = this.apiKeyInput.type === "password" ? "text" : "password";
        this.apiKeyInput.type = type;
        this.toggleVisibility.querySelector(".material-icons").textContent =
          type === "password" ? "visibility_off" : "visibility";
      });
    }

    if (this.saveSettingsButton) {
      this.saveSettingsButton.addEventListener("click", () =>
        this.saveSettings()
      );
    }
  }

  async handleSend() {
    const message = this.userInput.value.trim();
    if (!message) return;

    try {
      // Add user message
      this.addMessage("user", message);

      // Clear input and reset height
      this.userInput.value = "";
      this.userInput.style.height = "auto";

      // Show loading indicator
      const loadingMessage = this.addLoadingMessage();

      // Call Gemini API
      const response = await this.callGeminiAPI(message);

      // Remove loading message and add response
      this.removeLoadingMessage(loadingMessage);
      this.addMessage("assistant", response);
    } catch (error) {
      console.error("Error sending message:", error.message || error);
      this.addMessage(
        "error",
        "Sorry, something went wrong. Please try again."
      );
    }
  }

  async callGeminiAPI(message, imageData = null) {
    try {
      const apiKey = this.apiKeyInput.value.trim();
      if (!apiKey) {
        throw new Error("Please set your API key in settings");
      }

      const selectedModel = this.models.find(
        (model) => model.id === this.modelSelect.value
      );
      if (!selectedModel) {
        throw new Error("Selected model not found");
      }

      // Prepare the parts array based on whether we have an image
      const parts = [];

      if (imageData) {
        parts.push({
          inline_data: {
            mime_type: imageData.mimeType,
            data: imageData.base64Data,
          },
        });
      }

      // Add the text message
      parts.push({ text: message });

      const requestBody = {
        contents: [
          {
            parts: parts,
          },
        ],
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_NONE",
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_NONE",
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_NONE",
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_NONE",
          },
          {
            category: "HARM_CATEGORY_CIVIC_INTEGRITY",
            threshold: "BLOCK_NONE",
          },
        ],
      };

      // Add tools config if no image is present
      if (!imageData) {
        Object.assign(requestBody, {
          tools: [
            {
              functionDeclarations: browserTools.tools,
            },
          ],
          toolConfig: {
            functionCallingConfig: {
              mode: "AUTO",
            },
          },
        });
      }

      const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel.id}:generateContent?key=${apiKey}`;

      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      const data = await response.json();

      if (!data.candidates?.[0]?.content?.parts?.[0]) {
        throw new Error("Invalid response format from API");
      }

      const candidate = data.candidates[0];
      if (candidate.content.parts[0].functionCall) {
        const functionCall = candidate.content.parts[0].functionCall;
        const toolName = functionCall.name;
        const args =
          typeof functionCall.args === "string"
            ? JSON.parse(functionCall.args)
            : functionCall.args;

        if (browserTools[toolName]) {
          const result = await browserTools[toolName](args);
          return result;
        }
      }

      return candidate.content.parts[0].text;
    } catch (error) {
      const errorMessage = error.message || "Unknown error occurred";
      throw new Error(errorMessage);
    }
  }

  addMessage(role, content) {
    const message = {
      role,
      content,
      timestamp: new Date().toISOString(),
    };

    // Add to history
    this.messageHistory.push(message);

    // Create and append message element
    const messageElement = this.createMessageElement(message);
    this.messagesContainer.appendChild(messageElement);

    // Scroll to bottom
    this.scrollToBottom();

    // Save to storage
    this.saveMessages().catch((error) => {
      console.error("Error saving messages:", error);
    });
  }

  createMessageElement(message) {
    const div = document.createElement("div");
    div.className = `message message-${message.role}`;

    const content = document.createElement("div");
    content.className = "message-content";

    // Check if content contains HTML (image preview)
    if (message.content.includes('<div class="image-preview">')) {
      content.innerHTML = message.content;
    } else if (message.role === "assistant") {
      content.innerHTML = marked.parse(message.content, {
        gfm: true,
        breaks: true,
        highlight: function (code, lang) {
          if (lang && hljs.getLanguage(lang)) {
            try {
              return hljs.highlight(code, { language: lang }).value;
            } catch (err) {}
          }
          return code;
        },
      });

      content.querySelectorAll("a").forEach((link) => {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      });
    } else {
      content.textContent = message.content;
    }

    const timestamp = document.createElement("div");
    timestamp.className = "message-timestamp";
    timestamp.textContent = this.formatTimestamp(message.timestamp);

    div.appendChild(content);
    div.appendChild(timestamp);

    return div;
  }

  scrollToBottom() {
    requestAnimationFrame(() => {
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    });
  }

  formatTimestamp(timestamp) {
    return new Intl.DateTimeFormat("default", {
      hour: "numeric",
      minute: "numeric",
    }).format(new Date(timestamp));
  }

  async saveMessages() {
    // Save last 50 messages
    const messages = this.messageHistory.slice(-50);
    if (chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ chatHistory: messages });
    } else {
      localStorage.setItem("chatHistory", JSON.stringify(messages));
    }
  }

  async loadMessages() {
    try {
      let messages;
      if (chrome.storage && chrome.storage.local) {
        const result = await chrome.storage.local.get("chatHistory");
        messages = result.chatHistory;
      } else {
        const stored = localStorage.getItem("chatHistory");
        messages = stored ? JSON.parse(stored) : null;
      }

      if (messages && Array.isArray(messages)) {
        this.messageHistory = messages;
        this.messagesContainer.innerHTML = ""; // Clear existing messages
        messages.forEach((message) => {
          const messageElement = this.createMessageElement(message);
          this.messagesContainer.appendChild(messageElement);
        });
        this.scrollToBottom();
      }
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  }

  async loadModels() {
    try {
      const response = await fetch("config/models.json");
      if (!response.ok) {
        throw new Error("Failed to load models configuration");
      }
      const data = await response.json();
      this.models = data.models;
    } catch (error) {
      console.error("Error loading models:", error);
      // Fallback models if config fails to load
      this.models = [
        {
          id: "gemini-1.5-pro",
          name: "Gemini 1.5 Pro",
          description: "Most capable model for complex tasks",
          maxTokens: 30720,
          temperature: 0.7,
          type: "text",
        },
        {
          id: "gemini-1.5-flash-8b",
          name: "Gemini 1.5 Flash-8B",
          description: "Fast, efficient model with tool support",
          maxTokens: 30720,
          temperature: 0.7,
          type: "text",
        },
      ];
    }

    // Load saved model selection after models are loaded
    await this.loadSavedModel();
  }

  // Add new method to load saved model
  async loadSavedModel() {
    try {
      let selectedModel;
      if (chrome.storage && chrome.storage.local) {
        const result = await chrome.storage.local.get("selectedModel");
        selectedModel = result.selectedModel;
      } else {
        selectedModel = localStorage.getItem("selectedModel");
      }

      // If no model is selected or the selected model isn't available,
      // default to gemini-1.5-flash-8b
      if (!selectedModel || !this.models.find(model => model.id === selectedModel)) {
        selectedModel = "gemini-1.5-flash-8b";
        // Save the default selection
        if (chrome.storage && chrome.storage.local) {
          await chrome.storage.local.set({ selectedModel });
        } else {
          localStorage.setItem("selectedModel", selectedModel);
        }
      }

      if (this.modelSelect) {
        this.modelSelect.value = selectedModel;
      }
    } catch (error) {
      console.error("Error loading saved model:", error);
      // Set default model on error
      if (this.modelSelect) {
        this.modelSelect.value = "gemini-1.5-flash-8b";
      }
    }
  }

  initializeModelSelector() {
    if (!this.modelSelect) return;

    this.modelSelect.innerHTML = ""; // Clear existing options

    this.models.forEach((model) => {
      const option = document.createElement("option");
      option.value = model.id;
      option.textContent = model.name;
      option.title = model.description;
      this.modelSelect.appendChild(option);
    });

    // Add change event listener to save model selection
    this.modelSelect.addEventListener('change', async () => {
      const selectedModel = this.modelSelect.value;
      try {
        if (chrome.storage && chrome.storage.local) {
          await chrome.storage.local.set({ selectedModel });
        } else {
          localStorage.setItem("selectedModel", selectedModel);
        }
      } catch (error) {
        console.error("Error saving model selection:", error);
      }
    });
  }

  async saveSettings() {
    const apiKey = this.apiKeyInput.value.trim();
    const selectedModel = this.modelSelect.value;

    this.saveSettingsButton.disabled = true;
    this.saveSettingsButton.textContent = "Saving...";

    try {
      if (chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({
          geminiApiKey: apiKey,
          selectedModel: selectedModel,
        });
      } else {
        localStorage.setItem("geminiApiKey", apiKey);
        localStorage.setItem("selectedModel", selectedModel);
      }

      this.settingsPanel.classList.remove("active");
      this.addMessage("assistant", "Settings saved successfully!");
    } catch (error) {
      console.error("Error saving settings:", error);
      this.addMessage("error", "Failed to save settings. Please try again.");
    } finally {
      this.saveSettingsButton.disabled = false;
      this.saveSettingsButton.textContent = "Save Settings";
    }
  }

  async loadApiKey() {
    try {
      let apiKey;
      if (chrome.storage && chrome.storage.local) {
        const result = await chrome.storage.local.get("geminiApiKey");
        apiKey = result.geminiApiKey;
      } else {
        apiKey = localStorage.getItem("geminiApiKey");
      }

      if (apiKey && this.apiKeyInput) {
        this.apiKeyInput.value = apiKey;
      }
    } catch (error) {
      console.error("Error loading API key:", error);
    }
  }

  // Mock API call - Replace with actual API implementation
  async mockApiCall(message) {
    const selectedModel = this.models.find(
      (m) => m.id === this.modelSelect.value
    );
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return `Using ${selectedModel.name} to respond: "${message}"`;
  }

  initializeVoiceInput() {
    if (!("webkitSpeechRecognition" in window)) {
      console.error("Speech recognition not supported");
      if (this.micButton) {
        this.micButton.style.display = "none";
      }
      return;
    }

    this.recognition = new webkitSpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.lang = navigator.language || "en-US";

    this.recognition.onstart = () => {
      this.isRecording = true;
      this.micButton.classList.add("recording");
      this.micButton.querySelector(".material-icons").textContent = "mic";
      this.userInput.placeholder = "Listening...";
    };

    this.recognition.onend = () => {
      this.isRecording = false;
      this.micButton.classList.remove("recording");
      this.micButton.querySelector(".material-icons").textContent = "mic_none";
      this.userInput.placeholder = "Ask me anything...";
    };

    this.recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      this.userInput.value = transcript;
      this.userInput.style.height = "auto";
      this.userInput.style.height = `${Math.min(
        this.userInput.scrollHeight,
        150
      )}px`;
    };

    this.recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      this.isRecording = false;
      this.micButton.classList.remove("recording");
      this.micButton.querySelector(".material-icons").textContent = "mic_none";
      this.userInput.placeholder = "Ask me anything...";

      if (event.error === "not-allowed") {
        this.addMessage(
          "error",
          "Microphone access was denied. Please check your browser settings."
        );
      }
    };

    this.micButton.addEventListener("click", () => this.toggleVoiceInput());
  }

  toggleVoiceInput() {
    if (this.isRecording) {
      this.stopRecording();
    } else {
      this.startRecording();
    }
  }

  startRecording() {
    if (!this.recognition) return;

    try {
      this.recognition.start();
    } catch (error) {
      if (error.name === "NotAllowedError") {
        this.addMessage(
          "error",
          "Microphone permission denied. Please allow access in your browser settings."
        );
      } else {
        console.error("Error starting recognition:", error);
      }
    }
  }

  stopRecording() {
    if (this.recognition && this.isRecording) {
      try {
        this.recognition.stop();
      } catch (error) {
        console.error("Error stopping recognition:", error);
      }
    }
  }

  initializeImageInput() {
    const imageInput = document.createElement("input");
    imageInput.type = "file";
    imageInput.accept = "image/*";
    imageInput.style.display = "none";
    document.body.appendChild(imageInput);

    const imageButton = document.createElement("button");
    imageButton.className = "image-button";
    imageButton.innerHTML = '<span class="material-icons">image</span>';
    this.userInput.parentElement.insertBefore(imageButton, this.userInput);

    // Add a property to store pending image data
    this.pendingImageData = null;
    this.pendingImagePreview = null;

    imageInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // Check file size (max 4MB)
      if (file.size > 4 * 1024 * 1024) {
        this.addMessage("error", "Image file size must be less than 4MB");
        return;
      }

      try {
        // Process image and store for later use
        this.pendingImageData = await this.processImage(file);
        this.pendingImagePreview = await this.createImagePreview(file);

        // Show indicator that image is attached
        imageButton.classList.add('image-attached');
        imageButton.title = 'Image attached - Write your prompt and press Enter';
        
        // Focus the input for the prompt
        this.userInput.focus();
        this.userInput.placeholder = "Write your prompt for the image...";
        
      } catch (error) {
        console.error("Error processing image:", error);
        this.addMessage("error", "Failed to process image. Please try again.");
      } finally {
        imageInput.value = ""; // Reset input
      }
    });

    // Modify the handleSend method to check for pending image
    const originalHandleSend = this.handleSend.bind(this);
    this.handleSend = async () => {
      const message = this.userInput.value.trim();
      if (!message) return;

      if (this.pendingImageData) {
        // Handle image analysis with prompt
        try {
          // Add message with image preview and prompt
          this.addMessage("user", this.pendingImagePreview + "\n" + message);

          // Clear input
          this.userInput.value = "";

          // Show loading state
          const loadingMessage = this.addLoadingMessage();

          // Call API with image data
          const response = await this.callGeminiAPI(message, this.pendingImageData);

          // Remove loading message and add response
          this.removeLoadingMessage(loadingMessage);
          this.addMessage("assistant", response);
        } catch (error) {
          console.error("Error processing image:", error);
          this.addMessage("error", "Failed to process image. Please try again.");
        } finally {
          // Clear pending image data
          this.pendingImageData = null;
          this.pendingImagePreview = null;
          imageButton.classList.remove('image-attached');
          imageButton.title = '';
          this.userInput.placeholder = "Ask me anything...";
        }
      } else {
        // Handle normal text message
        await originalHandleSend();
      }
    };

    imageButton.addEventListener("click", () => {
      if (this.pendingImageData) {
        // Clear pending image if clicking again
        this.pendingImageData = null;
        this.pendingImagePreview = null;
        imageButton.classList.remove('image-attached');
        imageButton.title = '';
        this.userInput.placeholder = "Ask me anything...";
      } else {
        // Select new image
        imageInput.click();
      }
    });
  }

  async createImagePreview(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        // Create an image element with proper styling
        const imgHtml = `
          <div class="image-preview">
            <img src="${reader.result}" alt="Uploaded image">
          </div>`;
        resolve(imgHtml);
      };
      reader.readAsDataURL(file);
    });
  }

  async processImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
        const base64Data = reader.result.split(",")[1];
        resolve({
          mimeType: file.type,
          base64Data: base64Data,
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  addLoadingMessage() {
    const div = document.createElement("div");
    div.className = "message message-loading";

    const content = document.createElement("div");
    content.className = "message-content";
    content.innerHTML = `
      <div class="loading-spinner">
        <div class="bounce1"></div>
        <div class="bounce2"></div>
        <div class="bounce3"></div>
      </div>
    `;

    div.appendChild(content);
    this.messagesContainer.appendChild(div);
    this.scrollToBottom();

    return div;
  }

  removeLoadingMessage(loadingElement) {
    if (loadingElement && loadingElement.parentNode) {
      loadingElement.parentNode.removeChild(loadingElement);
    }
  }
}

// Initialize chat when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  try {
    window.chatUI = new ChatUI();
  } catch (error) {
    console.error("Error initializing ChatUI:", error);
  }
});
