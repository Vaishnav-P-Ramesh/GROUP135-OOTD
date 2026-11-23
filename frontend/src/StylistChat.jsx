import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  X,
  Send,
  Key,
  Bot,
  User,
  Image as ImageIcon,
  Upload,
  Plus
} from 'lucide-react';

export default function StylistChat({
  currentImage,
  personImage,
  garmentImage,
  isOpen: externalIsOpen,
  setIsOpen: externalSetIsOpen
}) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isControlled = externalIsOpen !== undefined;
  const isOpen = isControlled ? externalIsOpen : internalIsOpen;
  const setIsOpen = isControlled ? externalSetIsOpen : setInternalIsOpen;
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('ootd_gemini_api_key') || '');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [tempKey, setTempKey] = useState('');
  const [inputMessage, setInputMessage] = useState('');
  const [uploadedImage, setUploadedImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: "Hey! I'm Aura. Drop or upload an outfit photo, or ask for quick shoe, color, and layer pairing advice!",
      time: 'Just now'
    }
  ]);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const saveApiKey = (keyToSave) => {
    const trimmed = keyToSave.trim();
    setApiKey(trimmed);
    if (trimmed) {
      localStorage.setItem('ootd_gemini_api_key', trimmed);
    } else {
      localStorage.removeItem('ootd_gemini_api_key');
    }
    setShowKeyInput(false);
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setUploadedImage(event.target.result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const getEffectiveImage = () => {
    return uploadedImage || currentImage || garmentImage || personImage || null;
  };

  const handleSendMessage = async (textToSend) => {
    const query = (textToSend || inputMessage).trim();
    const activeImage = getEffectiveImage();

    if (!query && !activeImage) return;

    if (!apiKey) {
      setShowKeyInput(true);
      return;
    }

    const promptText = query || "How should I style this look? Recommend shoes and accessories.";

    // Append user message
    const userMsg = {
      role: 'user',
      text: promptText,
      imagePreview: activeImage,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    // Clear custom uploaded photo after sending, so user can ask followups or upload a new one
    setUploadedImage(null);
    setLoading(true);

    try {
      const response = await fetch('/api/stylist/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: promptText,
          image: activeImage,
          apiKey: apiKey
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: data.reply,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      } else {
        const errorText = data.error || 'Failed to communicate with the stylist.';
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: `⚠️ ${errorText}`,
            isError: true,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
        if (data.error && (data.error.includes('API key') || data.error.includes('API_KEY_INVALID'))) {
          setShowKeyInput(true);
        }
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `⚠️ Network error: ${err.message}`,
          isError: true,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const quickPrompts = [
    { label: "✨ Style my look", prompt: "Give me quick, 3-point advice: what shoes, accessories, and outerwear pair best with this?" },
    { label: "👟 Shoe pick", prompt: "Recommend the best 2 shoe styles and colors for this outfit." },
    { label: "🎨 Color match", prompt: "What 2-3 accent colors will elevate this piece?" },
    { label: "🕶️ Accessories", prompt: "Suggest jewelry, bag, and glasses to complement this look." }
  ];

  const currentFrame = uploadedImage ? 'Uploaded photo' : currentImage ? 'Try-on proof' : garmentImage ? 'Garment' : personImage ? 'Person' : null;

  return (
    <>
      {/* Floating launcher trigger */}
      {!isOpen && (
        <button
          className="stylist-fab-button"
          onClick={() => setIsOpen(true)}
          aria-label="Open Personal Stylist Assistant"
        >
          <span className="stylist-fab-pulse" aria-hidden="true"></span>
          <Sparkles size={16} />
          <span>Ask Stylist</span>
        </button>
      )}

      {/* Stylist Drawer / Modal Window */}
      {isOpen && (
        <div className="stylist-chat-window">
          {/* Header */}
          <div className="stylist-header">
            <div className="stylist-title-area">
              <div className="stylist-avatar">
                <Sparkles size={16} />
              </div>
              <div>
                <h3 className="stylist-name">Aura · Stylist</h3>
                <span className="stylist-status">
                  <span className="stylist-status-dot" aria-hidden="true"></span>
                  Online · Quick styling
                </span>
              </div>
            </div>
            <div className="stylist-actions">
              <button
                className="stylist-header-btn"
                onClick={() => {
                  setTempKey(apiKey);
                  setShowKeyInput(!showKeyInput);
                }}
                title="Gemini API Key"
                aria-label="Key Settings"
              >
                <Key size={14} />
              </button>
              <button
                className="stylist-header-btn"
                onClick={() => setIsOpen(false)}
                title="Close"
                aria-label="Close Stylist Chat"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* API Key Banner / Config */}
          {showKeyInput && (
            <div className="stylist-key-banner">
              <div className="key-banner-head">
                <Key size={14} />
                <span>Google Gemini API Key</span>
              </div>
              <p className="key-banner-hint">
                Saved in your browser. Free key from <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer">AI Studio</a>.
              </p>
              <div className="key-input-row">
                <input
                  type="password"
                  placeholder="Paste AIzaSy... key"
                  value={tempKey}
                  onChange={(e) => setTempKey(e.target.value)}
                />
                <button
                  className="btn-save-key"
                  onClick={() => saveApiKey(tempKey)}
                >
                  Save
                </button>
              </div>
            </div>
          )}

          {/* Chat Messages */}
          <div className="stylist-messages">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`stylist-bubble-row ${msg.role === 'user' ? 'user-row' : 'assistant-row'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="msg-avatar assistant">
                    <Bot size={14} />
                  </div>
                )}
                <div className={`stylist-bubble ${msg.role === 'user' ? 'user-bubble' : 'assistant-bubble'} ${msg.isError ? 'error-bubble' : ''}`}>
                  {msg.imagePreview && (
                    <div className="bubble-image-preview">
                      <img src={msg.imagePreview} alt="Attached outfit" />
                    </div>
                  )}
                  <p className="bubble-text">{msg.text}</p>
                  <span className="bubble-time">{msg.time}</span>
                </div>
                {msg.role === 'user' && (
                  <div className="msg-avatar user">
                    <User size={14} />
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="stylist-bubble-row assistant-row">
                <div className="msg-avatar assistant">
                  <Bot size={14} />
                </div>
                <div className="stylist-bubble assistant-bubble loading-bubble">
                  <span className="typing-dot"></span>
                  <span className="typing-dot"></span>
                  <span className="typing-dot"></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Attached Image Bar (Preview if uploaded or inherited) */}
          {(uploadedImage || currentFrame) && (
            <div className="stylist-attached-tray">
              <div className="attached-thumb">
                <img src={uploadedImage || currentImage || garmentImage || personImage} alt="Active preview" />
              </div>
              <div className="attached-info">
                <span>{uploadedImage ? 'Custom uploaded photo' : `Active studio ${currentFrame}`}</span>
                <small>Attached to next question</small>
              </div>
              {uploadedImage && (
                <button
                  type="button"
                  className="attached-remove"
                  onClick={() => setUploadedImage(null)}
                  title="Remove uploaded photo"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          )}

          {/* Input Area */}
          <div className="stylist-input-container">
            <form
              className="stylist-input-form"
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
            >
              {/* Add Photo Button */}
              <button
                type="button"
                className="stylist-photo-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Upload custom photo to style"
                aria-label="Upload photo"
              >
                <Upload size={16} />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handlePhotoUpload}
              />

              <input
                type="text"
                placeholder={uploadedImage ? "Add styling question (or send)..." : "Ask Aura or upload a photo..."}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                disabled={loading}
              />

              <button
                type="submit"
                className="stylist-send-btn"
                disabled={loading || (!inputMessage.trim() && !getEffectiveImage())}
                aria-label="Send Message"
              >
                <Send size={15} />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
