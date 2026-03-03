(function () {
    var frame = document.getElementById("filmFrame");
    var canvas = document.getElementById("grainLayer");
    var logoStage = document.getElementById("logoStage");
    var pageContainer = document.getElementById("pageContainer");
    var nextSlideLink = document.getElementById("nextSlideLink");
    var nextSlide = document.getElementById("slide-video") || document.getElementById("slide-info");

    if (!frame || !canvas) {
        return;
    }

    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var ctx = canvas.getContext("2d", { alpha: true });

    if (!ctx) {
        return;
    }

    var rafId = 0;
    var dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
    var renderScale = 0.3;
    var noiseWidth = 0;
    var noiseHeight = 0;
    var imageData;
    var imageBuffer;
    var grainCanvas = document.createElement("canvas");
    var grainCtx = grainCanvas.getContext("2d");

    if (!grainCtx) {
        return;
    }

    function resizeCanvas() {
        var bounds = frame.getBoundingClientRect();
        noiseWidth = Math.max(1, Math.floor(bounds.width * renderScale));
        noiseHeight = Math.max(1, Math.floor(bounds.height * renderScale));

        canvas.width = Math.floor(bounds.width * dpr);
        canvas.height = Math.floor(bounds.height * dpr);
        canvas.style.width = bounds.width + "px";
        canvas.style.height = bounds.height + "px";

        grainCanvas.width = noiseWidth;
        grainCanvas.height = noiseHeight;

        imageData = grainCtx.createImageData(noiseWidth, noiseHeight);
        imageBuffer = imageData.data;
    }

    function drawNoise() {
        for (var i = 0; i < imageBuffer.length; i += 4) {
            var grain = Math.random() * 255;
            imageBuffer[i] = grain;
            imageBuffer[i + 1] = grain;
            imageBuffer[i + 2] = grain;
            imageBuffer[i + 3] = 135;
        }

        grainCtx.putImageData(imageData, 0, 0);

        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha = 1;
        ctx.drawImage(grainCanvas, 0, 0, canvas.width / dpr, canvas.height / dpr);
        ctx.restore();
    }

    function step() {
        drawNoise();

        if (!reduceMotion) {
            var x = (Math.random() - 0.5) * 0.9;
            var y = (Math.random() - 0.5) * 0.55;
            var rotate = (Math.random() - 0.5) * 0.05;
            frame.style.transform = "translate3d(" + x.toFixed(2) + "px," + y.toFixed(2) + "px,0) rotate(" + rotate.toFixed(3) + "deg)";
        }

        rafId = window.requestAnimationFrame(step);
    }

    function playIntro() {
        if (!logoStage || reduceMotion) {
            return;
        }

        window.requestAnimationFrame(function () {
            logoStage.classList.add("intro-play");
        });
    }

    function moveToNextSlide(event) {
        if (event) {
            event.preventDefault();
        }

        if (!nextSlide) {
            return;
        }

        var behavior = reduceMotion ? "auto" : "smooth";

        if (pageContainer && typeof pageContainer.scrollTo === "function") {
            pageContainer.scrollTo({
                top: nextSlide.offsetTop,
                behavior: behavior
            });
        } else {
            nextSlide.scrollIntoView({
                block: "start",
                behavior: behavior
            });
        }

        if (typeof nextSlide.focus === "function") {
            try {
                nextSlide.focus({ preventScroll: true });
            } catch (_error) {
                nextSlide.focus();
            }
        }

        if (window.history && typeof window.history.replaceState === "function") {
            window.history.replaceState(null, "", "#" + nextSlide.id);
        }
    }

    resizeCanvas();
    step();

    if (document.readyState === "complete") {
        playIntro();
    } else {
        window.addEventListener("load", playIntro, { once: true });
    }

    if (nextSlideLink) {
        nextSlideLink.addEventListener("click", moveToNextSlide);
    }

    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("beforeunload", function () {
        window.cancelAnimationFrame(rafId);
    });
})();
