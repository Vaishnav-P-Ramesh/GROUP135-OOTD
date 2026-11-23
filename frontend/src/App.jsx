import React, { useState, useRef, useEffect } from 'react';
import StylistChat from './StylistChat';
import StylistPage from './StylistPage';

export default function App() {
  const [currentPage, setCurrentPage] = useState('home'); // 'home' | 'studio' | 'stylist'
  // Studio form states
  const [personImage, setPersonImage] = useState(null);
  const [garmentImage, setGarmentImage] = useState(null);
  const [category, setCategory] = useState('tops');
  const [photoType, setPhotoType] = useState('model');
  const [timesteps, setTimesteps] = useState('20');
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('Load both frames to begin.');
  const [outputImage, setOutputImage] = useState(null);

  // URL fetch states (garment from e-commerce link)
  const [garmentLinkUrl, setGarmentLinkUrl] = useState('');
  const [urlFetchLoading, setUrlFetchLoading] = useState(false);
  const [urlFetchError, setUrlFetchError] = useState('');

  // Loading timer states
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [loadingStage, setLoadingStage] = useState('');
  const timerRef = useRef(null);
  // Real inference benchmarks on RTX 3050 Laptop GPU:
  // Preprocessing: ~5s, Sampling: ~2.7s per step, Finalizing: ~2s
  const estimatedSeconds = { '10': 34, '20': 61, '30': 88, '50': 142 };

  // Stylist review states
  const [critique, setCritique] = useState(null);
  const [critiqueLoading, setCritiqueLoading] = useState(false);
  const [stylistOpen, setStylistOpen] = useState(false);

  const personInputRef = useRef(null);
  const garmentInputRef = useRef(null);
  const proofRef = useRef(null);

  // Sync hash/path routing smoothly
  useEffect(() => {
    const handleLocation = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;
      if (path === '/studio' || hash.includes('studio') || hash.includes('proof')) {
        setCurrentPage('studio');
      } else if (path === '/stylist' || hash.includes('stylist')) {
        setCurrentPage('stylist');
      } else {
        setCurrentPage('home');
      }
    };
    handleLocation();
    window.addEventListener('popstate', handleLocation);
    window.addEventListener('hashchange', handleLocation);
    return () => {
      window.removeEventListener('popstate', handleLocation);
      window.removeEventListener('hashchange', handleLocation);
    };
  }, []);

  const navigateTo = (page, targetHash = '') => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (page === 'studio') {
      window.history.pushState({}, '', targetHash ? `/studio#${targetHash}` : '/studio');
      if (targetHash === 'proof' && proofRef.current) {
        setTimeout(() => {
          proofRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } else if (page === 'stylist') {
      window.history.pushState({}, '', '/stylist');
    } else {
      window.history.pushState({}, '', '/');
    }
  };

  // Update status message dynamically based on uploaded inputs
  useEffect(() => {
    if (!loading) {
      if (!personImage && !garmentImage) {
        setStatusText('Load both frames to begin.');
      } else if (!personImage) {
        setStatusText('Load a person frame to continue.');
      } else if (!garmentImage) {
        setStatusText('Load a garment frame to continue.');
      } else {
        setStatusText('Ready. Click "Develop try-on".');
      }
    }
  }, [personImage, garmentImage, loading]);

  const handleFileChange = (e, setter) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => setter(event.target.result);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e, setter) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => setter(event.target.result);
      reader.readAsDataURL(file);
    }
  };

  const loadSample = async (type) => {
    try {
      setStatusText(`Loading sample ${type}...`);
      const res = await fetch(`/api/sample/${type}`);
      if (!res.ok) throw new Error('Sample not found');
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onload = (event) => {
        if (type === 'person') setPersonImage(event.target.result);
        if (type === 'garment') setGarmentImage(event.target.result);
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      setStatusText(`Could not load sample ${type}. Ensure backend server is running.`);
    }
  };

  const fetchGarmentFromUrl = async () => {
    const url = garmentLinkUrl.trim();
    if (!url) return;
    setUrlFetchLoading(true);
    setUrlFetchError('');
    try {
      const res = await fetch('/api/fetch-garment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Could not load garment from link');
      setGarmentImage(data.image);
      setGarmentLinkUrl('');
      setPhotoType('flat-lay');
    } catch (err) {
      setUrlFetchError(err.message);
    } finally {
      setUrlFetchLoading(false);
    }
  };

  const runTryOn = async () => {
    if (!personImage || !garmentImage) {
      setStatusText('Please provide both a person photo and a garment photo.');
      return;
    }

    setLoading(true);
    setStatusText('Creating your look...');
    setElapsedSeconds(0);
    setLoadingStage('Fitting your outfit…');

    const totalEst = estimatedSeconds[timesteps] || 61;
    const startTime = Date.now();

    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setElapsedSeconds(elapsed);

        // Friendly non-technical status
        if (elapsed < totalEst - 6) {
          setLoadingStage('Fitting your outfit…');
        } else {
          setLoadingStage('Adding final touches…');
        }
      }, 1000);

    try {
      const response = await fetch('/api/tryon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person_image: personImage,
          garment_image: garmentImage,
          category,
          garment_photo_type: photoType,
          num_timesteps: parseInt(timesteps, 10),
        }),
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Server error during virtual try-on.');
      }

      setOutputImage(data.output_image);
      setStatusText('Your look is ready!');
      setTimeout(() => {
        proofRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 150);

      // Automatically trigger Stylist rating out of 10 and critique
      triggerStylistCritique(data.output_image);
    } catch (err) {
      console.error(err);
      setStatusText(`Error: ${err.message || 'Execution failed'}`);
    } finally {
      clearInterval(timerRef.current);
      setLoading(false);
    }
  };

  const triggerStylistCritique = async (imageUrl) => {
    if (!imageUrl) return;
    setCritiqueLoading(true);
    setCritique(null);

    const apiKey = localStorage.getItem('ootd_gemini_api_key') || '';
    try {
      const response = await fetch('/api/stylist/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Rate this developed virtual try-on outfit out of 10. Tell me clearly what is right and what is wrong with the fit and combination.',
          image: imageUrl,
          apiKey
        })
      });
      const resData = await response.json();
      if (response.ok && resData.success) {
        setCritique(resData.reply);
      } else {
        setCritique('Could not generate automatic critique. Ask Aura in the chat drawer!');
      }
    } catch (err) {
      setCritique('Could not reach stylist for rating.');
    } finally {
      setCritiqueLoading(false);
    }
  };

  return (
    <div className={currentPage === 'studio' ? 'page-studio' : ''}>
      {/* Top Header / Navigation Bar (Floating Medallion Bean) */}
      <div className="topbar-wrapper">
        <header className="bean-nav-bar" role="banner">
          <div className="bean-nav-side bean-nav-left">
            <a
              href="/"
              className={`bean-nav-link ${currentPage === 'home' ? 'is-active' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                navigateTo('home');
              }}
            >
              <span>HOME</span>
            </a>
          </div>

          <a
            href="/"
            className="bean-nav-medallion"
            onClick={(e) => {
              e.preventDefault();
              navigateTo('home');
            }}
            aria-label="OOTD Home"
            title="OOTD · Virtual Fitting"
          >
            <div className="medallion-ring-outer">
              <div className="medallion-ring-inner">
                <span className="medallion-letters">OOTD</span>
              </div>
            </div>
          </a>

          <div className="bean-nav-side bean-nav-right">
            <a
              href="/studio"
              className={`bean-nav-link ${currentPage === 'studio' ? 'is-active' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                navigateTo('studio');
              }}
            >
              <span>STUDIO</span>
            </a>
            <a
              href="/stylist"
              className={`bean-nav-link bean-nav-stylist-link ${currentPage === 'stylist' ? 'is-active' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                navigateTo('stylist');
              }}
            >
              <span>STYLIST</span>
            </a>
          </div>
        </header>
      </div>

      {/* Page 1: Landing Home Page */}
      {currentPage === 'home' && (
        <main className="saas-home">
          {/* SaaS Hero */}
          <section className="hero saas-hero">
            <div className="hero-inner saas-hero-grid">
              {/* Left Column: Hero Copy & CTA */}
              <div className="saas-hero-content">
                <div className="saas-badge-pill" data-aos="fade-down">
                  <span className="saas-live-dot"></span>
                  <span>Virtual Fitting Room</span>
                  <span className="saas-pill-tag">Instant Try-On</span>
                </div>

                <h1 className="saas-headline">
                  See Any Outfit On You <br />
                  <span className="hl saas-hl">Before You Buy</span>
                </h1>

                <p className="hero-lede saas-lede">
                  Upload your photo and any clothing item. Get realistic, instant previews and personal styling advice in seconds.
                </p>

                <div className="saas-cta-group">
                  <div className="cta-bar saas-cta-bar">
                    <span className="cta-chip">New</span>
                    <a
                      className="cta-main saas-cta-main"
                      href="/studio"
                      onClick={(e) => {
                        e.preventDefault();
                        navigateTo('studio');
                      }}
                    >
                      <span>Try On Clothes Free →</span>
                      <span className="cta-icon-corner" aria-hidden="true">↵</span>
                    </a>
                  </div>
                </div>
              </div>

              {/* Right Column: Symmetrical Live Preview Mockup */}
              <div className="saas-hero-preview-col">
                <div className="saas-window-card">
                  <div className="saas-window-header">
                    <div className="window-dots">
                      <span className="w-dot red"></span>
                      <span className="w-dot yellow"></span>
                      <span className="w-dot green"></span>
                    </div>
                    <div className="window-action-chip">
                      <span className="live-indicator">LIVE PREVIEW</span>
                    </div>
                  </div>

                  <div className="saas-window-body">
                    <div className="saas-stage-grid">
                      {/* Card 01: Photo */}
                      <div className="saas-frame-col">
                        <div className="frame-meta-bar">
                          <span>PHOTO</span>
                          <span className="tag">01</span>
                        </div>
                        <div className="saas-img-wrapper">
                          <img src="/assets/sample-person.webp" alt="Your Photo" />
                        </div>
                      </div>

                      {/* Symmetric Connector + */}
                      <div className="stage-sym-connector" title="Add Outfit">
                        <span>+</span>
                      </div>

                      {/* Card 02: Garment */}
                      <div className="saas-frame-col">
                        <div className="frame-meta-bar">
                          <span>OUTFIT</span>
                          <span className="tag">02</span>
                        </div>
                        <div className="saas-img-wrapper">
                          <img src="/assets/sample-garment.webp" alt="Target Garment" />
                        </div>
                      </div>

                      {/* Symmetric Connector → */}
                      <div className="stage-sym-connector stage-sym-arrow" title="Transform">
                        <span>→</span>
                      </div>

                      {/* Card 03: Result */}
                      <div className="saas-frame-col proof-col">
                        <div className="frame-meta-bar hl-bar">
                          <span>NEW LOOK</span>
                          <span className="tag green-tag">10/10</span>
                        </div>
                        <div className="saas-img-wrapper proof-glow">
                          <img src="/assets/hero-tryon.png" alt="Try-on Result" />
                          <div className="proof-hover-overlay">
                            <span>Styled by Aura</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="checker" aria-hidden="true"></div>

          {/* SaaS Metrics Ribbon */}
          <section className="saas-metrics-strip">
            <div className="metrics-inner">
              <div className="metric-box">
                <span className="metric-num">Instant</span>
                <span className="metric-title">Private & Fast</span>
                <p>Your photos stay 100% private and protected on your device.</p>
              </div>
              <div className="metric-box">
                <span className="metric-num">100%</span>
                <span className="metric-title">Natural Fit</span>
                <p>Preserves your real body proportions, pose, hair, and background.</p>
              </div>
              <div className="metric-box">
                <span className="metric-num">All Styles</span>
                <span className="metric-title">Full Wardrobe</span>
                <p>Try on Tops, Bottoms, and full outfits from any catalog photo.</p>
              </div>
              <div className="metric-box">
                <span className="metric-num">Aura AI</span>
                <span className="metric-title">Outfit Stylist</span>
                <p>Instant outfit ratings, style tips, and shoe or accessory pairing.</p>
              </div>
            </div>
          </section>

          <div className="checker" aria-hidden="true"></div>

          {/* SaaS Feature Matrix */}
          <section className="section saas-feature-section">
            <div className="section-inner">
              <div className="section-head-saas">
                <span className="kicker green">Features</span>
                <h2>Everything you need for <span className="hl green">the perfect outfit</span></h2>
                <p>Designed for shoppers, creators, and fashion lovers.</p>
              </div>

              <div className="saas-cards-grid">
                <article className="saas-feature-card">
                  <div className="card-top-icon">⚡</div>
                  <h3>Realistic Fabric Draping</h3>
                  <p>Fabrics naturally fold, drape, and adjust to your exact body shape and pose with realistic lighting and shadows.</p>
                  <div className="card-footer-tag">Natural Fit</div>
                </article>

                <article className="saas-feature-card">
                  <div className="card-top-icon">🎨</div>
                  <h3>Personal AI Stylist</h3>
                  <p>Aura reviews your look, scores your outfit out of 10, highlights what works, and suggests ideal footwear and accessories.</p>
                  <div className="card-footer-tag">Fashion Advice</div>
                </article>

                <article className="saas-feature-card">
                  <div className="card-top-icon">✨</div>
                  <h3>Studio-Grade Quality</h3>
                  <p>Enjoy crisp details with razor-sharp fabric textures, collar creases, logos, and high-resolution rendering.</p>
                  <div className="card-footer-tag">Crisp Clarity</div>
                </article>
              </div>
            </div>
          </section>

          <div className="checker" aria-hidden="true"></div>

          {/* Interactive Flow Demonstration */}
          <section className="section saas-workflow-section" id="shift">
            <div className="section-inner">
              <div className="section-head-saas">
                <span className="kicker">Simple & Fast</span>
                <h2>From photo to <span className="hl">new look in seconds</span></h2>
                <p>Three easy steps to try on any piece of clothing.</p>
              </div>

              <div className="saas-steps-row">
                <div className="step-card">
                  <span className="step-index">01</span>
                  <h4>Upload Your Photo</h4>
                  <p>Choose any clear portrait or full-body photo of yourself.</p>
                </div>
                <div className="step-arrow">→</div>
                <div className="step-card">
                  <span className="step-index">02</span>
                  <h4>Pick an Outfit</h4>
                  <p>Select any garment, shirt, pants, or dress you want to try on.</p>
                </div>
                <div className="step-arrow">→</div>
                <div className="step-card highlight">
                  <span className="step-index hl-index">03</span>
                  <h4>See Your Look & Advice</h4>
                  <p>View your new outfit instantly, complete with a personalized stylist rating.</p>
                </div>
              </div>

              <div className="saas-try-banner">
                <div className="try-banner-content">
                  <h3>Ready to see your new look?</h3>
                  <p>Try on clothes instantly right in your browser.</p>
                </div>
                <a
                  className="btn-ink saas-btn-elevated"
                  href="/studio"
                  onClick={(e) => {
                    e.preventDefault();
                    navigateTo('studio');
                  }}
                >
                  Open Fitting Room →
                </a>
              </div>
            </div>
          </section>

          <div className="checker" aria-hidden="true"></div>

          {/* Bottom SaaS CTA */}
          <section className="section saas-bottom-cta" style={{ background: 'var(--yellow)' }}>
            <div className="section-inner saas-cta-center">
              <span className="kicker yellow">Instant Access</span>
              <h2>Ready to find your style?</h2>
              <p>
                Try on new clothes virtually and get personal styling tips in real time.
              </p>
              <div className="cta-bar saas-cta-bar saas-cta-large">
                <span className="cta-chip">Start Now</span>
                <a
                  className="cta-main saas-cta-main"
                  href="/studio"
                  onClick={(e) => {
                    e.preventDefault();
                    navigateTo('studio');
                  }}
                >
                  <span>Launch OOTD Studio</span>
                  <span aria-hidden="true">↵</span>
                </a>
              </div>
            </div>
          </section>
        </main>
      )}

      {/* Page 2: Studio Application */}
      {currentPage === 'studio' && (
        <main className="studio">
          <section className="studio-hero">
            <span className="kicker yellow">Fitting Room</span>
            <h1>Virtual Try-On</h1>
            <p>Upload a photo of yourself and a clothing item to preview your new outfit instantly.</p>
          </section>

          <div className="bench">
            <div className="negatives">
              {/* Person Input Card */}
              <label className="negative" htmlFor="personInput">
                <div className="negative-head">
                  <span>Your Photo</span>
                  <button
                    type="button"
                    className="text-btn"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      loadSample('person');
                    }}
                  >
                    Use sample
                  </button>
                </div>
                <div
                  className="negative-frame"
                  onDrop={(e) => handleDrop(e, setPersonImage)}
                  onDragOver={(e) => e.preventDefault()}
                >
                  {personImage ? (
                    <img src={personImage} alt="Person target" />
                  ) : (
                    <div className="negative-empty">
                      <span>Drop or click</span>
                      <small>Upload your portrait or photo</small>
                    </div>
                  )}
                </div>
                <input
                  type="file"
                  id="personInput"
                  ref={personInputRef}
                  accept="image/*"
                  hidden
                  onChange={(e) => handleFileChange(e, setPersonImage)}
                />
              </label>

              {/* Garment Input Card */}
              <label className="negative" htmlFor="garmentInput">
                <div className="negative-head">
                  <span>Clothing Item</span>
                  <button
                    type="button"
                    className="text-btn"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      loadSample('garment');
                    }}
                  >
                    Use sample
                  </button>
                </div>
                <div
                  className="negative-frame"
                  onDrop={(e) => handleDrop(e, setGarmentImage)}
                  onDragOver={(e) => e.preventDefault()}
                >
                  {garmentImage ? (
                    <img src={garmentImage} alt="Garment target" />
                  ) : (
                    <div className="negative-empty">
                      <span>Drop or click</span>
                      <small>Catalog photo or model shot</small>
                    </div>
                  )}
                </div>
                {/* URL Link Paste for E-Commerce */}
                <div className="garment-url-row" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="url"
                    className="garment-url-input"
                    placeholder="Paste clothing link from any store…"
                    value={garmentLinkUrl}
                    onChange={(e) => setGarmentLinkUrl(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.stopPropagation();
                        fetchGarmentFromUrl();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="garment-url-fetch-btn"
                    disabled={!garmentLinkUrl.trim() || urlFetchLoading}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      fetchGarmentFromUrl();
                    }}
                  >
                    {urlFetchLoading ? <span className="spinner" /> : '→'}
                  </button>
                </div>
                {urlFetchError && <p className="garment-url-error" onClick={(e) => e.stopPropagation()}>{urlFetchError}</p>}
                <input
                  type="file"
                  id="garmentInput"
                  ref={garmentInputRef}
                  accept="image/*"
                  hidden
                  onChange={(e) => handleFileChange(e, setGarmentImage)}
                />
              </label>
            </div>

            {/* Develop Configuration Sidebar */}
            <aside className="develop-panel">
              <div className="field">
                <label htmlFor="categorySelect">Category</label>
                <select
                  id="categorySelect"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="tops">Tops</option>
                  <option value="bottoms">Bottoms</option>
                  <option value="one-pieces">One-pieces / Dresses</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="photoTypeSelect">Clothing photo type</label>
                <select
                  id="photoTypeSelect"
                  value={photoType}
                  onChange={(e) => setPhotoType(e.target.value)}
                >
                  <option value="model">Worn by model</option>
                  <option value="flat-lay">Flat-lay / Catalog</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="timestepsSelect">Quality</label>
                <select
                  id="timestepsSelect"
                  value={timesteps}
                  onChange={(e) => setTimesteps(e.target.value)}
                >
                  <option value="10">Fast</option>
                  <option value="20">Standard (Recommended)</option>
                  <option value="30">High Quality</option>
                  <option value="50">Ultra HD</option>
                </select>
              </div>

              <button
                type="button"
                className="btn-ink btn-block"
                id="generateBtn"
                disabled={loading || !personImage || !garmentImage}
                onClick={runTryOn}
              >
                {loading && <span className="spinner"></span>}
                <span>{loading ? 'Creating Your Look...' : 'Try on Outfit'}</span>
              </button>

              {loading ? (
                <div className="tryon-timer-block">
                  <div className="timer-stage-row">
                    <span className="timer-stage-text">{loadingStage}</span>
                    <span className="timer-percent">
                      {Math.min(98, Math.max(5, elapsedSeconds < (estimatedSeconds[timesteps] || 61)
                        ? Math.round((elapsedSeconds / (estimatedSeconds[timesteps] || 61)) * 92)
                        : 93 + Math.min(5, Math.floor((elapsedSeconds - (estimatedSeconds[timesteps] || 61)) / 4))
                      ))}%
                    </span>
                  </div>
                  <div className="timer-bar-wrap">
                    <div
                      className="timer-bar-fill"
                      style={{
                        width: `${Math.min(98, Math.max(5, elapsedSeconds < (estimatedSeconds[timesteps] || 61)
                          ? Math.round((elapsedSeconds / (estimatedSeconds[timesteps] || 61)) * 92)
                          : 93 + Math.min(5, Math.floor((elapsedSeconds - (estimatedSeconds[timesteps] || 61)) / 4))
                        ))}%`
                      }}
                    />
                  </div>
                  <div className="timer-meta-row">
                    <span className="timer-elapsed">{elapsedSeconds}s elapsed</span>
                    <span className="timer-remaining">
                      {(() => {
                        const total = estimatedSeconds[timesteps] || 61;
                        const remaining = total - elapsedSeconds;
                        return remaining > 0 ? `~${remaining}s remaining` : 'Finishing up…';
                      })()}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="status" role="status">{statusText}</p>
              )}
            </aside>
          </div>

          {/* Proof / Result Bay */}
          <section className="result-bay" id="proof" ref={proofRef} aria-live="polite">
            <div className="result-head">
              <span>Your Result</span>
              {outputImage && (
                <a
                  className="text-btn"
                  download={`ootd-tryon-${Date.now()}.png`}
                  href={outputImage}
                >
                  Download Image
                </a>
              )}
            </div>
            <div className="result-frame">
              {outputImage ? (
                <img src={outputImage} alt="Try-on result" />
              ) : (
                <p className="result-empty">Your generated outfit will appear here.</p>
              )}
            </div>

            {/* Stylist Rating & Critique Card */}
            {(critiqueLoading || critique) && (
              <div className="proof-stylist-bay">
                <div className="proof-stylist-head">
                  <div className="stylist-badge">
                    <span className="dot"></span>
                    <span>Aura · Outfit Evaluation</span>
                  </div>
                  {critiqueLoading && <span className="critique-loading-label">Evaluating fit & silhouette...</span>}
                </div>
                {critiqueLoading ? (
                  <div className="critique-skeleton">
                    <div className="skel-line w-40"></div>
                    <div className="skel-line w-80"></div>
                    <div className="skel-line w-60"></div>
                  </div>
                ) : (
                  (() => {
                    const match = critique.match(/^Rating:\s*([0-9]+(?:\.[0-9]+)?(?:\/10)?)/i);
                    const score = match ? match[1].replace('/10', '') : null;
                    const bodyText = match ? critique.replace(match[0], '').trim() : critique;

                    return (
                      <div className="proof-stylist-content">
                        {score && (
                          <div className="score-hero-card">
                            <div className="score-badge">
                              <span className="score-num">{score}</span>
                              <span className="score-denom">/10</span>
                            </div>
                            <div className="score-meta">
                              <span className="score-label">Stylist Overall Score</span>
                              <span className="score-tagline">
                                {Number(score) >= 8 ? 'Outstanding Silhouette' : Number(score) >= 6 ? 'Good Base · Refinements Needed' : 'Needs Restyling'}
                              </span>
                            </div>
                          </div>
                        )}
                        <div className="proof-stylist-body">
                          {bodyText}
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>
            )}
          </section>
        </main>
      )}

      {/* Page 3: Dedicated AI Stylist Page */}
      {currentPage === 'stylist' && (
        <StylistPage
          currentImage={outputImage}
          personImage={personImage}
          garmentImage={garmentImage}
          critique={critique}
          onNavigate={navigateTo}
        />
      )}

      <div className="checker" aria-hidden="true"></div>

      {/* Shared Site Footer */}
      <footer className="site-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <span className="brand-mark" aria-hidden="true">
              <span></span><span></span><span></span>
            </span>
            <strong>OOTD</strong>
          </div>
          <div className="footer-grid">
            <div>
              <h3>Product</h3>
              <a
                href="/"
                onClick={(e) => {
                  e.preventDefault();
                  navigateTo('home');
                }}
              >
                Home
              </a>
              <a
                href="/studio"
                onClick={(e) => {
                  e.preventDefault();
                  navigateTo('studio');
                }}
              >
                Studio
              </a>
            </div>
            <div>
              <h3>Explore</h3>
              <a
                href="/studio"
                onClick={(e) => {
                  e.preventDefault();
                  navigateTo('studio');
                  loadSample('person');
                }}
              >
                Sample person
              </a>
              <a
                href="/studio"
                onClick={(e) => {
                  e.preventDefault();
                  navigateTo('studio');
                  loadSample('garment');
                }}
              >
                Sample garment
              </a>
            </div>
            <div>
              <h3>Privacy</h3>
              <a href="#privacy" onClick={(e) => e.preventDefault()}>100% Private</a>
              <a href="#privacy" onClick={(e) => e.preventDefault()}>On-Device</a>
            </div>
          </div>
          <p className="footer-copy">OOTD · Virtual Fitting Room & Outfit Stylist</p>
        </div>
      </footer>

      {/* AI Personal Stylist Assistant Floating Widget */}
      {currentPage !== 'stylist' && (
        <StylistChat
          currentImage={outputImage}
          personImage={personImage}
          garmentImage={garmentImage}
          isOpen={stylistOpen}
          setIsOpen={setStylistOpen}
        />
      )}
    </div>
  );
}
