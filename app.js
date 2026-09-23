/* =========================================================
   IMAGECONVERT — wasm-vips IMAGE PATH + FFmpeg VIDEO PATH
   =========================================================
   IMAGES: wasm-vips (libvips via WebAssembly)
   VIDEO:  @ffmpeg/ffmpeg ESM build via esm.sh
========================================================= */

/* =========================================================
   IMPORTS
========================================================= */
import Vips from './vips/vips-es6.js';
import { FFmpeg } from 'https://esm.sh/@ffmpeg/ffmpeg@0.12.15';
import { fetchFile, toBlobURL } from 'https://esm.sh/@ffmpeg/util@0.12.2';

/* =========================================================
   ELEMENT REFERENCES
========================================================= */
const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const chooseImageBtn = document.getElementById("chooseImageBtn");

const editor = document.getElementById("editor");
const previewImage = document.getElementById("previewImage");
const fileName = document.getElementById("fileName");
const originalSize = document.getElementById("originalSize");
const dimensions = document.getElementById("dimensions");

const formatSelect = document.getElementById("formatSelect");
const qualitySlider = document.getElementById("qualitySlider");
const qualityValue = document.getElementById("qualityValue");

const convertButton = document.getElementById("convertButton");
const resetButton = document.getElementById("resetButton");

/* VIDEO */
const videoDropZone = document.getElementById("videoDropZone");
const videoInput = document.getElementById("videoInput");
const chooseVideoBtn = document.getElementById("chooseVideoBtn");

const videoEditor = document.getElementById("videoEditor");
const videoPreview = document.getElementById("videoPreview");
const videoFileName = document.getElementById("videoFileName");
const videoFileSize = document.getElementById("videoFileSize");
const videoDuration = document.getElementById("videoDuration");

const videoFormat = document.getElementById("videoFormatSelect");
const videoQuality = document.getElementById("videoQuality");
const videoQualityValue = document.getElementById("videoQualityValue");

const videoConvertButton = document.getElementById("videoConvertButton");
const videoResetButton = document.getElementById("videoResetButton");

/* THEME */
const themeButton = document.getElementById("themeButton");
const themeIcon = document.getElementById("themeIcon");

/* =========================================================
   STATE
========================================================= */
let selectedFile = null;
let imageObjectURL = null;

let selectedVideoFile = null;
let videoObjectURL = null;

let vips = null;
let vipsLoaded = false;
let vipsLoading = false;

let ffmpeg = null;
let ffmpegLoaded = false;
let ffmpegLoading = false;

/* =========================================================
   FFmpeg CONFIG
========================================================= */
const FFMPEG_CORE_VERSION = "0.12.10";
const FFMPEG_CORE_BASE =
  `https://unpkg.com/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/esm`;

/* =========================================================
   HELPERS
========================================================= */
function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function getBaseName(name) {
  return (
    name
      .replace(/\.[^/.]+$/, "")
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
      .trim() || "converted-file"
  );
}

function getExtension(mime) {
  const map = {
    "image/jpeg": "jpg", "image/jpg": "jpg",
    "image/png": "png", "image/webp": "webp",
    "image/gif": "gif", "image/bmp": "bmp",
    "image/tiff": "tiff", "image/avif": "avif",
    "image/x-icon": "ico", "image/vnd.microsoft.icon": "ico",
    "video/mp4": "mp4", "video/webm": "webm",
    "video/quicktime": "mov", "video/x-msvideo": "avi",
    "video/x-matroska": "mkv",
  };
  return map[mime] || "bin";
}

function normalizeToMime(value) {
  if (!value) return "image/png";
  if (value.includes("/")) return value;

  const map = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
    webp: "image/webp", gif: "image/gif", bmp: "image/bmp",
    tiff: "image/tiff", tif: "image/tiff", avif: "image/avif",
    ico: "image/x-icon",
    mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
    avi: "video/x-msvideo", mkv: "video/x-matroska",
  };
  return map[value.toLowerCase()] || "application/octet-stream";
}

function setButtonText(button, text) {
  if (button) button.textContent = text;
}

function downloadBlob(blob, name) {
  if (!blob) throw new Error("No output file was created.");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function getFileExtension(name) {
  const match = name.match(/\.([^.]+)$/);
  return match ? match[1].toLowerCase() : "";
}

/* =========================================================
   wasm-vips LOADER
========================================================= */
async function loadVips() {
  if (vipsLoaded && vips) return vips;

  if (vipsLoading) {
    while (vipsLoading) await new Promise((r) => setTimeout(r, 100));
    if (vipsLoaded && vips) return vips;
  }

  vipsLoading = true;

  try {
    vips = await Vips();
    vipsLoaded = true;
    console.log("[wasm-vips] loaded successfully");
    return vips;
  } catch (error) {
    vips = null;
    vipsLoaded = false;
    console.error("[wasm-vips] load failed:", error);
    throw new Error(
      "Failed to initialize wasm-vips. " +
      "Make sure vips-es6.js and vips.wasm are in the ./vips/ folder, " +
      "and that coi-serviceworker.js is working (check console for COOP/COEP errors)."
    );
  } finally {
    vipsLoading = false;
  }
}

/* =========================================================
   FFmpeg LOADER (ESM)
========================================================= */
async function loadFFmpeg() {
  if (ffmpegLoaded && ffmpeg) return ffmpeg;

  if (ffmpegLoading) {
    while (ffmpegLoading) await new Promise((r) => setTimeout(r, 100));
    if (ffmpegLoaded && ffmpeg) return ffmpeg;
  }

  ffmpegLoading = true;

  try {
    ffmpeg = new FFmpeg();

    ffmpeg.on("progress", ({ progress }) => {
      const pct = Math.min(100, Math.max(0, Math.round(progress * 100)));
      updateConversionProgress(pct);
    });

    ffmpeg.on("log", ({ message }) => {
      console.log("[FFmpeg]", message);
    });

    updateConversionStatus("Downloading FFmpeg core (~30 MB)...");

    const coreURL = await toBlobURL(
      `${FFMPEG_CORE_BASE}/ffmpeg-core.js`,
      "text/javascript"
    );
    const wasmURL = await toBlobURL(
      `${FFMPEG_CORE_BASE}/ffmpeg-core.wasm`,
      "application/wasm"
    );

    updateConversionStatus("Initializing FFmpeg...");
    await ffmpeg.load({
      coreURL,
      wasmURL,
      classWorkerURL: new URL('worker.js', location.href).href
    });

    ffmpegLoaded = true;
    updateConversionStatus("FFmpeg ready");
    console.log("[FFmpeg] core loaded from", FFMPEG_CORE_BASE);
    return ffmpeg;
  } catch (error) {
    ffmpeg = null;
    ffmpegLoaded = false;
    console.error("[FFmpeg] load failed:", error);
    throw error;
  } finally {
    ffmpegLoading = false;
  }
}

/* =========================================================
   STATUS / PROGRESS
========================================================= */
function updateConversionProgress(percent) {
  document.querySelectorAll("[data-conversion-progress]")
    .forEach((el) => (el.textContent = `${percent}%`));
}

function updateConversionStatus(message) {
  document.querySelectorAll("[data-conversion-status]")
    .forEach((el) => (el.textContent = message));
}

/* =========================================================
   IMAGE PICKER
========================================================= */
if (dropZone && fileInput) {
  dropZone.addEventListener("click", (e) => {
    if (e.target === chooseImageBtn || chooseImageBtn?.contains(e.target)) return;
    fileInput.click();
  });

  dropZone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      fileInput.click();
    }
  });

  fileInput.addEventListener("change", () => {
    if (fileInput.files && fileInput.files.length > 0) {
      handleImageFile(fileInput.files[0]);
    }
  });

  dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropZone.classList.add("dragging");
  });
  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragging");
  });
  dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropZone.classList.remove("dragging");
    const files = event.dataTransfer.files;
    if (files && files.length > 0) handleImageFile(files[0]);
  });
}

if (chooseImageBtn && fileInput) {
  chooseImageBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    fileInput.click();
  });
}

/* =========================================================
   IMAGE FILE
========================================================= */
function handleImageFile(file) {
  if (!file || !file.type.startsWith("image/")) {
    alert("Please select a valid image file.");
    return;
  }

  selectedFile = file;

  if (imageObjectURL) URL.revokeObjectURL(imageObjectURL);
  imageObjectURL = URL.createObjectURL(file);

  if (previewImage) {
    previewImage.src = imageObjectURL;
    previewImage.onload = () => {
      if (dimensions) {
        dimensions.textContent =
          `${previewImage.naturalWidth} × ${previewImage.naturalHeight}`;
      }
    };
  }

  if (fileName) fileName.textContent = file.name;
  if (originalSize) originalSize.textContent = formatFileSize(file.size);

  if (dropZone) dropZone.style.display = "none";
  if (editor) {
    editor.hidden = false;
    editor.classList.add("active");
  }
}

/* =========================================================
   IMAGE QUALITY
========================================================= */
if (qualitySlider && qualityValue) {
  qualitySlider.addEventListener("input", () => {
    qualityValue.textContent = `${qualitySlider.value}%`;
  });
  qualityValue.textContent = `${qualitySlider.value}%`;
}

/* =========================================================
   IMAGE CONVERSION — wasm-vips
========================================================= */
if (convertButton) {
  convertButton.addEventListener("click", convertImage);
}

async function convertImage() {
  if (!selectedFile) return;

  const rawOutput = formatSelect ? formatSelect.value : "image/png";
  const outputMime = normalizeToMime(rawOutput);

  convertButton.disabled = true;
  setButtonText(convertButton, "Converting...");

  try {
    await convertImageWithVips(outputMime);
    finishImageConversion(true);
  } catch (error) {
    console.error("[Image] conversion failed:", error);
    finishImageConversion(false, error);
  }
}

function finishImageConversion(success, error) {
  if (success) {
    setButtonText(convertButton, "✓ Downloaded");
  } else {
    setButtonText(convertButton, "Convert & Download");
    alert(
      "Image conversion failed.\n\nReason: " +
        (error && error.message ? error.message : "Unknown error")
    );
  }

  setTimeout(() => {
    setButtonText(convertButton, "Convert & Download");
    convertButton.disabled = false;
  }, 1500);
}

/* =========================================================
   wasm-vips IMAGE CONVERSION
========================================================= */
async function convertImageWithVips(outputMime) {
  const engine = await loadVips();

  const quality = Math.min(
    1,
    Math.max(0.01, Number(qualitySlider ? qualitySlider.value : 85) / 100)
  );

  const inputExtension = getFileExtension(selectedFile.name) || "img";
  const outputExtension = getExtension(outputMime);

  const arrayBuffer = await selectedFile.arrayBuffer();
  const inputBuffer = new Uint8Array(arrayBuffer);

  let image;
  try {
    image = engine.Image.newFromBuffer(inputBuffer);
  } catch (e) {
    throw new Error(
      `wasm-vips could not read this ${inputExtension.toUpperCase()} file. ` +
      (e.message || "The file may be corrupted or in an unsupported variant.")
    );
  }

  const saveOptions = {};

  if (outputExtension === "jpg" || outputExtension === "jpeg") {
    saveOptions.Q = Math.round(quality * 100);
    saveOptions.optimizeCoding = true;
  } else if (outputExtension === "webp") {
    saveOptions.Q = Math.round(quality * 100);
  } else if (outputExtension === "png") {
    saveOptions.compression = 9;
    if (quality < 1) {
      saveOptions.palette = true;
      saveOptions.Q = Math.round(quality * 100);
    }
  } else if (outputExtension === "avif") {
    saveOptions.Q = Math.round(quality * 100);
  } else if (outputExtension === "tiff") {
    saveOptions.compression = "lzw";
    saveOptions.Q = Math.round(quality * 100);
  } else if (outputExtension === "ico") {
    const maxDim = 256;
    const scale = Math.min(1, maxDim / Math.max(image.width, image.height));
    if (scale < 1) {
      const resized = image.resize(scale);
      image.delete();
      image = resized;
    }
  }

  let outputBuffer;
  try {
    outputBuffer = image.writeToBuffer(`.${outputExtension}`, saveOptions);
  } catch (e) {
    image.delete();
    throw new Error(
      `wasm-vips could not encode to ${outputExtension.toUpperCase()}. ` +
      (e.message || "This format may not be supported by the current build.")
    );
  }

  image.delete();

  const blob = new Blob([outputBuffer], { type: outputMime });
  downloadBlob(blob, `${getBaseName(selectedFile.name)}-converted.${outputExtension}`);
}

/* =========================================================
   IMAGE RESET
========================================================= */
if (resetButton) resetButton.addEventListener("click", resetImageConverter);

function resetImageConverter() {
  selectedFile = null;

  if (imageObjectURL) {
    URL.revokeObjectURL(imageObjectURL);
    imageObjectURL = null;
  }

  if (previewImage) previewImage.removeAttribute("src");
  if (fileInput) fileInput.value = "";
  if (editor) {
    editor.classList.remove("active");
    editor.hidden = true;
  }
  if (dropZone) dropZone.style.display = "flex";

  if (convertButton) {
    convertButton.disabled = false;
    setButtonText(convertButton, "Convert & Download");
  }
}

/* =========================================================
   VIDEO PICKER
========================================================= */
if (videoDropZone && videoInput) {
  videoDropZone.addEventListener("click", (e) => {
    if (e.target === chooseVideoBtn || chooseVideoBtn?.contains(e.target)) return;
    videoInput.click();
  });

  videoDropZone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      videoInput.click();
    }
  });

  videoInput.addEventListener("change", () => {
    if (videoInput.files && videoInput.files.length > 0) {
      handleVideoFile(videoInput.files[0]);
    }
  });

  videoDropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    videoDropZone.classList.add("dragging");
  });
  videoDropZone.addEventListener("dragleave", () => {
    videoDropZone.classList.remove("dragging");
  });
  videoDropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    videoDropZone.classList.remove("dragging");
    const files = event.dataTransfer.files;
    if (files && files.length > 0) handleVideoFile(files[0]);
  });
}

if (chooseVideoBtn && videoInput) {
  chooseVideoBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    videoInput.click();
  });
}

/* =========================================================
   VIDEO FILE
========================================================= */
function handleVideoFile(file) {
  if (!file || !file.type.startsWith("video/")) {
    alert("Please select a valid video file.");
    return;
  }

  selectedVideoFile = file;

  if (videoObjectURL) URL.revokeObjectURL(videoObjectURL);
  videoObjectURL = URL.createObjectURL(file);

  if (videoPreview) {
    videoPreview.src = videoObjectURL;
    videoPreview.load();
  }

  if (videoFileName) videoFileName.textContent = file.name;
  if (videoFileSize) videoFileSize.textContent = formatFileSize(file.size);
  if (videoDuration) videoDuration.textContent = "Loading...";

  if (videoDropZone) videoDropZone.style.display = "none";
  if (videoEditor) {
    videoEditor.hidden = false;
    videoEditor.classList.add("active");
  }
}

/* =========================================================
   VIDEO METADATA
========================================================= */
if (videoPreview) {
  videoPreview.addEventListener("loadedmetadata", () => {
    const duration = videoPreview.duration;
    if (videoDuration && Number.isFinite(duration)) {
      videoDuration.textContent = formatDuration(duration);
    }
  });
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return "—";
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

/* =========================================================
   VIDEO QUALITY
========================================================= */
if (videoQuality && videoQualityValue) {
  videoQuality.addEventListener("input", () => {
    videoQualityValue.textContent = `${videoQuality.value}%`;
  });
  videoQualityValue.textContent = `${videoQuality.value}%`;
}

/* =========================================================
   VIDEO CONVERSION (FFmpeg)
========================================================= */
if (videoConvertButton) videoConvertButton.addEventListener("click", convertVideo);

async function convertVideo() {
  if (!selectedVideoFile) return;

  videoConvertButton.disabled = true;
  setButtonText(videoConvertButton, "Loading converter...");

  try {
    const engine = await loadFFmpeg();

    setButtonText(videoConvertButton, "Converting...");

    const inputExtension = getFileExtension(selectedVideoFile.name) || "video";
    const outputExtension = videoFormat
      ? getExtensionFromVideoValue(videoFormat.value)
      : "mp4";

    const inputName = `input.${inputExtension}`;
    const outputName = `output.${outputExtension}`;

    await engine.writeFile(inputName, await fetchFile(selectedVideoFile));

    const q = Number(videoQuality ? videoQuality.value : 80);
    const crf = Math.round(36 - q * 0.2);

    let command = ["-i", inputName];

    if (outputExtension === "mp4") {
      command.push(
        "-c:v", "libx264", "-preset", "veryfast", "-crf", String(crf),
        "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart"
      );
    } else if (outputExtension === "webm") {
      command.push(
        "-c:v", "libvpx",
        "-crf", String(Math.max(18, Math.min(40, crf))),
        "-b:v", "1M",
        "-c:a", "libvorbis", "-b:a", "128k",
        "-threads", "1"
      );
    } else if (outputExtension === "mov") {
      command.push(
        "-c:v", "libx264", "-preset", "veryfast", "-crf", String(crf),
        "-c:a", "aac", "-b:a", "192k"
      );
    } else if (outputExtension === "gif") {
      command.push("-vf", "fps=12,scale=720:-1:flags=lanczos");
    } else if (outputExtension === "avi") {
      command.push(
        "-c:v", "mpeg4", "-q:v", "5",
        "-c:a", "mp3", "-b:a", "192k"
      );
    } else if (outputExtension === "mkv") {
      command.push(
        "-c:v", "libx264", "-preset", "veryfast", "-crf", String(crf),
        "-c:a", "aac", "-b:a", "192k"
      );
    } else {
      command.push("-c", "copy");
    }

    command.push("-y", outputName);

    await engine.exec(command);

    // Free the input file from WASM memory before reading the output
    try { await engine.deleteFile(inputName); } catch (e) { /* ignore */ }

    // ---- Verify the output file exists before reading ----
    let data;
    try {
      data = await engine.readFile(outputName);
    } catch (readError) {
      console.error("[Video] readFile failed:", readError);
      throw new Error(
        "FFmpeg finished but the output file could not be read. " +
        "The conversion may have been interrupted or the format is unsupported."
      );
    }

    if (!data || data.length === 0) {
      throw new Error(
        "FFmpeg produced an empty output file. " +
        "Try a different output format or a shorter video."
      );
    }

    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    const mime = normalizeToMime(outputExtension);
    const blob = new Blob([bytes], { type: mime });

    downloadBlob(
      blob,
      `${getBaseName(selectedVideoFile.name)}-converted.${outputExtension}`
    );

    await cleanupFFmpegFiles([outputName]);

    setButtonText(videoConvertButton, "✓ Downloaded");
    setTimeout(() => {
      setButtonText(videoConvertButton, "Convert Video & Download");
      videoConvertButton.disabled = false;
    }, 1500);
  } catch (error) {
    console.error("[Video] conversion failed:", error);
    alert(
      "Video conversion failed.\n\nReason: " +
        (error && error.message ? error.message : "Unknown error")
    );
    videoConvertButton.disabled = false;
    setButtonText(videoConvertButton, "Convert Video & Download");
  }
}

/* =========================================================
   VIDEO OUTPUT EXTENSION
========================================================= */
function getExtensionFromVideoValue(value) {
  if (!value) return "mp4";
  if (value.includes("webm")) return "webm";
  if (value.includes("mov")) return "mov";
  if (value.includes("avi")) return "avi";
  if (value.includes("mkv")) return "mkv";
  if (value.includes("gif")) return "gif";
  return "mp4";
}

/* =========================================================
   VIDEO RESET
========================================================= */
if (videoResetButton) videoResetButton.addEventListener("click", resetVideoConverter);

function resetVideoConverter() {
  selectedVideoFile = null;

  if (videoObjectURL) {
    URL.revokeObjectURL(videoObjectURL);
    videoObjectURL = null;
  }

  if (videoPreview) {
    videoPreview.pause();
    videoPreview.removeAttribute("src");
    videoPreview.load();
  }

  if (videoInput) videoInput.value = "";
  if (videoFileName) videoFileName.textContent = "No video selected";
  if (videoFileSize) videoFileSize.textContent = "0 KB";
  if (videoDuration) videoDuration.textContent = "0:00";

  if (videoEditor) {
    videoEditor.classList.remove("active");
    videoEditor.hidden = true;
  }
  if (videoDropZone) videoDropZone.style.display = "flex";

  if (videoConvertButton) {
    videoConvertButton.disabled = false;
    setButtonText(videoConvertButton, "Convert Video & Download");
  }
}

/* =========================================================
   FFMPEG CLEANUP
========================================================= */
async function cleanupFFmpegFiles(files) {
  if (!ffmpeg || !ffmpegLoaded) return;
  for (const file of files) {
    try {
      await ffmpeg.deleteFile(file);
    } catch (error) {
      console.warn("Could not delete FFmpeg file:", file);
    }
  }
}

/* =========================================================
   THEME
========================================================= */
function updateThemeIcon() {
  if (!themeIcon) return;
  const current = document.documentElement.className;
  if (current === "dark") themeIcon.textContent = "☀";
  else if (current === "light") themeIcon.textContent = "☾";
  else themeIcon.textContent = "◐";
}

function applySavedTheme() {
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark" || savedTheme === "light") {
    document.documentElement.className = savedTheme;
  }
  updateThemeIcon();
}

applySavedTheme();

if (themeButton) {
  themeButton.addEventListener("click", () => {
    const current = document.documentElement.className;
    if (current === "dark") {
      document.documentElement.className = "light";
      localStorage.setItem("theme", "light");
    } else {
      document.documentElement.className = "dark";
      localStorage.setItem("theme", "dark");
    }
    updateThemeIcon();
  });
}

/* =========================================================
   CLEANUP
========================================================= */
window.addEventListener("beforeunload", () => {
  if (imageObjectURL) URL.revokeObjectURL(imageObjectURL);
  if (videoObjectURL) URL.revokeObjectURL(videoObjectURL);
  if (vips && vipsLoaded) {
    try { vips.shutdown(); } catch (e) { /* ignore */ }
  }
});