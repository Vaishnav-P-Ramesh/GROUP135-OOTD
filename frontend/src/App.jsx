import React, { useState, useRef, useEffect } from 'react';

export default function App() {
  const [currentPage, setCurrentPage] = useState('home'); // 'home' | 'studio'
  const [menuOpen, setMenuOpen] = useState(false);

  // Studio form states
  const [personImage, setPersonImage] = useState(null);
  const [garmentImage, setGarmentImage] = useState(null);
  const [category, setCategory] = useState('tops');
  const [photoType, setPhotoType] = useState('model');
  const [timesteps, setTimesteps] = useState('20');
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('Load both frames to begin.');
  const [outputImage, setOutputImage] = useState(null);

  const personInputRef = useRef(null);
  const garmentInputRef = useRef(null);
  const menuRef = useRef(null);
  const proofRef = useRef(null);

  // Sync hash/path routing smoothly
  useEffect(() => {
    const handleLocation = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;
      if (path === '/studio' || hash.includes('studio') || hash.includes('proof')) {
        setCurrentPage('studio');
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
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (page === 'studio') {
      window.history.pushState({}, '', targetHash ? `/studio#${targetHash}` : '/studio');
      if (targetHash === 'proof' && proofRef.current) {
        setTimeout(() => {
          proofRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } else {
      window.history.pushState({}, '', '/');
    }
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

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

  const runTryOn = async () => {
    if (!personImage || !garmentImage) {
      setStatusText('Please provide both a person photo and a garment photo.');
      return;
    }

    setLoading(true);
    setStatusText('Running try-on pipeline on local RTX 3050...');

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
      setStatusText('Proof ready.');
      setTimeout(() => {
        proofRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    } catch (err) {
      console.error(err);
      setStatusText(`Error: ${err.message || 'Execution failed'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={currentPage === 'studio' ? 'page-studio' : ''}>
      {/* Top Header / Navigation Bar */}
      <header className="topbar">
        <div className="topbar-left"></div>
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigateTo('home');
          }}
          aria-label="OOTD home"
        >
          <span className="brand-mark" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
          </span>
          <span className="brand-name">OOTD</span>
          <span className="brand-badge">
            {currentPage === 'studio' ? 'studio' : 'virtual try-on'}
          </span>
        </a>

        <div style={{ position: 'relative', justifySelf: 'end' }} ref={menuRef}>
          <button
            className={`menu-btn ${menuOpen ? 'is-active' : ''}`}
            aria-label="Menu"
            aria-expanded={menuOpen}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
          >
            <span></span>
          </button>
          <nav className={`menu-panel ${menuOpen ? 'is-open' : ''}`} aria-label="Site">
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
            <a
              href="#proof"
              onClick={(e) => {
                e.preventDefault();
                navigateTo('studio', 'proof');
              }}
            >
              Proof
            </a>
          </nav>
        </div>
      </header>

      {/* Page 1: Landing Home Page */}
      {currentPage === 'home' && (
        <main>
          <section className="hero">
            <div className="hero-inner">
              <h1>
                Make your outfit — <span className="hl">try-on ready</span>
              </h1>
              <p className="hero-lede">
                Upload a person photo and a garment. OOTD develops a photoreal try-on —
                your outfit of the day, proved in one frame.
              </p>

              <div className="cta-bar">
                <span className="cta-chip">Studio</span>
                <a
                  className="cta-main"
                  href="/studio"
                  onClick={(e) => {
                    e.preventDefault();
                    navigateTo('studio');
                  }}
                >
                  <span>Open OOTD Studio →</span>
                  <span aria-hidden="true">↵</span>
                </a>
              </div>
              <p className="cta-note">
                Or load samples in studio and hit <code>Develop try-on</code>
              </p>

              <ul className="feature-list">
                <li>
                  <svg className="feature-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path d="M4 7h16M4 12h10M4 17h14" />
                  </svg>
                  <div><strong>Person + garment.</strong> Two frames in. One proof out.</div>
                </li>
                <li>
                  <svg className="feature-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <circle cx="12" cy="12" r="8" />
                    <path d="M12 8v4l3 2" />
                  </svg>
                  <div><strong>Local model.</strong> Runs on your machine against OOTD weights.</div>
                </li>
                <li>
                  <svg className="feature-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path d="M7 7h10v10H7z" />
                    <path d="M3 3h4v4H3zM17 3h4v4h-4zM3 17h4v4H3zM17 17h4v4h-4z" />
                  </svg>
                  <div><strong>Tops, bottoms, one-pieces.</strong> Model shots or flat-lays.</div>
                </li>
                <li>
                  <svg className="feature-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path d="M4 12a8 8 0 0 1 14-5" />
                    <path d="M20 12a8 8 0 0 1-14 5" />
                    <path d="M18 4v4h-4M6 20v-4h4" />
                  </svg>
                  <div><strong>Speed or quality.</strong> Turbo for previews, Balanced for fit.</div>
                </li>
              </ul>

              <div className="dash-field" aria-hidden="true">
                <i></i><i></i><i></i><i></i>
              </div>

              <div className="preview-panel">
                <div className="active-tag">
                  <span className="bars" aria-hidden="true">
                    <b></b><b></b><b></b><b></b>
                  </span>
                  Active
                </div>
                <div className="preview-row">
                  <span className="chip"><span className="method">TRY</span> /studio · develop</span>
                  <span className="chip"><span className="method">OUT</span> proof.png · ready</span>
                </div>
                <div className="preview-photo">
                  <img src="/assets/hero-tryon.png" alt="Example OOTD try-on result" width="420" height="560" />
                </div>
              </div>
            </div>
          </section>

          <div className="checker" aria-hidden="true"></div>

          <section className="section" id="shift">
            <div className="section-inner">
              <span className="kicker">The fit</span>
              <h2>Your photo is <span className="hl">now the model</span></h2>
              <p>
                Stop guessing from flat product shots. OOTD puts the garment on{' '}
                <span className="mark">your frame</span> — face, pose, and scene kept —
                so you can decide before you buy or post.
              </p>
              <div className="contact-strip" aria-label="Person, garment, and result">
                <img src="/assets/sample-person.webp" alt="Sample person" />
                <img src="/assets/sample-garment.webp" alt="Sample garment" />
                <img src="/assets/hero-tryon.png" alt="Try-on result" />
              </div>
            </div>
          </section>

          <section className="section" style={{ paddingTop: 0 }}>
            <div className="section-inner">
              <span className="kicker green">Workflow</span>
              <h2>Two frames in. <span className="hl green">One proof out.</span></h2>
              <p>OOTD keeps the path short — load, set category, develop.</p>
              <div className="grid-3">
                <article className="card">
                  <h3>01 · Person frame</h3>
                  <p>Clear face, full torso. Natural light when you can.</p>
                </article>
                <article className="card">
                  <h3>02 · Garment frame</h3>
                  <p>Model shot or flat-lay. Tops, bottoms, or one-pieces.</p>
                </article>
                <article className="card">
                  <h3>03 · Develop</h3>
                  <p>Pick Turbo or Balanced. Download the proof when it lands.</p>
                </article>
              </div>
              <p style={{ marginTop: '28px' }}>
                <a
                  className="btn-ink"
                  href="/studio"
                  onClick={(e) => {
                    e.preventDefault();
                    navigateTo('studio');
                  }}
                >
                  Open Studio
                </a>
              </p>
            </div>
          </section>

          <div className="checker" aria-hidden="true"></div>

          <section className="section" style={{ background: 'var(--yellow)' }}>
            <div className="section-inner">
              <span className="kicker yellow">Get started</span>
              <h2>Setup is a breeze</h2>
              <p>
                Studio is already wired to the local model. Open it, drop two images
                (or use samples), and develop a try-on.
              </p>
              <div className="cta-bar">
                <span className="cta-chip">Go</span>
                <a
                  className="cta-main"
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
            <span className="kicker yellow">Studio</span>
            <h1>Develop a try-on</h1>
            <p>Load a person frame and a garment frame. OOTD runs the local model and returns the proof.</p>
          </section>

          <div className="bench">
            <div className="negatives">
              {/* Person Input Card */}
              <label className="negative" htmlFor="personInput">
                <div className="negative-head">
                  <span>Person</span>
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
                      <small>WebP · PNG · JPEG</small>
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
                  <span>Garment</span>
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
                      <small>Model shot or flat-lay</small>
                    </div>
                  )}
                </div>
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
                  <option value="one-pieces">One-pieces</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="photoTypeSelect">Garment photo</label>
                <select
                  id="photoTypeSelect"
                  value={photoType}
                  onChange={(e) => setPhotoType(e.target.value)}
                >
                  <option value="model">Model shot</option>
                  <option value="flat-lay">Flat-lay</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="timestepsSelect">Quality</label>
                <select
                  id="timestepsSelect"
                  value={timesteps}
                  onChange={(e) => setTimesteps(e.target.value)}
                >
                  <option value="10">Turbo — faster, softer</option>
                  <option value="20">Balanced — recommended</option>
                  <option value="30">Quality — sharper fit</option>
                  <option value="50">Max — slowest</option>
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
                <span>{loading ? 'Developing...' : 'Develop try-on'}</span>
              </button>
              <p className="status" role="status">{statusText}</p>
            </aside>
          </div>

          {/* Proof / Result Bay */}
          <section className="result-bay" id="proof" ref={proofRef} aria-live="polite">
            <div className="result-head">
              <span>Proof</span>
              {outputImage && (
                <a
                  className="text-btn"
                  download={`ootd-tryon-${Date.now()}.png`}
                  href={outputImage}
                >
                  Download
                </a>
              )}
            </div>
            <div className="result-frame">
              {outputImage ? (
                <img src={outputImage} alt="Try-on result" />
              ) : (
                <p className="result-empty">The developed frame appears here.</p>
              )}
            </div>
          </section>
        </main>
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
              <h3>Try-on</h3>
              <a
                href="/studio"
                onClick={(e) => {
                  e.preventDefault();
                  navigateTo('studio');
                }}
              >
                Develop
              </a>
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
              <h3>Model</h3>
              <a href="#">OOTD Model</a>
            </div>
          </div>
          <p className="footer-copy">OOTD · Outfit of the day · Local virtual try-on</p>
        </div>
      </footer>
    </div>
  );
}
