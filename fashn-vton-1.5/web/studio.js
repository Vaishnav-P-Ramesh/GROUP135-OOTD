(() => {
  let personBase64 = null;
  let garmentBase64 = null;

  const personInput = document.getElementById("personInput");
  const garmentInput = document.getElementById("garmentInput");
  const personImg = document.getElementById("personImg");
  const garmentImg = document.getElementById("garmentImg");
  const personPlaceholder = document.getElementById("personPlaceholder");
  const garmentPlaceholder = document.getElementById("garmentPlaceholder");
  const personDrop = document.getElementById("personDrop");
  const garmentDrop = document.getElementById("garmentDrop");
  const generateBtn = document.getElementById("generateBtn");
  const spinner = document.getElementById("spinner");
  const btnText = document.getElementById("btnText");
  const statusBanner = document.getElementById("statusBanner");
  const resultImg = document.getElementById("resultImg");
  const outputPlaceholder = document.getElementById("outputPlaceholder");
  const downloadLink = document.getElementById("downloadLink");

  function setPreview(which, dataUrl) {
    if (which === "person") {
      personBase64 = dataUrl;
      personImg.src = dataUrl;
      personImg.hidden = false;
      personPlaceholder.hidden = true;
    } else {
      garmentBase64 = dataUrl;
      garmentImg.src = dataUrl;
      garmentImg.hidden = false;
      garmentPlaceholder.hidden = true;
    }
  }

  function readFile(file, which) {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => setPreview(which, e.target.result);
    reader.readAsDataURL(file);
  }

  function wireDrop(frame, input, which) {
    frame.addEventListener("dragover", (e) => {
      e.preventDefault();
      frame.classList.add("is-dragging");
    });
    frame.addEventListener("dragleave", () => frame.classList.remove("is-dragging"));
    frame.addEventListener("drop", (e) => {
      e.preventDefault();
      frame.classList.remove("is-dragging");
      const file = e.dataTransfer.files?.[0];
      readFile(file, which);
    });
    input.addEventListener("change", () => readFile(input.files?.[0], which));
  }

  wireDrop(personDrop, personInput, "person");
  wireDrop(garmentDrop, garmentInput, "garment");

  async function loadSample(url, which) {
    const res = await fetch(url);
    const blob = await res.blob();
    const reader = new FileReader();
    reader.onload = (e) => setPreview(which, e.target.result);
    reader.readAsDataURL(blob);
  }

  document.getElementById("samplePersonBtn").addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    loadSample("/api/sample/person", "person");
  });

  document.getElementById("sampleGarmentBtn").addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    loadSample("/api/sample/garment", "garment");
  });

  function guidanceForSteps(steps) {
    if (steps <= 10) return 1.0;
    if (steps <= 12) return 1.25;
    return 1.5;
  }

  async function runTryOn() {
    if (!personBase64 || !garmentBase64) {
      statusBanner.textContent = "Load both a person frame and a garment frame.";
      statusBanner.classList.add("is-error");
      return;
    }

    const numTimesteps = parseInt(document.getElementById("timestepsSelect").value, 10);
    const guidanceScale = guidanceForSteps(numTimesteps);

    generateBtn.disabled = true;
    spinner.hidden = false;
    btnText.textContent = "Developing…";
    statusBanner.classList.remove("is-error");
    statusBanner.textContent = `Developing ${numTimesteps} steps (guidance ${guidanceScale}). First load may take a minute.`;

    try {
      const start = Date.now();
      const res = await fetch("/api/tryon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          person_image: personBase64,
          garment_image: garmentBase64,
          category: document.getElementById("categorySelect").value,
          garment_photo_type: document.getElementById("photoTypeSelect").value,
          num_timesteps: numTimesteps,
          guidance_scale: guidanceScale,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Try-on failed");

      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      resultImg.src = data.output_image;
      resultImg.hidden = false;
      outputPlaceholder.hidden = true;
      downloadLink.href = data.output_image;
      downloadLink.hidden = false;
      statusBanner.textContent = `Developed in ${elapsed}s.`;
    } catch (err) {
      console.error(err);
      statusBanner.textContent = err.message || "Try-on failed";
      statusBanner.classList.add("is-error");
    } finally {
      generateBtn.disabled = false;
      spinner.hidden = true;
      btnText.textContent = "Develop try-on";
    }
  }

  generateBtn.addEventListener("click", runTryOn);
})();
