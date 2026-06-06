(() => {
    const buildUrl = "Build";
    const buildName = "CrashMarketSurvivorWeb";

    const canvas = document.getElementById("unity-canvas");
    const container = document.getElementById("unity-container");
    const focusButton = document.getElementById("focus-game");
    const loading = document.getElementById("unity-loading");
    const loadingText = document.getElementById("unity-loading-text");
    const progressBar = document.getElementById("unity-progress-bar");
    const warning = document.getElementById("unity-warning");

    const blockedKeys = new Set([
        "w",
        "a",
        "s",
        "d",
        "W",
        "A",
        "S",
        "D",
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        " ",
        "Spacebar",
        "Shift"
    ]);

    const config = {
        dataUrl: `${buildUrl}/${buildName}.data`,
        frameworkUrl: `${buildUrl}/${buildName}.framework.js`,
        codeUrl: `${buildUrl}/${buildName}.wasm`,
        streamingAssetsUrl: "StreamingAssets",
        companyName: "Cristian Financial Group",
        productName: "Crash Market Survivor",
        productVersion: "1.0",
        showBanner: (message, type) => showWarning(message, type === "error")
    };

    const focusGame = () => {
        container.focus({ preventScroll: true });
        canvas.focus({ preventScroll: true });
    };

    const showWarning = (message, isError = false) => {
        warning.textContent = message;
        warning.classList.add("is-visible");
        warning.classList.toggle("is-error", Boolean(isError));
    };

    const setProgress = (progress) => {
        const percent = Math.round(progress * 100);
        progressBar.style.width = `${percent}%`;
        loadingText.textContent = `Carregando Unity WebGL... ${percent}%`;
    };

    const showBuildError = (message) => {
        loadingText.textContent = "Build Unity incompleto";
        progressBar.style.width = "0";
        showWarning(message, true);
    };

    window.addEventListener("keydown", (event) => {
        if (event.ctrlKey || event.altKey || event.metaKey) {
            return;
        }

        const activeElement = document.activeElement;
        const isEditable = activeElement && (
            activeElement.tagName === "INPUT" ||
            activeElement.tagName === "TEXTAREA" ||
            activeElement.isContentEditable
        );

        if (isEditable) {
            return;
        }

        if (blockedKeys.has(event.key) || event.code === "Space") {
            event.preventDefault();
            focusGame();
        }
    }, { capture: true });

    container.addEventListener("pointerdown", focusGame);
    canvas.addEventListener("pointerdown", focusGame);
    focusButton.addEventListener("click", focusGame);

    const loaderScript = document.createElement("script");
    loaderScript.src = `${buildUrl}/${buildName}.loader.js`;

    loaderScript.onload = () => {
        if (typeof createUnityInstance !== "function") {
            showBuildError("O loader do Unity carregou, mas createUnityInstance nao foi encontrado.");
            return;
        }

        createUnityInstance(canvas, config, setProgress)
            .then(() => {
                loading.classList.add("is-hidden");
                focusGame();
            })
            .catch((error) => {
                const message = error && error.message ? error.message : String(error);
                showBuildError(`Falha ao iniciar o Unity WebGL: ${message}`);
            });
    };

    loaderScript.onerror = () => {
        showBuildError(
            `Nao encontrei Build/${buildName}.loader.js. Copie o build WebGL completo do Unity para stock-markets-site/unity-game/ antes do deploy.`
        );
    };

    document.body.appendChild(loaderScript);
})();
