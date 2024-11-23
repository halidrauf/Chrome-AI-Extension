# AI Chat Assistant Chrome Extension

A powerful Chrome extension that integrates with Google's Gemini AI to provide intelligent chat assistance, webpage analysis, and image processing capabilities.

## Features

### 🤖 AI Chat Interface
- Real-time chat with Gemini AI
- Support for multiple Gemini models
- Message history persistence
- Markdown formatting support
- Code highlighting

### 🌐 Browser Integration Tools
- **Web Search**: Perform Google searches directly from the chat
- **Tab Management**: Open new tabs and analyze current tab content
- **Text Operations**: Copy text to clipboard and get selected text
- **Screenshot Analysis**: Capture and analyze webpage screenshots
- **Page Content Analysis**: Extract and analyze webpage content

### 📸 Image Processing
- Upload and analyze images (up to 4MB)
- Attach images with custom prompts
- Visual preview of uploaded images
- Support for multiple image formats

### 🎙️ Voice Input
- Speech-to-text conversion
- Voice command support
- Multiple language support

### ⚙️ Settings Management
- API key configuration
- Model selection
- Settings persistence
- Visual feedback for saving

## Installation

1. Clone this repository or download the source code
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory

## Configuration

1. Get your Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Click the settings icon in the extension
3. Enter your API key
4. Select your preferred Gemini model
5. Save settings

## Usage

### Basic Chat
- Click the extension icon to open the chat interface
- Type your message and press Enter or click Send
- View AI responses with markdown formatting

### Image Analysis
1. Click the image icon
2. Select an image to upload
3. Write your prompt about the image
4. Press Enter to get AI analysis

### Page Analysis
- Ask questions about the current webpage
- Request screenshots analysis
- Get content summaries and insights

### Voice Input
1. Click the microphone icon
2. Speak your message
3. Verify the transcription
4. Press Enter to send

## Available Tools

- `openTab`: Open URLs in new tabs
- `searchWeb`: Perform Google searches
- `getSelectedText`: Get highlighted text
- `copyToClipboard`: Copy text to clipboard
- `getCurrentTabInfo`: Analyze webpage content
- `analyzeScreenshot`: Analyze webpage screenshots

## Technical Details

### Models
- Gemini 1.5 Pro
- Gemini 1.5 Flash
- Gemini 1.5 Flash-8B

### Storage
- Uses Chrome storage API
- Falls back to localStorage
- Persists settings and chat history

### Permissions Required
- `activeTab`
- `tabs`
- `scripting`
- `storage`
- `<all_urls>`

## Development

### Project Structure
