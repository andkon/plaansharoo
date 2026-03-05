(function () {
    var frame = document.getElementById("filmFrame");
    var canvas = document.getElementById("grainLayer");
    var logoStage = document.getElementById("logoStage");
    var pageContainer = document.getElementById("pageContainer");
    var nextSlideLink = document.getElementById("nextSlideLink");
    var nextSlide = document.getElementById("slide-video") || document.getElementById("slide-info");
    var slides = pageContainer ? Array.prototype.slice.call(pageContainer.querySelectorAll(".page[id]")) : [];

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
    var resizeTimeoutId = 0;
    var hashSyncRafId = 0;
    var initialHashTimer = 0;
    var introStartTimer = 0;
    var resizeObserver = null;
    var visualViewport = window.visualViewport || null;

    if (!grainCtx) {
        return;
    }

    function resizeCanvas() {
        var bounds = frame.getBoundingClientRect();
        var width = Math.max(1, Math.round(bounds.width || frame.clientWidth || frame.offsetWidth || window.innerWidth || 1));
        var height = Math.max(1, Math.round(bounds.height || frame.clientHeight || frame.offsetHeight || window.innerHeight || 1));
        dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
        noiseWidth = Math.max(1, Math.floor(width * renderScale));
        noiseHeight = Math.max(1, Math.floor(height * renderScale));

        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        canvas.style.width = width + "px";
        canvas.style.height = height + "px";

        grainCanvas.width = noiseWidth;
        grainCanvas.height = noiseHeight;

        imageData = grainCtx.createImageData(noiseWidth, noiseHeight);
        imageBuffer = imageData.data;
    }

    function refreshCanvasSizing() {
        resizeCanvas();
        window.requestAnimationFrame(resizeCanvas);

        window.clearTimeout(resizeTimeoutId);
        resizeTimeoutId = window.setTimeout(resizeCanvas, 180);
    }

    function drawNoise() {
        if (!imageBuffer || !imageData) {
            return;
        }

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
        if (!logoStage) {
            return;
        }

        if (reduceMotion) {
            logoStage.classList.add("intro-static");
            return;
        }

        window.clearTimeout(introStartTimer);
        introStartTimer = window.setTimeout(function () {
            window.requestAnimationFrame(function () {
                logoStage.classList.add("intro-play");
            });
        }, 220);
    }

    function updateHash(slide) {
        if (!slide || !slide.id) {
            return;
        }

        if (slides.length && slide === slides[0]) {
            if (!window.location.hash) {
                return;
            }

            if (window.history && typeof window.history.replaceState === "function") {
                window.history.replaceState(null, "", window.location.pathname + window.location.search);
            } else {
                window.location.hash = "";
            }

            return;
        }

        var nextHash = "#" + slide.id;

        if (window.location.hash === nextHash) {
            return;
        }

        if (window.history && typeof window.history.replaceState === "function") {
            window.history.replaceState(null, "", nextHash);
        } else {
            window.location.hash = nextHash;
        }
    }

    function focusSlide(slide) {
        if (!slide || typeof slide.focus !== "function") {
            return;
        }

        try {
            slide.focus({ preventScroll: true });
        } catch (_error) {
            slide.focus();
        }
    }

    function scrollToSlide(slide, behavior) {
        if (!slide) {
            return;
        }

        var scrollBehavior = behavior || (reduceMotion ? "auto" : "smooth");

        if (pageContainer && typeof pageContainer.scrollTo === "function") {
            pageContainer.scrollTo({
                top: slide.offsetTop,
                behavior: scrollBehavior
            });
        } else {
            slide.scrollIntoView({
                block: "start",
                behavior: scrollBehavior
            });
        }

        focusSlide(slide);
        updateHash(slide);
    }

    function getTargetFromHash() {
        if (!window.location.hash || window.location.hash.length < 2) {
            return null;
        }

        var id = window.location.hash.slice(1);
        var target = document.getElementById(id);

        if (!target) {
            return null;
        }

        for (var i = 0; i < slides.length; i += 1) {
            if (slides[i] === target) {
                return target;
            }
        }

        return null;
    }

    function syncHashToNearestSlide() {
        if (!pageContainer || !slides.length) {
            return;
        }

        var containerTop = pageContainer.getBoundingClientRect().top;
        var nearest = slides[0];
        var nearestDistance = Infinity;

        for (var i = 0; i < slides.length; i += 1) {
            var slide = slides[i];
            var slideTop = slide.getBoundingClientRect().top;
            var distance = Math.abs(slideTop - containerTop);

            if (distance < nearestDistance) {
                nearest = slide;
                nearestDistance = distance;
            }
        }

        updateHash(nearest);
    }

    function onContainerScroll() {
        if (hashSyncRafId) {
            return;
        }

        hashSyncRafId = window.requestAnimationFrame(function () {
            hashSyncRafId = 0;
            syncHashToNearestSlide();
        });
    }

    function runInitialHashNavigation() {
        if (!pageContainer || !slides.length) {
            return;
        }

        var firstSlide = slides[0];
        var target = getTargetFromHash();

        if (!firstSlide) {
            return;
        }

        pageContainer.scrollTo({
            top: firstSlide.offsetTop,
            behavior: "auto"
        });
        focusSlide(firstSlide);
        updateHash(firstSlide);

        if (!target || target === firstSlide) {
            return;
        }

        window.clearTimeout(initialHashTimer);
        initialHashTimer = window.setTimeout(function () {
            scrollToSlide(target, reduceMotion ? "auto" : "smooth");
        }, reduceMotion ? 0 : 260);
    }

    function moveToNextSlide(event) {
        if (event) {
            event.preventDefault();
        }

        if (!nextSlide) {
            return;
        }

        scrollToSlide(nextSlide, reduceMotion ? "auto" : "smooth");
    }

    refreshCanvasSizing();
    step();

    if (document.readyState === "complete") {
        playIntro();
        runInitialHashNavigation();
    } else {
        window.addEventListener("load", function () {
            playIntro();
            runInitialHashNavigation();
        }, { once: true });
    }

    if (nextSlideLink) {
        nextSlideLink.addEventListener("click", moveToNextSlide);
    }

    if (pageContainer) {
        pageContainer.addEventListener("scroll", onContainerScroll, { passive: true });
        window.requestAnimationFrame(syncHashToNearestSlide);
    }

    window.addEventListener("resize", refreshCanvasSizing);
    window.addEventListener("orientationchange", refreshCanvasSizing);
    window.addEventListener("pageshow", refreshCanvasSizing);

    if (visualViewport) {
        visualViewport.addEventListener("resize", refreshCanvasSizing);
        visualViewport.addEventListener("scroll", refreshCanvasSizing);
    }

    if (typeof window.ResizeObserver === "function") {
        resizeObserver = new window.ResizeObserver(refreshCanvasSizing);
        resizeObserver.observe(frame);
    }

    window.addEventListener("beforeunload", function () {
        window.cancelAnimationFrame(rafId);
        window.cancelAnimationFrame(hashSyncRafId);
        window.clearTimeout(resizeTimeoutId);
        window.clearTimeout(initialHashTimer);
        window.clearTimeout(introStartTimer);

        if (visualViewport) {
            visualViewport.removeEventListener("resize", refreshCanvasSizing);
            visualViewport.removeEventListener("scroll", refreshCanvasSizing);
        }

        if (resizeObserver && typeof resizeObserver.disconnect === "function") {
            resizeObserver.disconnect();
        }
    });
})();
