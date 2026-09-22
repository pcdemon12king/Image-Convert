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

let ffmpeg = null;
let ffmpegLoaded = false;
let ffmpegLoading = false;

/* =========================================================
   FFmpeg CONFIG
   ---------------------------------------------------------
   Wrapper + util are loaded from LOCAL ./ffmpeg/ files
   (required — Workers can't be created cross-origin).

   Core (@ffmpeg/core) is fetched as a Blob via toBlobURL(),
   so it CAN come from a CDN.
========================================================= */
const FFMPEG_CORE_VERSION = "0.12.6";
const FFMPEG_CORE_BASE =
  `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/umd`;

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
   PREFLIGHT — check wrapper + util are loaded
========================================================= */
function checkFFmpegLibs() {
  const missing = [];
  if (typeof window.FFmpeg === "undefined") missing.push("@ffmpeg/ffmpeg");
  if (typeof window.FFmpegUtil === "undefined") missing.push("@ffmpeg/util");
  return missing;
}

/* =========================================================
   FFmpeg LOADER
========================================================= */
async function loadFFmpeg() {
  if (ffmpegLoaded && ffmpeg) return ffmpeg;

  if (ffmpegLoading) {
    while (ffmpegLoading) await new Promise((r) => setTimeout(r, 100));
    if (ffmpegLoaded && ffmpeg) return ffmpeg;
  }

  ffmpegLoading = true;

  try {
    const missing = checkFFmpegLibs();
    if (missing.length > 0) {
      throw new Error(
        `FFmpeg libraries missing: ${missing.join(", ")}. ` +
        `Make sure the ./ffmpeg/ folder contains ffmpeg.js and util.js ` +
        `and that index.html loads them with <script> tags.`
      );
    }

    const { FFmpeg: FFmpegClass } = window.FFmpeg;
    const { toBlobURL } = window.FFmpegUtil;

    ffmpeg = new FFmpegClass();

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
    await ffmpeg.load({ coreURL, wasmURL });

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
   IMAGE CONVERSION
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
    const canvasMimes = ["image/jpeg", "image/png", "image/webp"];

    if (canvasMimes.includes(outputMime)) {
      try {
        await convertImageWithCanvas(outputMime);
        finishImageConversion(true);
        return;
      } catch (canvasError) {
        console.warn("[Canvas] failed, falling back to FFmpeg:", canvasError);
      }
    }

    await convertImageWithFFmpeg(outputMime);
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
   CANVAS CONVERSION
========================================================= */
async function convertImageWithCanvas(outputMime) {
  if (!selectedFile) throw new Error("No selected file.");

  const quality = Math.min(
    1,
    Math.max(0.01, Number(qualitySlider ? qualitySlider.value : 80) / 100)
  );

  let width, height, drawable;

  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(selectedFile);
      width = bitmap.width;
      height = bitmap.height;
      drawable = bitmap;
    } catch (e) {
      console.warn("[Canvas] createImageBitmap failed:", e);
    }
  }

  if (!drawable) {
    const img = new Image();
    img.src = imageObjectURL;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () =>
        reject(new Error("Browser cannot decode this image format."));
    });
    width = img.naturalWidth;
    height = img.naturalHeight;
    drawable = img;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable.");

  if (outputMime === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }

  ctx.drawImage(drawable, 0, 0, width, height);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result && result.size > 0) resolve(result);
        else reject(
          new Error(
            `Canvas could not encode ${outputMime}. Your browser may not support this output format.`
          )
        );
      },
      outputMime,
      quality
    );
  });

  const extension = getExtension(outputMime);
  downloadBlob(blob, `${getBaseName(selectedFile.name)}-converted.${extension}`);
}

/* =========================================================
   FFMPEG IMAGE CONVERSION
========================================================= */
async function convertImageWithFFmpeg(outputMime) {
  const engine = await loadFFmpeg();

  const inputExtension = getFileExtension(selectedFile.name) || "img";
  const outputExtension = getExtension(outputMime);

  const inputName = `input.${inputExtension}`;
  const outputName = `output.${outputExtension}`;

  const inputData = await window.FFmpegUtil.fetchFile(selectedFile);
  await engine.writeFile(inputName, inputData);

  const args = ["-i", inputName];
  const q = Number(qualitySlider ? qualitySlider.value : 85);

  if (outputExtension === "jpg" || outputExtension === "jpeg") {
    args.push("-q:v", String(Math.max(2, Math.round(31 - q * 0.29))));
  } else if (outputExtension === "webp") {
    args.push("-q:v", String(Math.max(1, Math.round(100 - q))));
  } else if (outputExtension === "avif") {
    args.push(
      "-c:v", "libaom-av1",
      "-crf", String(Math.max(0, Math.round(63 - q * 0.63)))
    );
  }

  if (outputExtension === "ico") {
    args.push("-vf", "scale=256:256:force_original_aspect_ratio=decrease");
  }

  args.push("-y", outputName);

  let execError = null;
  try {
    await engine.exec(args);
  } catch (e) {
    execError = e;
  }

  let data = null;
  try {
    data = await engine.readFile(outputName);
  } catch (readError) {
    await cleanupFFmpegFiles([inputName]).catch(() => {});

    const codecHint =
      outputExtension === "tiff"
        ? "TIFF encoding requires libtiff, which is not in the default @ffmpeg/core build."
        : outputExtension === "avif"
        ? "AVIF encoding requires libaom-av1, which is not in the default @ffmpeg/core build."
        : outputExtension === "ico"
        ? "ICO encoding requires the ICO muxer, which is not in the default @ffmpeg/core build."
        : outputExtension === "bmp"
        ? "BMP encoding requires libbmpenc, which is not in the default @ffmpeg/core build."
        : outputExtension === "gif"
        ? "GIF encoding requires libgif/gif muxer, which may not be in the default @ffmpeg/core build."
        : "";

    throw new Error(
      `FFmpeg could not produce a ${outputExtension.toUpperCase()} file. ` +
      (codecHint || (execError ? execError.message : "Unknown FFmpeg error."))
    );
  }

  if (!data || data.length === 0) {
    await cleanupFFmpegFiles([inputName, outputName]).catch(() => {});
    throw new Error("FFmpeg produced an empty file.");
  }

  const blob = new Blob([new Uint8Array(data)], { type: outputMime });
  downloadBlob(blob, `${getBaseName(selectedFile.name)}-converted.${outputExtension}`);

  await cleanupFFmpegFiles([inputName, outputName]);
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
   VIDEO CONVERSION
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

    await engine.writeFile(
      inputName,
      await window.FFmpegUtil.fetchFile(selectedVideoFile)
    );

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
        "-c:v", "libvpx-vp9",
        "-crf", String(Math.max(18, Math.min(40, crf))),
        "-b:v", "0",
        "-c:a", "libopus", "-b:a", "128k"
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

    const data = await engine.readFile(outputName);
    const bytes = new Uint8Array(data);
    const mime = normalizeToMime(outputExtension);
    const blob = new Blob([bytes], { type: mime });

    downloadBlob(
      blob,
      `${getBaseName(selectedVideoFile.name)}-converted.${outputExtension}`
    );

    await cleanupFFmpegFiles([inputName, outputName]);

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
});