(() => {
    "use strict";

    const stageElement = document.getElementById("game-stage");
    const loader = document.getElementById("game-loader");
    const startOverlay = document.getElementById("start-overlay");
    const resultOverlay = document.getElementById("result-overlay");
    const startButton = document.getElementById("start-game");
    const restartButton = document.getElementById("restart-game");
    const timeValue = document.getElementById("time-value");
    const scoreValue = document.getElementById("score-value");
    const heightValue = document.getElementById("height-value");
    const recordValue = document.getElementById("record-value");
    const recordFill = document.getElementById("record-fill");
    const mentorMessage = document.getElementById("mentor-message");
    const phaseValue = document.getElementById("phase-value");
    const resultReason = document.getElementById("result-reason");
    const finalScore = document.getElementById("final-score");
    const resultMessage = document.getElementById("result-message");

    const COLS = 8;
    const ROWS = 6;
    const TIME_LIMIT = 90;
    const PLAYER_RADIUS = 0.28;
    const PLAYER_FOOT_OFFSET = 9;
    const BASE_WEALTH = 100000;
    const HEIGHT_WEALTH_RATE = 1850;
    const STORAGE_KEY = "cms-floor-bear-market-record";

    const moneyFormatter = new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0
    });

    if (!window.PIXI) {
        loader.textContent = "PixiJS não carregou. Verifique a conexão e recarregue a página.";
        return;
    }

    const app = new PIXI.Application({
        resizeTo: stageElement,
        backgroundColor: 0x071323,
        backgroundAlpha: 1,
        antialias: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true
    });

    stageElement.appendChild(app.view);
    loader.classList.add("is-hidden");

    const layers = {
        background: new PIXI.Container(),
        tiles: new PIXI.Container(),
        markers: new PIXI.Container(),
        players: new PIXI.Container(),
        effects: new PIXI.Container()
    };

    app.stage.addChild(layers.background, layers.tiles, layers.markers, layers.players, layers.effects);

    const arenaFrame = new PIXI.Graphics();
    const scanlines = new PIXI.Graphics();
    layers.background.addChild(scanlines, arenaFrame);

    const candles = [];
    const players = [];
    const input = {
        up: false,
        down: false,
        left: false,
        right: false,
        jumpQueued: false,
        dashQueued: false
    };

    const state = {
        started: false,
        gameOver: false,
        elapsed: 0,
        timeLeft: TIME_LIMIT,
        nextWaveIn: 1.5,
        tipTimer: 2,
        phase: "Abertura",
        bestHeight: 0,
        currentWealth: BASE_WEALTH,
        maxWealth: BASE_WEALTH,
        scoreTrend: "neutral",
        bestWealth: readRecord()
    };

    let layout = {
        width: 0,
        height: 0,
        baseX: 0,
        baseY: 0,
        colStep: 0,
        rowStep: 0,
        tileW: 0,
        tileH: 0,
        heightScale: 0,
        totalW: 0,
        totalH: 0
    };

    const phases = [
        "Rali de abertura",
        "Leilão volátil",
        "Fluxo estrangeiro",
        "Correção técnica",
        "Repique de oportunidade",
        "Stop em cadeia"
    ];

    const mentorTips = [
        "A IA viu euforia: alta boa ainda precisa de plano de saída.",
        "Vela vermelha prende capital. Em mercado real, liquidez e risco andam juntos.",
        "Subir rápido sem diversificar aumenta o tombo quando a volatilidade muda.",
        "Empurrar a IA vale ponto aqui. Na vida real, disciplina vale mais que impulso.",
        "Quando tudo fica verde, cuidado com excesso de confiança.",
        "O melhor trader da rodada é quem sobrevive ao fechamento."
    ];

    const tilePalettes = {
        bull: {
            top: 0x25d970,
            side: 0x0a7f47,
            outline: 0x9affc1,
            wick: 0xc5ffdb,
            glow: 0x21f08a
        },
        bear: {
            top: 0xff354b,
            side: 0x921528,
            outline: 0xffa0a8,
            wick: 0xffc5c9,
            glow: 0xff405c
        },
        neutral: {
            top: 0xd7e4f3,
            side: 0x536985,
            outline: 0xffffff,
            wick: 0xaec1d8,
            glow: 0x7eb5ff
        }
    };

    function readRecord() {
        const value = Number(window.localStorage.getItem(STORAGE_KEY));
        return Number.isFinite(value) && value > 0 ? value : 100000;
    }

    function saveRecord(value) {
        if (value > state.bestWealth) {
            state.bestWealth = value;
            window.localStorage.setItem(STORAGE_KEY, String(value));
        }
    }

    function randomRange(min, max) {
        return min + Math.random() * (max - min);
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function lerp(current, target, amount) {
        return current + (target - current) * clamp(amount, 0, 1);
    }

    function formatTime(seconds) {
        const safeSeconds = Math.max(0, Math.ceil(seconds));
        const minutes = Math.floor(safeSeconds / 60);
        const rest = safeSeconds % 60;
        return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
    }

    function wealthFromHeight(height) {
        return Math.round(BASE_WEALTH + Math.max(0, height) * HEIGHT_WEALTH_RATE);
    }

    function createCandle(row, col) {
        const graphics = new PIXI.Graphics();
        layers.tiles.addChild(graphics);

        return {
            row,
            col,
            graphics,
            trend: "neutral",
            height: randomRange(28, 62),
            target: randomRange(30, 64),
            bobPhase: randomRange(0, Math.PI * 2),
            bobSpeed: randomRange(0.65, 1.25),
            bobSize: randomRange(2.5, 8),
            rate: randomRange(1.6, 2.5),
            size: randomRange(0.86, 1),
            shockAge: 0
        };
    }

    function buildCandles() {
        layers.tiles.removeChildren().forEach((child) => child.destroy());
        candles.length = 0;

        for (let row = 0; row < ROWS; row += 1) {
            for (let col = 0; col < COLS; col += 1) {
                candles.push(createCandle(row, col));
            }
        }
    }

    function makePlayer(name, color, x, y, isHuman = false, isMentor = false, kind = "risk") {
        const container = new PIXI.Container();
        const shadow = new PIXI.Graphics();
        const body = new PIXI.Graphics();
        const pointer = new PIXI.Graphics();
        const label = new PIXI.Text(name, {
            fontFamily: "Segoe UI, Arial",
            fontSize: 12,
            fill: 0xffffff,
            stroke: 0x071323,
            strokeThickness: 4
        });
        const bubble = new PIXI.Text("", {
            fontFamily: "Segoe UI, Arial",
            fontSize: 11,
            fill: 0xffffff,
            align: "center",
            wordWrap: true,
            wordWrapWidth: 138,
            stroke: 0x071323,
            strokeThickness: 4
        });

        label.anchor.set(0.5, 0);
        label.y = 36;
        bubble.anchor.set(0.5, 1);
        bubble.visible = false;

        shadow.beginFill(0x000000, 0.34);
        shadow.drawEllipse(0, 23, 23, 9);
        shadow.endFill();

        drawPlayerMarker(pointer, color, kind, isHuman, isMentor);
        drawTraderAvatar(body, color, kind, isHuman, isMentor);

        container.addChild(shadow, body, pointer, label, bubble);
        layers.players.addChild(container);

        return {
            name,
            color,
            x,
            y,
            vx: 0,
            vy: 0,
            altitude: 40,
            verticalVelocity: 0,
            grounded: true,
            isHuman,
            isMentor,
            kind,
            target: { x, y },
            thinkTimer: randomRange(0.2, 1.1),
            jumpCooldown: 0,
            dashCooldown: 0,
            dashBoost: 0,
            bubbleTimer: 0,
            container,
            bubble,
            maxHeight: 0
        };
    }

    function drawPlayerMarker(graphics, color, kind, isHuman, isMentor) {
        graphics.clear();

        graphics.lineStyle(2, 0xffffff, 0.88);
        graphics.beginFill(0x071323, 0.96);
        graphics.drawCircle(0, -42, 15);
        graphics.endFill();

        graphics.lineStyle(2, color, 0.95);
        graphics.beginFill(color, 0.24);
        graphics.drawCircle(0, -42, 11);
        graphics.endFill();

        graphics.lineStyle(0);

        if (isHuman) {
            graphics.beginFill(0x38d99a, 1);
            graphics.drawRoundedRect(-3, -48, 6, 15, 2);
            graphics.drawPolygon([-9, -41, 9, -41, 0, -53]);
            graphics.endFill();
            return;
        }

        if (isMentor || kind === "hedge") {
            graphics.beginFill(0xff4d5e, 1);
            graphics.drawRoundedRect(-3, -51, 6, 15, 2);
            graphics.drawPolygon([-9, -43, 9, -43, 0, -32]);
            graphics.endFill();
            return;
        }

        if (kind === "value") {
            graphics.beginFill(0xf5bf44, 1);
            graphics.drawCircle(0, -42, 7);
            graphics.endFill();
            graphics.lineStyle(2, 0x071323, 0.7);
            graphics.moveTo(-4, -40);
            graphics.lineTo(-1, -45);
            graphics.lineTo(2, -39);
            graphics.lineTo(6, -46);
            return;
        }

        graphics.beginFill(0x38d99a, 1);
        graphics.drawPolygon([0, -53, 9, -49, 8, -38, 0, -31, -8, -38, -9, -49]);
        graphics.endFill();
        graphics.lineStyle(2, 0x071323, 0.7);
        graphics.moveTo(-4, -42);
        graphics.lineTo(-1, -38);
        graphics.lineTo(5, -47);
    }

    function drawTraderAvatar(graphics, color, kind, isHuman, isMentor) {
        const jacket = isHuman ? 0x174f86 : kind === "value" ? 0x7d5a13 : kind === "risk" ? 0x116148 : 0x6b1d2a;
        const hair = isHuman ? 0x152238 : kind === "value" ? 0x8b4a1f : kind === "risk" ? 0x1e342d : 0x5b201a;
        const accent = isHuman ? 0x62d7ff : isMentor ? 0xff4d5e : color;

        graphics.clear();
        graphics.lineStyle(3, accent, 0.9);
        graphics.beginFill(0x0b1728, 0.95);
        graphics.drawRoundedRect(-23, -26, 46, 58, 11);
        graphics.endFill();

        graphics.lineStyle(2, 0xffffff, 0.18);
        graphics.moveTo(-16, 24);
        graphics.lineTo(16, 24);

        graphics.lineStyle(0);
        graphics.beginFill(0x0a1020, 1);
        graphics.drawRoundedRect(-15, 18, 10, 17, 4);
        graphics.drawRoundedRect(5, 18, 10, 17, 4);
        graphics.endFill();

        graphics.beginFill(jacket, 1);
        graphics.drawPolygon([-18, 4, -9, -3, -2, 30, -20, 30]);
        graphics.drawPolygon([18, 4, 9, -3, 2, 30, 20, 30]);
        graphics.endFill();

        graphics.beginFill(0xeaf5ff, 1);
        graphics.drawPolygon([-8, -2, 8, -2, 5, 28, -5, 28]);
        graphics.endFill();

        graphics.beginFill(accent, 1);
        graphics.drawPolygon([-3, 2, 3, 2, 5, 19, 0, 25, -5, 19]);
        graphics.endFill();

        graphics.beginFill(jacket, 1);
        graphics.drawRoundedRect(-25, 3, 10, 22, 5);
        graphics.drawRoundedRect(15, 3, 10, 22, 5);
        graphics.endFill();

        graphics.beginFill(0xffbd8c, 1);
        graphics.drawRoundedRect(-5, -7, 10, 10, 4);
        graphics.drawCircle(0, -14, 13);
        graphics.endFill();

        graphics.beginFill(hair, 1);
        graphics.drawPolygon([-13, -18, -8, -29, -1, -22, 5, -30, 13, -18, 10, -9, -8, -9]);
        graphics.endFill();

        graphics.beginFill(0x071323, 0.92);
        graphics.drawCircle(-5, -14, 2);
        graphics.drawCircle(5, -14, 2);
        graphics.endFill();

        graphics.lineStyle(2, 0x071323, 0.62);
        graphics.moveTo(-5, -6);
        graphics.lineTo(0, -4);
        graphics.lineTo(5, -6);

        graphics.lineStyle(2, accent, 0.9);
        graphics.moveTo(-8, 13);
        graphics.lineTo(-4, 9);
        graphics.lineTo(1, 13);
        graphics.lineTo(8, 6);
    }

    function buildPlayers() {
        layers.players.removeChildren().forEach((child) => child.destroy({ children: true }));
        players.length = 0;

        players.push(makePlayer("Você", 0x2db5ff, 1.5, 4.5, true, false, "player"));
        players.push(makePlayer("IA Hedge", 0xff4d5e, 6.5, 1.5, false, true, "hedge"));
        players.push(makePlayer("IA Value", 0xf5bf44, 5.5, 4.5, false, false, "value"));
        players.push(makePlayer("IA Risk", 0x38d99a, 2.5, 1.5, false, false, "risk"));
    }

    function calculateLayout() {
        const width = app.renderer.width;
        const height = app.renderer.height;
        const colStep = Math.max(38, Math.min(112, (width - 34) / COLS));
        const rowStep = Math.max(42, Math.min(82, (height - 120) / ROWS));
        const tileW = colStep * 0.78;
        const tileH = rowStep * 0.62;
        const totalW = (COLS - 1) * colStep + tileW;
        const totalH = (ROWS - 1) * rowStep + tileH;
        const heightScale = Math.max(0.42, Math.min(0.74, height / 900));

        layout = {
            width,
            height,
            colStep,
            rowStep,
            tileW,
            tileH,
            heightScale,
            totalW,
            totalH,
            baseX: (width - totalW) / 2,
            baseY: 70 + Math.max(0, (height - 120 - totalH) / 2)
        };
    }

    function drawArenaFrame() {
        const x = layout.baseX - 22;
        const y = layout.baseY - 78;
        const width = layout.totalW + 44;
        const height = layout.totalH + 126;

        scanlines.clear();
        scanlines.lineStyle(1, 0x62d7ff, 0.07);
        for (let gx = 0; gx < layout.width; gx += 34) {
            scanlines.moveTo(gx, 0);
            scanlines.lineTo(gx, layout.height);
        }
        for (let gy = 0; gy < layout.height; gy += 34) {
            scanlines.moveTo(0, gy);
            scanlines.lineTo(layout.width, gy);
        }

        arenaFrame.clear();
        arenaFrame.beginFill(0x09182b, 0.58);
        arenaFrame.lineStyle(2, 0x62d7ff, 0.34);
        arenaFrame.drawRoundedRect(x, y, width, height, 8);
        arenaFrame.endFill();

        arenaFrame.lineStyle(1, 0xffffff, 0.08);
        for (let col = 1; col < COLS; col += 1) {
            const gridX = layout.baseX + col * layout.colStep - layout.colStep * 0.1;
            arenaFrame.moveTo(gridX, y + 12);
            arenaFrame.lineTo(gridX, y + height - 12);
        }
        for (let row = 1; row < ROWS; row += 1) {
            const gridY = layout.baseY + row * layout.rowStep - layout.rowStep * 0.12;
            arenaFrame.moveTo(x + 12, gridY);
            arenaFrame.lineTo(x + width - 12, gridY);
        }
    }

    function tileBasePosition(col, row) {
        return {
            x: layout.baseX + col * layout.colStep,
            y: layout.baseY + row * layout.rowStep
        };
    }

    function playerScreenPosition(player) {
        return {
            x: layout.baseX + (player.x - 0.5) * layout.colStep + layout.tileW / 2,
            y: layout.baseY + (player.y - 0.5) * layout.rowStep + layout.tileH / 2 - player.altitude * layout.heightScale
        };
    }

    function drawCandle(candle) {
        const graphics = candle.graphics;
        const palette = tilePalettes[candle.trend];
        const base = tileBasePosition(candle.col, candle.row);
        const width = layout.tileW * candle.size;
        const height = layout.tileH * candle.size;
        const x = base.x + (layout.tileW - width) / 2;
        const topY = base.y - candle.height * layout.heightScale;
        const bottomY = base.y + layout.tileH + 18;
        const frontY = topY + height;
        const glowAlpha = candle.trend === "neutral" ? 0.08 : 0.2 + Math.sin(state.elapsed * 6 + candle.bobPhase) * 0.05;

        graphics.clear();

        graphics.beginFill(0x000000, 0.28);
        graphics.drawEllipse(x + width / 2, bottomY + 7, width * 0.56, 8);
        graphics.endFill();

        if (candle.trend !== "neutral") {
            graphics.beginFill(palette.glow, glowAlpha);
            graphics.drawRoundedRect(x - 7, topY - 7, width + 14, height + 14, 8);
            graphics.endFill();
        }

        graphics.beginFill(palette.side, 0.92);
        graphics.drawPolygon([
            x + 5,
            frontY,
            x + width - 5,
            frontY,
            x + width - 10,
            bottomY,
            x + 10,
            bottomY
        ]);
        graphics.endFill();

        graphics.lineStyle(2, palette.outline, candle.trend === "neutral" ? 0.36 : 0.82);
        graphics.beginFill(palette.top, candle.trend === "neutral" ? 0.96 : 1);
        graphics.drawRoundedRect(x, topY, width, height, 6);
        graphics.endFill();

        graphics.lineStyle(2, 0xffffff, candle.trend === "neutral" ? 0.2 : 0.32);
        graphics.moveTo(x + 6, topY + 6);
        graphics.lineTo(x + width - 8, topY + 6);

        graphics.lineStyle(4, palette.wick, candle.trend === "neutral" ? 0.7 : 0.96);
        graphics.moveTo(x + width / 2, topY - 18);
        graphics.lineTo(x + width / 2, topY + height * 0.44);
    }

    function updateCandle(candle, dt) {
        const bob = Math.sin(state.elapsed * candle.bobSpeed + candle.bobPhase) * candle.bobSize;
        const desiredHeight = candle.target + bob;
        candle.height = lerp(candle.height, desiredHeight, candle.rate * dt);
        candle.height = clamp(candle.height, 2, 138);
        candle.shockAge += dt;
    }

    function chooseMarketWave() {
        const chosen = new Set();
        const greenCount = 8;
        const redCount = 8;

        candles.forEach((candle) => {
            candle.trend = "neutral";
            candle.target = randomRange(32, 66);
            candle.rate = randomRange(1.6, 2.6);
            candle.bobSize = randomRange(2.5, 7);
            candle.shockAge = 0;
        });

        while (chosen.size < greenCount + redCount) {
            chosen.add(Math.floor(Math.random() * candles.length));
        }

        Array.from(chosen).forEach((index, order) => {
            const candle = candles[index];
            const isBull = order < greenCount;
            candle.trend = isBull ? "bull" : "bear";
            candle.target = isBull ? randomRange(88, 132) : randomRange(4, 22);
            candle.rate = isBull ? randomRange(3.8, 5.6) : randomRange(5.4, 7.5);
            candle.bobSize = isBull ? randomRange(4, 9) : randomRange(1.5, 4);
            candle.shockAge = 0;
        });

        state.phase = phases[Math.floor(Math.random() * phases.length)];
        phaseValue.textContent = state.phase;
        state.nextWaveIn = randomRange(4.2, 5.8);
    }

    function getTile(col, row) {
        if (col < 0 || col >= COLS || row < 0 || row >= ROWS) {
            return null;
        }

        return candles[row * COLS + col] || null;
    }

    function tileUnderPlayer(player) {
        if (player.x < 0 || player.y < 0 || player.x >= COLS || player.y >= ROWS) {
            return null;
        }

        return getTile(Math.floor(player.x), Math.floor(player.y));
    }

    function trendLabel(tile) {
        if (!tile) {
            return "Fora da arena";
        }

        if (tile.trend === "bull") {
            return "Alta +";
        }

        if (tile.trend === "bear") {
            return "Queda -";
        }

        return "Neutro";
    }

    function setHudTrendClass(tile) {
        const trend = tile ? tile.trend : "neutral";

        [scoreValue.parentElement, heightValue.parentElement].forEach((item) => {
            item.classList.toggle("is-bull", trend === "bull");
            item.classList.toggle("is-bear", trend === "bear");
        });
    }

    function updateHumanScore(dt) {
        const human = players.find((player) => player.isHuman);

        if (!human) {
            return;
        }

        const tile = tileUnderPlayer(human);
        const currentHeight = Math.max(0, human.altitude - PLAYER_FOOT_OFFSET);
        const heightWealth = wealthFromHeight(currentHeight);
        const isGroundedOnTile = Boolean(tile && human.grounded);

        if (isGroundedOnTile && tile.trend === "bull") {
            const liftBonus = Math.max(0, tile.height - 48);
            state.currentWealth = Math.max(state.currentWealth, heightWealth);
            state.currentWealth += (780 + liftBonus * 34) * dt;
            state.scoreTrend = "bull";
        } else if (isGroundedOnTile && tile.trend === "bear") {
            const trapPressure = Math.max(0, 72 - tile.height);
            const drawdownTarget = BASE_WEALTH + currentHeight * (HEIGHT_WEALTH_RATE * 0.48);
            state.currentWealth = Math.min(state.currentWealth, drawdownTarget);
            state.currentWealth -= (1450 + trapPressure * 48) * dt;
            state.scoreTrend = "bear";
        } else {
            state.currentWealth = lerp(state.currentWealth, heightWealth, 2.7 * dt);
            state.scoreTrend = "neutral";
        }

        state.currentWealth = clamp(state.currentWealth, BASE_WEALTH * 0.35, 999999);

        if (state.scoreTrend !== "bear") {
            state.maxWealth = Math.max(state.maxWealth, state.currentWealth);
        }
    }

    function resetGame() {
        state.started = true;
        state.gameOver = false;
        state.elapsed = 0;
        state.timeLeft = TIME_LIMIT;
        state.nextWaveIn = 0.6;
        state.tipTimer = 1.5;
        state.phase = "Abertura";
        state.bestHeight = 0;
        state.currentWealth = BASE_WEALTH;
        state.maxWealth = BASE_WEALTH;
        state.scoreTrend = "neutral";
        phaseValue.textContent = state.phase;
        mentorMessage.textContent = "A IA abriu o pregão: procure as velas verdes antes que o fluxo mude.";

        buildCandles();
        buildPlayers();
        chooseMarketWave();
        updateHud();
        resultOverlay.classList.remove("is-open");
        resultOverlay.setAttribute("aria-hidden", "true");
    }

    function startGame() {
        startOverlay.classList.remove("is-open");
        resetGame();
        stageElement.focus();
    }

    function endGame(reason) {
        if (state.gameOver) {
            return;
        }

        state.gameOver = true;
        state.started = false;

        const score = Math.round(state.maxWealth);
        const isNewRecord = score > state.bestWealth;
        saveRecord(score);
        updateHud();

        resultReason.textContent = reason;
        finalScore.textContent = moneyFormatter.format(score);
        resultMessage.textContent = isNewRecord
            ? "Novo recorde local. A IA aprovou sua leitura de risco."
            : "Você sobreviveu ao gráfico, mas ainda dá para escalar mais alto.";
        resultOverlay.classList.add("is-open");
        resultOverlay.setAttribute("aria-hidden", "false");
    }

    function updateHud() {
        const human = players.find((player) => player.isHuman);
        const currentHeight = human ? Math.max(0, human.altitude - PLAYER_FOOT_OFFSET) : 0;
        const tile = human ? tileUnderPlayer(human) : null;
        const score = Math.round(state.currentWealth);
        const meterPercent = clamp((state.bestHeight / 135) * 100, 0, 100);

        timeValue.textContent = formatTime(state.timeLeft);
        scoreValue.textContent = moneyFormatter.format(score);
        heightValue.textContent = `${currentHeight.toFixed(1)} m · ${trendLabel(tile)}`;
        recordValue.textContent = moneyFormatter.format(state.bestWealth);
        recordFill.style.height = `${meterPercent}%`;
        setHudTrendClass(tile);
    }

    function setMentorTip(text) {
        mentorMessage.textContent = text;
        const mentor = players.find((player) => player.isMentor);

        if (mentor) {
            mentor.bubble.text = text.length > 86 ? `${text.slice(0, 83)}...` : text;
            mentor.bubble.visible = true;
            mentor.bubbleTimer = 3.8;
        }
    }

    function attemptJump(player) {
        if (!player.grounded || player.jumpCooldown > 0) {
            return;
        }

        player.grounded = false;
        player.verticalVelocity = 75;
        player.jumpCooldown = 0.22;
    }

    function triggerDash(player, dirX, dirY) {
        if (player.dashCooldown > 0) {
            return;
        }

        const hasDirection = Math.hypot(dirX, dirY) > 0.05;
        const x = hasDirection ? dirX : 0;
        const y = hasDirection ? dirY : -1;
        player.vx += x * 5.2;
        player.vy += y * 5.2;
        player.dashCooldown = 1.15;
        player.dashBoost = 0.28;
    }

    function updateHuman(player, dt) {
        let dirX = Number(input.right) - Number(input.left);
        let dirY = Number(input.down) - Number(input.up);
        const length = Math.hypot(dirX, dirY);

        if (length > 0) {
            dirX /= length;
            dirY /= length;
        }

        const tile = tileUnderPlayer(player);
        const lowGroundPenalty = tile ? clamp(tile.height / 70, 0.54, 1.16) : 0.85;
        const bearPenalty = tile && tile.trend === "bear" ? 0.62 : 1;
        const targetSpeed = 2.55 * lowGroundPenalty * bearPenalty;

        player.vx = lerp(player.vx, dirX * targetSpeed, 9 * dt);
        player.vy = lerp(player.vy, dirY * targetSpeed, 9 * dt);

        if (input.jumpQueued) {
            attemptJump(player);
            input.jumpQueued = false;
        }

        if (input.dashQueued) {
            triggerDash(player, dirX, dirY);
            input.dashQueued = false;
        }
    }

    function scoreTileForBot(bot, candle) {
        const centerX = candle.col + 0.5;
        const centerY = candle.row + 0.5;
        const distance = Math.hypot(centerX - bot.x, centerY - bot.y);
        const trendScore = candle.trend === "bull" ? 80 : candle.trend === "bear" ? -120 : 0;
        const heightScore = candle.height * 0.72;
        return trendScore + heightScore - distance * 14 + Math.random() * 12;
    }

    function chooseBotTarget(bot) {
        let best = candles[0];
        let bestScore = -Infinity;

        candles.forEach((candle) => {
            const score = scoreTileForBot(bot, candle);
            if (score > bestScore) {
                best = candle;
                bestScore = score;
            }
        });

        bot.target = {
            x: best.col + 0.5 + randomRange(-0.12, 0.12),
            y: best.row + 0.5 + randomRange(-0.12, 0.12)
        };
        bot.thinkTimer = randomRange(0.65, 1.55);
    }

    function updateBot(bot, dt) {
        bot.thinkTimer -= dt;

        if (bot.thinkTimer <= 0) {
            chooseBotTarget(bot);
        }

        const dx = bot.target.x - bot.x;
        const dy = bot.target.y - bot.y;
        const distance = Math.hypot(dx, dy) || 1;
        const dirX = dx / distance;
        const dirY = dy / distance;
        const tile = tileUnderPlayer(bot);
        const speed = bot.isMentor ? 2.15 : 1.95;

        bot.vx = lerp(bot.vx, dirX * speed, 5.8 * dt);
        bot.vy = lerp(bot.vy, dirY * speed, 5.8 * dt);

        const nextTile = getTile(Math.floor(bot.target.x), Math.floor(bot.target.y));
        if (nextTile && tile && nextTile.height > tile.height + 22 && bot.grounded) {
            attemptJump(bot);
        }

        if (bot.bubbleTimer > 0) {
            bot.bubbleTimer -= dt;
            bot.bubble.visible = bot.bubbleTimer > 0;
        }
    }

    function canMoveTo(player, oldX, oldY) {
        if (!player.grounded) {
            return true;
        }

        const previousTile = getTile(Math.floor(oldX), Math.floor(oldY));
        const nextTile = tileUnderPlayer(player);

        if (!previousTile || !nextTile) {
            return true;
        }

        return nextTile.height <= player.altitude + 22;
    }

    function movePlayer(player, dt) {
        const oldX = player.x;
        const oldY = player.y;

        player.x += player.vx * dt;
        player.y += player.vy * dt;

        if (!canMoveTo(player, oldX, oldY)) {
            player.x = oldX;
            player.y = oldY;
            player.vx *= -0.24;
            player.vy *= -0.24;
        }

        player.vx *= Math.pow(0.88, dt * 8);
        player.vy *= Math.pow(0.88, dt * 8);
    }

    function updateVerticalPhysics(player, dt) {
        const tile = tileUnderPlayer(player);
        const ground = tile ? tile.height + PLAYER_FOOT_OFFSET : -90;

        if (player.grounded) {
            if (!tile) {
                player.grounded = false;
                player.verticalVelocity = -18;
            } else {
                player.altitude = ground;
            }
        } else {
            player.altitude += player.verticalVelocity * dt;
            player.verticalVelocity -= 158 * dt;

            if (tile && player.verticalVelocity <= 0 && player.altitude <= ground) {
                player.altitude = ground;
                player.verticalVelocity = 0;
                player.grounded = true;
            }
        }

        player.jumpCooldown = Math.max(0, player.jumpCooldown - dt);
        player.dashCooldown = Math.max(0, player.dashCooldown - dt);
        player.dashBoost = Math.max(0, player.dashBoost - dt);
        player.maxHeight = Math.max(player.maxHeight, player.altitude - PLAYER_FOOT_OFFSET);

        if (player.isHuman) {
            state.bestHeight = Math.max(state.bestHeight, player.maxHeight);
            const outsideGrid = player.x < -0.25 || player.y < -0.25 || player.x > COLS + 0.25 || player.y > ROWS + 0.25;
            if (outsideGrid && player.altitude < -8) {
                endGame("Você caiu da arena");
            }
        }
    }

    function resolvePlayerCollisions() {
        for (let i = 0; i < players.length; i += 1) {
            for (let j = i + 1; j < players.length; j += 1) {
                const a = players[i];
                const b = players[j];
                const altitudeDiff = Math.abs(a.altitude - b.altitude);

                if (altitudeDiff > 34) {
                    continue;
                }

                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const distance = Math.hypot(dx, dy);
                const minDistance = PLAYER_RADIUS * 2;

                if (distance <= 0 || distance >= minDistance) {
                    continue;
                }

                const nx = dx / distance;
                const ny = dy / distance;
                const overlap = minDistance - distance;
                const dashPower = (a.dashBoost > 0 || b.dashBoost > 0) ? 2.5 : 1;
                const impulse = (1.8 + overlap * 4) * dashPower;

                a.x -= nx * overlap * 0.5;
                a.y -= ny * overlap * 0.5;
                b.x += nx * overlap * 0.5;
                b.y += ny * overlap * 0.5;
                a.vx -= nx * impulse;
                a.vy -= ny * impulse;
                b.vx += nx * impulse;
                b.vy += ny * impulse;

                if ((a.isHuman || b.isHuman) && Math.random() < 0.08) {
                    setMentorTip("Contato no pregão: espaço importa tanto quanto direção.");
                }
            }
        }
    }

    function updatePlayers(dt) {
        players.forEach((player) => {
            if (player.isHuman) {
                updateHuman(player, dt);
            } else {
                updateBot(player, dt);
            }

            movePlayer(player, dt);
            updateVerticalPhysics(player, dt);
        });

        resolvePlayerCollisions();
    }

    function updateMentor(dt) {
        state.tipTimer -= dt;

        if (state.tipTimer <= 0) {
            const human = players.find((player) => player.isHuman);
            const tile = human ? tileUnderPlayer(human) : null;

            if (tile && tile.trend === "bear") {
                setMentorTip("Você está em queda. Cortar risco cedo evita ficar preso no fundo.");
            } else if (tile && tile.trend === "bull") {
                setMentorTip("Boa leitura: alta ajuda, mas realize vantagem antes da virada.");
            } else {
                setMentorTip(mentorTips[Math.floor(Math.random() * mentorTips.length)]);
            }

            state.tipTimer = randomRange(6.5, 9.5);
        }
    }

    function renderPlayers() {
        players.forEach((player) => {
            const position = playerScreenPosition(player);
            const scale = clamp(0.78 + player.altitude / 210, 0.72, 1.22);

            player.container.x = position.x;
            player.container.y = position.y;
            player.container.scale.set(scale);
            player.container.zIndex = position.y;
            player.bubble.y = -62;
        });

        layers.players.sortableChildren = true;
        layers.players.sortChildren();
    }

    function renderScene() {
        drawArenaFrame();
        candles.forEach(drawCandle);
        renderPlayers();
    }

    function updateGame(dt) {
        state.elapsed += dt;

        if (!state.started || state.gameOver) {
            renderScene();
            return;
        }

        state.timeLeft -= dt;
        state.nextWaveIn -= dt;

        if (state.nextWaveIn <= 0) {
            chooseMarketWave();
        }

        candles.forEach((candle) => updateCandle(candle, dt));
        updatePlayers(dt);
        updateHumanScore(dt);
        updateMentor(dt);
        updateHud();

        if (state.timeLeft <= 0) {
            endGame("Pregão encerrado");
        }

        renderScene();
    }

    function setKeyState(event, isDown) {
        const code = event.code;
        const mapped = {
            KeyW: "up",
            ArrowUp: "up",
            KeyS: "down",
            ArrowDown: "down",
            KeyA: "left",
            ArrowLeft: "left",
            KeyD: "right",
            ArrowRight: "right"
        }[code];

        if (mapped) {
            input[mapped] = isDown;
            event.preventDefault();
            return;
        }

        if (isDown && code === "Space") {
            input.jumpQueued = true;
            event.preventDefault();
            return;
        }

        if (isDown && (code === "ShiftLeft" || code === "ShiftRight")) {
            input.dashQueued = true;
            event.preventDefault();
            return;
        }

        if (isDown && code === "Enter" && state.gameOver) {
            resetGame();
            event.preventDefault();
        }
    }

    window.addEventListener("keydown", (event) => setKeyState(event, true));
    window.addEventListener("keyup", (event) => setKeyState(event, false));
    stageElement.addEventListener("pointerdown", () => stageElement.focus());
    startButton.addEventListener("click", startGame);
    restartButton.addEventListener("click", () => {
        resultOverlay.classList.remove("is-open");
        resultOverlay.setAttribute("aria-hidden", "true");
        resetGame();
        stageElement.focus();
    });

    window.addEventListener("resize", () => {
        calculateLayout();
        renderScene();
    });

    calculateLayout();
    buildCandles();
    buildPlayers();
    updateHud();
    renderScene();

    app.ticker.add((delta) => {
        const dt = Math.min(delta / 60, 0.033);
        updateGame(dt);
    });
})();
