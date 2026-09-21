const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");

const editor = document.getElementById("editor");

const previewImage = document.getElementById("previewImage");
const fileName = document.getElementById("fileName");

const formatSelect = document.getElementById("format");

const qualitySlider = document.getElementById("quality");
const qualityValue = document.getElementById("qualityValue");

const originalSize = document.getElementById("originalSize");
const dimensions = document.getElementById("dimensions");

const convertButton = document.getElementById("convertButton");
const resetButton = document.getElementById("resetButton");


const themeIcon = document.getElementById("themeIcon");

/* =========================================================
VIDEO ELEMENTS
========================================================= */

const videoDropZone =
document.getElementById("videoDropZone");

const videoInput =
document.getElementById("videoInput");

const videoEditor =
document.getElementById("videoEditor");

const videoPreview =
document.getElementById("videoPreview");

const videoFileName =
document.getElementById("videoFileName");

const videoFormat =
document.getElementById("videoFormat");

const videoQuality =
document.getElementById("videoQuality");

const videoQualityValue =
document.getElementById("videoQualityValue");

const videoOriginalSize =
document.getElementById("videoOriginalSize");

const videoDuration =
document.getElementById("videoDuration");

const videoConvertButton =
document.getElementById("videoConvertButton");

const videoResetButton =
document.getElementById("videoResetButton");

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
FFmpeg CDN CONFIG
========================================================= */

const FFMPEG_VERSION = "0.12.10";

const FFMPEG_BASE_URL =
`https://cdn.jsdelivr.net/npm/@ffmpeg/core@${FFMPEG_VERSION}/dist/umd`;

/* =========================================================
GENERAL HELPERS
========================================================= */

function formatFileSize(bytes) {


if (!Number.isFinite(bytes) || bytes < 0) {
    return "0 B";
}

if (bytes < 1024) {
    return `${bytes} B`;
}

if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
}

if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;


}

function getBaseName(name) {


return name
    .replace(/\.[^/.]+$/, "")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .trim() || "converted-file";


}

function getExtension(type) {


switch (type) {

    case "image/jpeg":
        return "jpg";

    case "image/png":
        return "png";

    case "image/webp":
        return "webp";

    case "image/gif":
        return "gif";

    case "image/bmp":
        return "bmp";

    case "image/tiff":
        return "tiff";

    case "image/avif":
        return "avif";

    case "video/mp4":
        return "mp4";

    case "video/webm":
        return "webm";

    case "video/quicktime":
        return "mov";

    case "video/x-msvideo":
        return "avi";

    case "video/x-matroska":
        return "mkv";

    default:
        return "bin";
}


}

function setButtonText(button, text) {


if (button) {
    button.textContent = text;
}


}

function downloadBlob(blob, name) {


if (!blob) {
    throw new Error("No output file was created.");
}

const url =
    URL.createObjectURL(blob);

const link =
    document.createElement("a");

link.href = url;
link.download = name;
link.style.display = "none";

document.body.appendChild(link);

link.click();

link.remove();

setTimeout(() => {

    URL.revokeObjectURL(url);

}, 2000);


}

function getMimeFromExtension(extension) {


const map = {

    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    bmp: "image/bmp",
    tiff: "image/tiff",
    tif: "image/tiff",
    avif: "image/avif",

    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
    avi: "video/x-msvideo",
    mkv: "video/x-matroska"
};

return map[extension.toLowerCase()] || "application/octet-stream";


}

function getFileExtension(fileName) {


const match =
    fileName.match(/\.([^.]+)$/);

return match
    ? match[1].toLowerCase()
    : "";


}

/* =========================================================
FFmpeg LOADER
========================================================= */

async function loadFFmpeg() {


if (ffmpegLoaded && ffmpeg) {
    return ffmpeg;
}


if (ffmpegLoading) {

    while (ffmpegLoading) {

        await new Promise(
            resolve => setTimeout(resolve, 100)
        );
    }

    if (ffmpegLoaded && ffmpeg) {
        return ffmpeg;
    }
}


ffmpegLoading = true;


try {

    if (
        typeof FFmpeg === "undefined" ||
        typeof FFmpeg.FFmpeg === "undefined"
    ) {

        throw new Error(
            "FFmpeg library was not loaded. Check the FFmpeg scripts in index.html."
        );
    }


    if (
        typeof FFmpegUtil === "undefined"
    ) {

        throw new Error(
            "FFmpeg utility library was not loaded."
        );
    }


    const {
        FFmpeg
    } = window.FFmpeg;


    const {
        toBlobURL
    } = window.FFmpegUtil;


    ffmpeg =
        new FFmpeg();


    ffmpeg.on(
        "progress",
        ({ progress }) => {

            const percentage =
                Math.min(
                    100,
                    Math.max(
                        0,
                        Math.round(progress * 100)
                    )
                );


            updateConversionProgress(
                percentage
            );
        }
    );


    ffmpeg.on(
        "log",
        ({ message }) => {

            console.log(
                "[FFmpeg]",
                message
            );
        }
    );


    updateConversionStatus(
        "Loading converter..."
    );


    await ffmpeg.load({

        coreURL:
            await toBlobURL(
                `${FFMPEG_BASE_URL}/ffmpeg-core.js`,
                "text/javascript"
            ),

        wasmURL:
            await toBlobURL(
                `${FFMPEG_BASE_URL}/ffmpeg-core.wasm`,
                "application/wasm"
            )
    });


    ffmpegLoaded = true;

    updateConversionStatus(
        "Converter ready"
    );


    return ffmpeg;

}

catch (error) {

    ffmpeg = null;
    ffmpegLoaded = false;

    console.error(
        "FFmpeg loading error:",
        error
    );

    throw error;

}

finally {

    ffmpegLoading = false;
}


}

/* =========================================================
STATUS / PROGRESS
========================================================= */

function updateConversionProgress(percent) {


const progressElements =
    document.querySelectorAll(
        "[data-conversion-progress]"
    );


progressElements.forEach(
    element => {

        element.textContent =
            `${percent}%`;
    }
);


}

function updateConversionStatus(message) {


const statusElements =
    document.querySelectorAll(
        "[data-conversion-status]"
    );


statusElements.forEach(
    element => {

        element.textContent =
            message;
    }
);


}

/* =========================================================
IMAGE PICKER
========================================================= */

if (dropZone && fileInput) {


dropZone.addEventListener(
    "click",
    () => fileInput.click()
);


dropZone.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Enter" ||
            event.key === " "
        ) {

            event.preventDefault();

            fileInput.click();
        }
    }
);


fileInput.addEventListener(
    "change",
    () => {

        if (
            fileInput.files &&
            fileInput.files.length > 0
        ) {

            handleImageFile(
                fileInput.files[0]
            );
        }
    }
);


dropZone.addEventListener(
    "dragover",
    event => {

        event.preventDefault();

        dropZone.classList.add(
            "dragging"
        );
    }
);


dropZone.addEventListener(
    "dragleave",
    () => {

        dropZone.classList.remove(
            "dragging"
        );
    }
);


dropZone.addEventListener(
    "drop",
    event => {

        event.preventDefault();

        dropZone.classList.remove(
            "dragging"
        );


        const files =
            event.dataTransfer.files;


        if (
            files &&
            files.length > 0
        ) {

            handleImageFile(
                files[0]
            );
        }
    }
);


}

/* =========================================================
IMAGE FILE
========================================================= */

function handleImageFile(file) {


if (
    !file ||
    !file.type.startsWith("image/")
) {

    alert(
        "Please select a valid image file."
    );

    return;
}


selectedFile = file;


if (imageObjectURL) {

    URL.revokeObjectURL(
        imageObjectURL
    );
}


imageObjectURL =
    URL.createObjectURL(file);


if (previewImage) {

    previewImage.src =
        imageObjectURL;
}


if (fileName) {

    fileName.textContent =
        file.name;
}


if (originalSize) {

    originalSize.textContent =
        formatFileSize(
            file.size
        );
}


if (previewImage) {

    previewImage.onload =
        () => {

            if (dimensions) {

                dimensions.textContent =
                    `${previewImage.naturalWidth} × ${previewImage.naturalHeight}`;
            }
        };
}


if (dropZone) {

    dropZone.style.display =
        "none";
}


if (editor) {

    editor.classList.add(
        "active"
    );
}


}

/* =========================================================
IMAGE QUALITY
========================================================= */

if (qualitySlider && qualityValue) {


qualitySlider.addEventListener(
    "input",
    () => {

        qualityValue.textContent =
            `${qualitySlider.value}%`;
    }
);


qualityValue.textContent =
    `${qualitySlider.value}%`;


}

/* =========================================================
IMAGE CONVERSION
========================================================= */

if (convertButton) {


convertButton.addEventListener(
    "click",
    convertImage
);


}

async function convertImage() {


if (!selectedFile) {
    return;
}


const outputMime =
    formatSelect
        ? formatSelect.value
        : "image/png";


convertButton.disabled = true;


setButtonText(
    convertButton,
    "Converting..."
);


try {

    /*
     * For normal browser image formats,
     * Canvas is faster than FFmpeg.
     * FFmpeg is used automatically when
     * the selected format needs it.
     */

    const canvasFormats = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];


    if (
        canvasFormats.includes(
            outputMime
        )
    ) {

        await convertImageWithCanvas(
            outputMime
        );

    }

    else {

        await convertImageWithFFmpeg(
            outputMime
        );
    }


    setButtonText(
        convertButton,
        "✓ Downloaded"
    );


    setTimeout(() => {

        setButtonText(
            convertButton,
            "Convert Image →"
        );

        convertButton.disabled =
            false;

    }, 1500);

}

catch (error) {

    console.error(
        "Image conversion error:",
        error
    );


    alert(
        "Image conversion failed. This format may not be supported by the loaded FFmpeg build."
    );


    convertButton.disabled =
        false;


    setButtonText(
        convertButton,
        "Convert Image →"
    );
}


}

/* =========================================================
CANVAS IMAGE CONVERSION
========================================================= */

async function convertImageWithCanvas(
outputMime
) {


if (!imageObjectURL) {

    throw new Error(
        "Image preview is not available."
    );
}


const image =
    new Image();


image.src =
    imageObjectURL;


await new Promise(
    (resolve, reject) => {

        image.onload =
            resolve;

        image.onerror =
            () => reject(
                new Error(
                    "Unable to read image."
                )
            );
    }
);


const canvas =
    document.createElement(
        "canvas"
    );


canvas.width =
    image.naturalWidth;

canvas.height =
    image.naturalHeight;


const context =
    canvas.getContext(
        "2d"
    );


if (!context) {

    throw new Error(
        "Canvas is not available."
    );
}


if (
    outputMime ===
    "image/jpeg"
) {

    context.fillStyle =
        "#ffffff";

    context.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );
}


context.drawImage(
    image,
    0,
    0
);


const quality =
    Math.min(
        1,
        Math.max(
            0.01,
            Number(
                qualitySlider
                    ? qualitySlider.value
                    : 80
            ) / 100
        )
    );


const blob =
    await new Promise(
        (resolve, reject) => {

            canvas.toBlob(
                result => {

                    if (result) {
                        resolve(result);
                    }

                    else {

                        reject(
                            new Error(
                                "Could not create image."
                            )
                        );
                    }
                },

                outputMime,

                quality
            );
        }
    );


const extension =
    getExtension(
        outputMime
    );


downloadBlob(
    blob,
    `${getBaseName(selectedFile.name)}-converted.${extension}`
);


}

/* =========================================================
FFMPEG IMAGE CONVERSION
========================================================= */

async function convertImageWithFFmpeg(
outputMime
) {


const engine =
    await loadFFmpeg();


const inputExtension =
    getFileExtension(
        selectedFile.name
    ) || "img";


const outputExtension =
    getExtension(
        outputMime
    );


const inputName =
    `input.${inputExtension}`;


const outputName =
    `output.${outputExtension}`;


await engine.writeFile(
    inputName,
    await window.FFmpegUtil.fetchFile(
        selectedFile
    )
);


await engine.exec([
    "-i",
    inputName,
    "-y",
    outputName
]);


const data =
    await engine.readFile(
        outputName
    );


const bytes =
    new Uint8Array(
        data
    );


const blob =
    new Blob(
        [bytes],
        {
            type: outputMime
        }
    );


downloadBlob(
    blob,
    `${getBaseName(selectedFile.name)}-converted.${outputExtension}`
);


await cleanupFFmpegFiles([
    inputName,
    outputName
]);


}

/* =========================================================
IMAGE RESET
========================================================= */

if (resetButton) {


resetButton.addEventListener(
    "click",
    resetImageConverter
);


}

function resetImageConverter() {


selectedFile = null;


if (imageObjectURL) {

    URL.revokeObjectURL(
        imageObjectURL
    );

    imageObjectURL = null;
}


if (previewImage) {

    previewImage.removeAttribute(
        "src"
    );
}


if (fileInput) {

    fileInput.value = "";
}


if (editor) {

    editor.classList.remove(
        "active"
    );
}


if (dropZone) {

    dropZone.style.display =
        "flex";
}


if (convertButton) {

    convertButton.disabled =
        false;

    setButtonText(
        convertButton,
        "Convert Image →"
    );
}


}

/* =========================================================
VIDEO PICKER
========================================================= */

if (
videoDropZone &&
videoInput
) {


videoDropZone.addEventListener(
    "click",
    () => videoInput.click()
);


videoDropZone.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Enter" ||
            event.key === " "
        ) {

            event.preventDefault();

            videoInput.click();
        }
    }
);


videoInput.addEventListener(
    "change",
    () => {

        if (
            videoInput.files &&
            videoInput.files.length > 0
        ) {

            handleVideoFile(
                videoInput.files[0]
            );
        }
    }
);


videoDropZone.addEventListener(
    "dragover",
    event => {

        event.preventDefault();

        videoDropZone.classList.add(
            "dragging"
        );
    }
);


videoDropZone.addEventListener(
    "dragleave",
    () => {

        videoDropZone.classList.remove(
            "dragging"
        );
    }
);


videoDropZone.addEventListener(
    "drop",
    event => {

        event.preventDefault();

        videoDropZone.classList.remove(
            "dragging"
        );


        const files =
            event.dataTransfer.files;


        if (
            files &&
            files.length > 0
        ) {

            handleVideoFile(
                files[0]
            );
        }
    }
);


}

/* =========================================================
VIDEO FILE
========================================================= */

function handleVideoFile(file) {


if (
    !file ||
    !file.type.startsWith("video/")
) {

    alert(
        "Please select a valid video file."
    );

    return;
}


selectedVideoFile =
    file;


if (videoObjectURL) {

    URL.revokeObjectURL(
        videoObjectURL
    );
}


videoObjectURL =
    URL.createObjectURL(
        file
    );


if (videoPreview) {

    videoPreview.src =
        videoObjectURL;

    videoPreview.load();
}


if (videoFileName) {

    videoFileName.textContent =
        file.name;
}


if (videoOriginalSize) {

    videoOriginalSize.textContent =
        formatFileSize(
            file.size
        );
}


if (videoDuration) {

    videoDuration.textContent =
        "Loading...";
}


if (videoDropZone) {

    videoDropZone.style.display =
        "none";
}


if (videoEditor) {

    videoEditor.classList.add(
        "active"
    );
}


}

/* =========================================================
VIDEO METADATA
========================================================= */

if (videoPreview) {


videoPreview.addEventListener(
    "loadedmetadata",
    () => {

        const duration =
            videoPreview.duration;


        if (
            videoDuration &&
            Number.isFinite(duration)
        ) {

            videoDuration.textContent =
                formatDuration(
                    duration
                );
        }
    }
);


}

function formatDuration(seconds) {


if (!Number.isFinite(seconds)) {
    return "—";
}


const total =
    Math.round(seconds);


const hours =
    Math.floor(
        total / 3600
    );


const minutes =
    Math.floor(
        (total % 3600) / 60
    );


const secs =
    total % 60;


if (hours > 0) {

    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}


return `${minutes}:${String(secs).padStart(2, "0")}`;


}

/* =========================================================
VIDEO QUALITY
========================================================= */

if (
videoQuality &&
videoQualityValue
) {


videoQuality.addEventListener(
    "input",
    () => {

        videoQualityValue.textContent =
            `${videoQuality.value}%`;
    }
);


videoQualityValue.textContent =
    `${videoQuality.value}%`;


}

/* =========================================================
VIDEO CONVERSION WITH FFMPEG
========================================================= */

if (videoConvertButton) {


videoConvertButton.addEventListener(
    "click",
    convertVideo
);


}

async function convertVideo() {


if (!selectedVideoFile) {
    return;
}


videoConvertButton.disabled =
    true;


setButtonText(
    videoConvertButton,
    "Loading converter..."
);


try {

    const engine =
        await loadFFmpeg();


    setButtonText(
        videoConvertButton,
        "Converting..."
    );


    const inputExtension =
        getFileExtension(
            selectedVideoFile.name
        ) || "video";


    let outputExtension =
        "webm";


    if (
        videoFormat &&
        videoFormat.value
    ) {

        outputExtension =
            getExtensionFromVideoValue(
                videoFormat.value
            );
    }


    const inputName =
        `input.${inputExtension}`;


    const outputName =
        `output.${outputExtension}`;


    await engine.writeFile(
        inputName,
        await window.FFmpegUtil.fetchFile(
            selectedVideoFile
        )
    );


    const quality =
        Number(
            videoQuality
                ? videoQuality.value
                : 80
        );


    const crf =
        Math.round(
            36 -
            (quality * 0.20)
        );


    let command = [
        "-i",
        inputName
    ];


    /*
     * MP4
     */

    if (
        outputExtension === "mp4"
    ) {

        command.push(
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            String(crf),

            "-c:a",
            "aac",
            "-b:a",
            "192k",

            "-movflags",
            "+faststart"
        );
    }


    /*
     * WebM
     */

    else if (
        outputExtension === "webm"
    ) {

        command.push(
            "-c:v",
            "libvpx-vp9",
            "-crf",
            String(
                Math.max(
                    18,
                    Math.min(
                        40,
                        crf
                    )
                )
            ),
            "-b:v",
            "0",

            "-c:a",
            "libopus",
            "-b:a",
            "128k"
        );
    }


    /*
     * MOV
     */

    else if (
        outputExtension === "mov"
    ) {

        command.push(
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            String(crf),

            "-c:a",
            "aac",
            "-b:a",
            "192k"
        );
    }


    /*
     * GIF
     */

    else if (
        outputExtension === "gif"
    ) {

        command.push(
            "-vf",
            "fps=12,scale=720:-1:flags=lanczos"
        );
    }


    /*
     * AVI
     */

    else if (
        outputExtension === "avi"
    ) {

        command.push(
            "-c:v",
            "mpeg4",
            "-q:v",
            "5",

            "-c:a",
            "mp3",
            "-b:a",
            "192k"
        );
    }


    /*
     * MKV
     */

    else if (
        outputExtension === "mkv"
    ) {

        command.push(
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            String(crf),

            "-c:a",
            "aac",
            "-b:a",
            "192k"
        );
    }


    else {

        command.push(
            "-c",
            "copy"
        );
    }


    command.push(
        "-y",
        outputName
    );


    await engine.exec(
        command
    );


    const data =
        await engine.readFile(
            outputName
        );


    const bytes =
        new Uint8Array(
            data
        );


    const mime =
        getMimeFromExtension(
            outputExtension
        );


    const blob =
        new Blob(
            [bytes],
            {
                type: mime
            }
        );


    downloadBlob(
        blob,
        `${getBaseName(selectedVideoFile.name)}-converted.${outputExtension}`
    );


    await cleanupFFmpegFiles([
        inputName,
        outputName
    ]);


    setButtonText(
        videoConvertButton,
        "✓ Downloaded"
    );


    setTimeout(() => {

        setButtonText(
            videoConvertButton,
            "Convert Video →"
        );

        videoConvertButton.disabled =
            false;

    }, 1500);

}

catch (error) {

    console.error(
        "Video conversion error:",
        error
    );


    alert(
        "Video conversion failed. The selected format or codec may not be available in this FFmpeg build."
    );


    videoConvertButton.disabled =
        false;


    setButtonText(
        videoConvertButton,
        "Convert Video →"
    );
}


}

/* =========================================================
VIDEO OUTPUT EXTENSION
========================================================= */

function getExtensionFromVideoValue(value) {


if (!value) {
    return "mp4";
}


if (
    value.includes("webm")
) {

    return "webm";
}


if (
    value.includes("mov")
) {

    return "mov";
}


if (
    value.includes("avi")
) {

    return "avi";
}


if (
    value.includes("mkv")
) {

    return "mkv";
}


if (
    value.includes("gif")
) {

    return "gif";
}


return "mp4";


}

/* =========================================================
VIDEO RESET
========================================================= */

if (videoResetButton) {


videoResetButton.addEventListener(
    "click",
    resetVideoConverter
);


}

function resetVideoConverter() {


selectedVideoFile =
    null;


if (videoObjectURL) {

    URL.revokeObjectURL(
        videoObjectURL
    );

    videoObjectURL =
        null;
}


if (videoPreview) {

    videoPreview.pause();

    videoPreview.removeAttribute(
        "src"
    );

    videoPreview.load();
}


if (videoInput) {

    videoInput.value =
        "";
}


if (videoFileName) {

    videoFileName.textContent =
        "No video selected";
}


if (videoOriginalSize) {

    videoOriginalSize.textContent =
        "—";
}


if (videoDuration) {

    videoDuration.textContent =
        "—";
}


if (videoEditor) {

    videoEditor.classList.remove(
        "active"
    );
}


if (videoDropZone) {

    videoDropZone.style.display =
        "flex";
}


if (videoConvertButton) {

    videoConvertButton.disabled =
        false;

    setButtonText(
        videoConvertButton,
        "Convert Video →"
    );
}


}

/* =========================================================
FFMPEG CLEANUP
========================================================= */

async function cleanupFFmpegFiles(files) {


if (
    !ffmpeg ||
    !ffmpegLoaded
) {

    return;
}


for (
    const file of files
) {

    try {

        await ffmpeg.deleteFile(
            file
        );

    }

    catch (error) {

        console.warn(
            "Could not delete FFmpeg file:",
            file
        );
    }
}


}

/* =========================================================
THEME
========================================================= */

function updateThemeIcon() {


if (!themeIcon) {
    return;
}


const current =
    document.documentElement.className;


if (
    current === "dark"
) {

    themeIcon.textContent =
        "☀";
}

else if (
    current === "light"
) {

    themeIcon.textContent =
        "☾";
}

else {

    themeIcon.textContent =
        "◐";
}


}

function applySavedTheme() {


const savedTheme =
    localStorage.getItem(
        "theme"
    );


if (
    savedTheme === "dark" ||
    savedTheme === "light"
) {

    document.documentElement.className =
        savedTheme;
}


updateThemeIcon();


}

applySavedTheme();

if (themeButton) {


themeButton.addEventListener(
    "click",
    () => {

        const current =
            document.documentElement.className;


        if (
            current === "dark"
        ) {

            document.documentElement.className =
                "light";


            localStorage.setItem(
                "theme",
                "light"
            );
        }

        else {

            document.documentElement.className =
                "dark";


            localStorage.setItem(
                "theme",
                "dark"
            );
        }


        updateThemeIcon();
    }
);


}

/* =========================================================
CLEANUP WHEN PAGE CLOSES
========================================================= */

window.addEventListener(
"beforeunload",
() => {


    if (imageObjectURL) {

        URL.revokeObjectURL(
            imageObjectURL
        );
    }


    if (videoObjectURL) {

        URL.revokeObjectURL(
            videoObjectURL
        );
    }
}


);
