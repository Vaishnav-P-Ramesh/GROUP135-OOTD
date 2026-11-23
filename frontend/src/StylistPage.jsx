import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  Upload,
  Image as ImageIcon,
  CheckCircle,
  RefreshCw,
  Shirt,
  Sparkle,
  ArrowRight
} from 'lucide-react';

export default function StylistPage({
  currentImage,
  personImage,
  garmentImage,
  critique,
  onNavigate
}) {
  const [activeImage, setActiveImage] = useState(
    currentImage || garmentImage || personImage || '/assets/sample-person.webp'
  );
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadedImage, setUploadedImage] = useState(null);
  const fileInputRef = useRef(null);
  const chatBottomRef = useRef(null);

  const apiKey = localStorage.getItem('ootd_gemini_api_key') || '';

  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: "Hello! I am Aura, your personal AI stylist.\n\nI can rate your outfit, analyze your silhouette, recommend matching shoes, and suggest the best accessories and layers.\n\nSelect a styling goal below or type any question!",
      time: 'Just now'
    }
  ]);

  // Keep activeImage synced if props update
  useEffect(() => {
    if (currentImage) {
      setActiveImage(currentImage);
    } else if (garmentImage) {
      setActiveImage(garmentImage);
    }
  }, [currentImage, garmentImage]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setActiveImage(event.target.result);
      setUploadedImage(event.target.result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSendMessage = async (textToSend) => {
    const query = (textToSend || inputMessage).trim();
    const targetImage = uploadedImage || activeImage;

    if (!query && !targetImage) return;

    const promptText = query || "Please evaluate this outfit and give me styling advice.";

    const userMsg = {
      role: 'user',
      text: promptText,
      imagePreview: targetImage,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setUploadedImage(null);
    setLoading(true);

    try {
      const response = await fetch('/api/stylist/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: promptText,
          image: targetImage,
          apiKey
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
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: `⚠️ ${data.error || 'Stylist is unavailable. Please check your network connection.'}`,
            isError: true,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
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

  const quickActionCards = [
    {
      title: "🌟 Rate Outfit Out of 10",
      desc: "Get an overall score with what works, what needs fixing, and styling adjustments.",
      prompt: "Rate this outfit out of 10. Give concise bullets on: What Works, What Needs Work, and a Quick Fix."
    },
    {
      title: "👟 Shoe & Footwear Match",
      desc: "Discover the best 2 shoe styles and colors to balance this outfit.",
      prompt: "Recommend the best 2 shoe styles, colors, and footwear silhouettes that pair perfectly with this outfit."
    },
    {
      title: "🎨 Color Palette & Harmony",
      desc: "Find complementing accent shades and color contrasts.",
      prompt: "Analyze the color palette of this outfit. What 2 or 3 accent colors would elevate this look?"
    },
    {
      title: "🕶️ Jewelry, Bags & Layers",
      desc: "Smart suggestions for jackets, bags, necklaces, and accessories.",
      prompt: "What outerwear jackets, bags, jewelry, or accessories should I add to elevate this look?"
    },
    {
      title: "✂️ Fit & Silhouette Fixes",
      desc: "Proportion advice to make you look taller, sharper, and balanced.",
      prompt: "Evaluate the proportions and silhouette of this outfit. How can I balance the fit to look sharper?"
    }
  ];

  return (
    <main className="stylist-page-container">
      {/* Stylist Page Header */}
      <section className="stylist-page-hero">
        <div className="stylist-hero-badge">
          <Sparkles size={14} />
          <span>Aura AI Fashion Consultant</span>
        </div>
        <h1 className="stylist-page-title">
          Your Personal <span className="hl">Wardrobe Stylist</span>
        </h1>
        <p className="stylist-page-lede">
          Get real-time outfit evaluations, footwear recommendations, color matching, and styling advice tailored to your look.
        </p>
      </section>

      {/* Stylist Workspace Grid */}
      <section className="stylist-workspace-grid">
        {/* Left Column: Active Outfit & Quick Actions */}
        <div className="stylist-outfit-panel">
          <div className="stylist-panel-card">
            <div className="stylist-panel-header">
              <span>Active Look for Analysis</span>
              <button
                type="button"
                className="text-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                Change photo
              </button>
            </div>

            <div className="stylist-image-preview-frame">
              {activeImage ? (
                <img src={activeImage} alt="Active Outfit" className="stylist-active-img" />
              ) : (
                <div className="stylist-empty-frame">
                  <Shirt size={32} />
                  <span>No outfit loaded</span>
                  <small>Upload a photo or try on clothes in Studio</small>
                </div>
              )}
            </div>

            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              hidden
              onChange={handleFileUpload}
            />

            <div className="stylist-frame-footer">
              <button
                type="button"
                className="btn-ink btn-block stylist-upload-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={14} />
                <span>Upload Different Outfit</span>
              </button>
            </div>
          </div>

          {/* Quick Style Analysis Buttons */}
          <div className="stylist-quick-action-box">
            <h3 className="quick-actions-heading">Quick Consultations</h3>
            <div className="quick-actions-list">
              {quickActionCards.map((action, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="quick-action-card-btn"
                  onClick={() => handleSendMessage(action.prompt)}
                  disabled={loading}
                >
                  <div className="action-card-info">
                    <strong>{action.title}</strong>
                    <p>{action.desc}</p>
                  </div>
                  <ArrowRight size={16} className="action-card-arrow" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Full Stylist Conversation Console */}
        <div className="stylist-console-panel">
          <div className="stylist-console-card">
            <div className="stylist-console-header">
              <div className="console-header-left">
                <div className="console-avatar">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h4>Aura Stylist Console</h4>
                  <span className="console-status-text">
                    <span className="stylist-status-dot"></span>
                    Ready for fashion consultation
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="text-btn"
                onClick={() => {
                  setMessages([
                    {
                      role: 'assistant',
                      text: "Consultation reset. Ask me anything about your outfit, shoes, or colors!",
                      time: 'Just now'
                    }
                  ]);
                }}
              >
                Reset chat
              </button>
            </div>

            {/* Chat Messages Log */}
            <div className="stylist-console-messages">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`console-bubble-row ${msg.role === 'user' ? 'is-user' : 'is-assistant'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="console-msg-avatar">
                      <Sparkles size={14} />
                    </div>
                  )}

                  <div className={`console-bubble ${msg.isError ? 'is-error' : ''}`}>
                    {msg.imagePreview && (
                      <div className="console-bubble-img">
                        <img src={msg.imagePreview} alt="Attached frame" />
                      </div>
                    )}
                    <div className="console-bubble-text">{msg.text}</div>
                    <span className="console-bubble-time">{msg.time}</span>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="console-bubble-row is-assistant">
                  <div className="console-msg-avatar">
                    <Sparkles size={14} />
                  </div>
                  <div className="console-bubble is-loading">
                    <div className="stylist-typing-dots">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                    <span className="loading-note">Aura is analyzing fit & colors...</span>
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Input Bar */}
            <form
              className="stylist-console-input-bar"
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
            >
              <input
                type="text"
                placeholder="Ask Aura anything about this outfit, footwear, colors..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                disabled={loading}
              />
              <button
                type="submit"
                className="console-send-btn"
                disabled={loading || !inputMessage.trim()}
                aria-label="Send message"
              >
                <Send size={15} />
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}

