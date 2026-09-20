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

const themeButton = document.getElementById("themeButton");
const themeIcon = document.getElementById("themeIcon");

let selectedFile = null;
let imageObjectURL = null;


/* -----------------------------
   FILE SIZE
----------------------------- */

function formatFileSize(bytes) {

    if (bytes < 1024) {
        return bytes + " B";
    }

    if (bytes < 1024 * 1024) {
        return (bytes / 1024).toFixed(1) + " KB";
    }

    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}


/* -----------------------------
   OPEN FILE PICKER
----------------------------- */

dropZone.addEventListener("click", () => {
    fileInput.click();
});


dropZone.addEventListener("keydown", (event) => {

    if (event.key === "Enter" || event.key === " ") {

        event.preventDefault();

        fileInput.click();
    }
});


fileInput.addEventListener("change", () => {

    if (fileInput.files.length > 0) {

        handleFile(fileInput.files[0]);

    }

});


/* -----------------------------
   DRAG AND DROP
----------------------------- */

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

    if (files.length > 0) {

        handleFile(files[0]);

    }

});


/* -----------------------------
   HANDLE FILE
----------------------------- */

function handleFile(file) {

    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];


    if (!allowedTypes.includes(file.type)) {

        alert(
            "Please choose a JPG, PNG or WebP image."
        );

        return;
    }


    selectedFile = file;


    if (imageObjectURL) {

        URL.revokeObjectURL(imageObjectURL);

    }


    imageObjectURL = URL.createObjectURL(file);

    previewImage.src = imageObjectURL;

    fileName.textContent = file.name;

    originalSize.textContent =
        formatFileSize(file.size);


    previewImage.onload = () => {

        dimensions.textContent =
            `${previewImage.naturalWidth} × ${previewImage.naturalHeight}`;

    };


    dropZone.style.display = "none";

    editor.classList.add("active");

}


/* -----------------------------
   QUALITY SLIDER
----------------------------- */

qualitySlider.addEventListener("input", () => {

    qualityValue.textContent =
        `${qualitySlider.value}%`;

});


/* -----------------------------
   CONVERT IMAGE
----------------------------- */

convertButton.addEventListener("click", async () => {

    if (!selectedFile) {

        return;

    }


    convertButton.disabled = true;

    convertButton.innerHTML =
        "Converting...";


    try {

        const image = new Image();

        image.src = imageObjectURL;


        await new Promise((resolve, reject) => {

            image.onload = resolve;

            image.onerror = reject;

        });


        const canvas =
            document.createElement("canvas");


        canvas.width = image.naturalWidth;

        canvas.height = image.naturalHeight;


        const context =
            canvas.getContext("2d");


        /*
         * JPEG does not support transparency.
         * Give it a white background.
         */

        if (formatSelect.value === "image/jpeg") {

            context.fillStyle = "#ffffff";

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
            Number(qualitySlider.value) / 100;


        canvas.toBlob(
            (blob) => {

                if (!blob) {

                    throw new Error(
                        "Could not convert image."
                    );

                }


                const extension =
                    getExtension(formatSelect.value);


                const originalName =
                    selectedFile.name
                        .replace(/\.[^/.]+$/, "");


                const newFileName =
                    `${originalName}-converted.${extension}`;


                downloadBlob(
                    blob,
                    newFileName
                );


                convertButton.innerHTML =
                    "✓ Downloaded";

                setTimeout(() => {

                    convertButton.innerHTML =
                        `Convert Image <span>→</span>`;

                    convertButton.disabled = false;

                }, 1500);

            },

            formatSelect.value,

            quality

        );

    }

    catch (error) {

        console.error(error);

        alert(
            "Something went wrong while converting the image."
        );


        convertButton.disabled = false;

        convertButton.innerHTML =
            `Convert Image <span>→</span>`;

    }

});


/* -----------------------------
   GET EXTENSION
----------------------------- */

function getExtension(type) {

    switch (type) {

        case "image/png":
            return "png";

        case "image/webp":
            return "webp";

        default:
            return "jpg";

    }

}


/* -----------------------------
   DOWNLOAD
----------------------------- */

function downloadBlob(blob, name) {

    const url =
        URL.createObjectURL(blob);


    const link =
        document.createElement("a");


    link.href = url;

    link.download = name;


    document.body.appendChild(link);

    link.click();

    link.remove();


    setTimeout(() => {

        URL.revokeObjectURL(url);

    }, 1000);

}


/* -----------------------------
   RESET
----------------------------- */

resetButton.addEventListener("click", () => {

    selectedFile = null;


    if (imageObjectURL) {

        URL.revokeObjectURL(imageObjectURL);

        imageObjectURL = null;

    }


    previewImage.src = "";

    fileInput.value = "";


    editor.classList.remove("active");

    dropZone.style.display = "flex";

});


/* -----------------------------
   THEME
----------------------------- */

const savedTheme =
    localStorage.getItem("theme");


if (savedTheme) {

    document.documentElement.className =
        savedTheme;

}


/*
 * If there is no saved preference,
 * the CSS automatically follows the
 * browser/system theme.
 */

function updateThemeIcon() {

    const current =
        document.documentElement.className;


    if (current === "dark") {

        themeIcon.textContent = "☀";

    }

    else if (current === "light") {

        themeIcon.textContent = "☾";

    }

    else {

        themeIcon.textContent = "◐";

    }

}


updateThemeIcon();


themeButton.addEventListener("click", () => {

    const current =
        document.documentElement.className;


    if (current === "dark") {

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

});