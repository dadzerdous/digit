const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const game = document.getElementById("game");

const TILE = 48;
const WORLD_ROWS = 120;

let columns = 9;
let world = [];
let cameraY = 0;

const player = {
    x: 4,
    y: 0,

    money: 0,

    stamina: 100,
    maxStamina: 100,

    bagCapacity: 10,

    inventory: {
        copper: 0,
        silver: 0,
        gold: 0
    },

    torches: 5
};

const ores = {
    copper: {
        name: "Copper",
        color: "#c87545",
        value: 5,
        weight: 1
    },

    silver: {
        name: "Silver",
        color: "#bec8d1",
        value: 12,
        weight: 1.5
    },

    gold: {
        name: "Gold",
        color: "#e5b82d",
        value: 25,
        weight: 2
    }
};


/* =========================
   WORLD
========================= */

function makeTile(type) {
    return {
        type: type
    };
}

function generateWorld() {
    world = [];

    player.x = Math.floor(columns / 2);

    for (let y = 0; y < WORLD_ROWS; y++) {
        const row = [];

        for (let x = 0; x < columns; x++) {
            if (y === 0) {
                row.push(makeTile("air"));
                continue;
            }

            let type = "dirt";

            const roll = Math.random();

            if (
                y >= 3 &&
                roll < .10
            ) {
                type = "copper";
            }

            if (
                y >= 10 &&
                roll < .055
            ) {
                type = "silver";
            }

            if (
                y >= 20 &&
                roll < .025
            ) {
                type = "gold";
            }

            row.push(makeTile(type));
        }

        world.push(row);
    }

    world[1][player.x] =
        makeTile("air");
}


/* =========================
   INVENTORY / WEIGHT
========================= */

function getBagWeight() {
    let weight = 0;

    for (const type in player.inventory) {
        weight +=
            player.inventory[type] *
            ores[type].weight;
    }

    return weight;
}

function getBagItems() {
    let total = 0;

    for (const type in player.inventory) {
        total += player.inventory[type];
    }

    return total;
}

function staminaCost() {
    return 1 + getBagWeight() * .1;
}


/* =========================
   TORCHES
========================= */

let torches = [];

const TORCH_LIFE = 45;

const PLAYER_LIGHT_RADIUS = 2.4;
const TORCH_LIGHT_RADIUS = 3.1;

function placeTorch() {
    if (player.y === 0) {
        showMessage(
            "No need for a torch here."
        );
        return;
    }

    if (player.torches <= 0) {
        showMessage(
            "No torches left."
        );
        return;
    }

    const existing =
        torches.find(t =>
            t.x === player.x &&
            t.y === player.y
        );

    if (existing) {
        showMessage(
            "There's already a torch here."
        );
        return;
    }

    player.torches--;

    torches.push({
        x: player.x,
        y: player.y,
        life: TORCH_LIFE
    });

    showMessage("Torch placed.");

    updateUI();
}

function ageTorches() {
    for (const torch of torches) {
        torch.life--;
    }

    torches =
        torches.filter(
            torch => torch.life > 0
        );
}


/* =========================
   LIGHT
========================= */

function distance(x1, y1, x2, y2) {
    const dx = x1 - x2;
    const dy = y1 - y2;

    return Math.sqrt(
        dx * dx +
        dy * dy
    );
}

function tileLightLevel(x, y) {
    if (y <= 1) {
        return 1;
    }

    let light = 0;

    const playerDistance =
        distance(
            x,
            y,
            player.x,
            player.y
        );

    if (
        playerDistance <=
        PLAYER_LIGHT_RADIUS
    ) {
        light =
            Math.max(
                light,
                1 -
                playerDistance /
                (PLAYER_LIGHT_RADIUS + .8)
            );
    }

    for (const torch of torches) {
        const d =
            distance(
                x,
                y,
                torch.x,
                torch.y
            );

        if (
            d <=
            TORCH_LIGHT_RADIUS
        ) {
            const strength =
                Math.min(
                    1,
                    torch.life / 8
                );

            light =
                Math.max(
                    light,
                    (
                        1 -
                        d /
                        (TORCH_LIGHT_RADIUS + .8)
                    ) *
                    strength
                );
        }
    }

    return Math.max(
        0,
        Math.min(1, light)
    );
}


/* =========================
   MOVEMENT
========================= */

let lastAction = 0;

const ACTION_DELAY = 130;

function move(dx, dy) {
    if (
        document
            .getElementById("bagPanel")
            .classList
            .contains("open")
    ) {
        return;
    }

    const now = performance.now();

    if (
        now - lastAction <
        ACTION_DELAY
    ) {
        return;
    }

    lastAction = now;

    const targetX =
        player.x + dx;

    const targetY =
        player.y + dy;

    if (
        targetX < 0 ||
        targetX >= columns ||
        targetY < 0 ||
        targetY >= WORLD_ROWS
    ) {
        return;
    }

    const tile =
        world[targetY][targetX];

    if (player.y > 0) {
        const cost =
            staminaCost();

        if (
            player.stamina <
            cost
        ) {
            showMessage(
                "Too exhausted."
            );

            return;
        }

        player.stamina -= cost;
    }

    if (tile.type === "air") {
        player.x = targetX;
        player.y = targetY;
    }

    else if (
        tile.type === "dirt"
    ) {
        world[targetY][targetX] =
            makeTile("air");

        player.x = targetX;
        player.y = targetY;
    }

    else if (
        ores[tile.type]
    ) {
        if (
            getBagItems() >=
            player.bagCapacity
        ) {
            showMessage(
                "Backpack full."
            );

            return;
        }

        player.inventory[
            tile.type
        ]++;

        world[targetY][targetX] =
            makeTile("air");

        player.x = targetX;
        player.y = targetY;

        showMessage(
            ores[tile.type].name +
            " collected"
        );
    }

    ageTorches();

    checkSurface();

    updateUI();
}


/* =========================
   SURFACE
========================= */

function checkSurface() {
    if (player.y !== 0) {
        return;
    }

    let moneyEarned = 0;

    for (
        const type
        in player.inventory
    ) {
        moneyEarned +=
            player.inventory[type] *
            ores[type].value;
    }

    if (moneyEarned > 0) {
        player.money +=
            moneyEarned;

        showMessage(
            "Sold ore: +" +
            moneyEarned +
            " coins"
        );

        for (
            const type
            in player.inventory
        ) {
            player.inventory[type] = 0;
        }
    }

    player.stamina =
        player.maxStamina;
}


/* =========================
   CAMERA
========================= */

function updateCamera() {
    const height =
        game.clientHeight;

    const target =
        height * .42;

    const playerWorldY =
        player.y * TILE +
        TILE / 2;

    let desired =
        playerWorldY -
        target;

    desired =
        Math.max(
            0,
            desired
        );

    cameraY +=
        (desired - cameraY) *
        .16;
}


/* =========================
   DRAW
========================= */

function draw() {
    updateCamera();

    const width =
        game.clientWidth;

    const height =
        game.clientHeight;

    ctx.clearRect(
        0,
        0,
        width,
        height
    );

    ctx.fillStyle = "#050505";

    ctx.fillRect(
        0,
        0,
        width,
        height
    );

    drawWorld();
    drawTorches();
    drawPlayer();
    drawDarkness();

    requestAnimationFrame(draw);
}


/* =========================
   WORLD DRAWING
========================= */

function drawWorld() {
    const height =
        game.clientHeight;

    const startRow =
        Math.max(
            0,
            Math.floor(
                cameraY / TILE
            ) - 2
        );

    const endRow =
        Math.min(
            WORLD_ROWS,
            startRow +
            Math.ceil(
                height / TILE
            ) +
            4
        );

    for (
        let y = startRow;
        y < endRow;
        y++
    ) {
        for (
            let x = 0;
            x < columns;
            x++
        ) {
            const tile =
                world[y][x];

            const px =
                x * TILE;

            const py =
                y * TILE -
                cameraY;

            if (y === 0) {
                ctx.fillStyle =
                    "#78bde2";

                ctx.fillRect(
                    px,
                    py,
                    TILE,
                    TILE
                );

                continue;
            }

            if (
                tile.type ===
                "air"
            ) {
                ctx.fillStyle =
                    "#17120f";

                ctx.fillRect(
                    px,
                    py,
                    TILE,
                    TILE
                );

                continue;
            }

            ctx.fillStyle =
                "#654329";

            ctx.fillRect(
                px,
                py,
                TILE,
                TILE
            );

            ctx.strokeStyle =
                "rgba(0,0,0,.18)";

            ctx.strokeRect(
                px,
                py,
                TILE,
                TILE
            );

            ctx.fillStyle =
                "rgba(0,0,0,.12)";

            ctx.beginPath();

            ctx.arc(
                px + 14,
                py + 15,
                3,
                0,
                Math.PI * 2
            );

            ctx.fill();

            ctx.beginPath();

            ctx.arc(
                px + 35,
                py + 31,
                2,
                0,
                Math.PI * 2
            );

            ctx.fill();

            if (
                ores[tile.type]
            ) {
                ctx.fillStyle =
                    ores[
                        tile.type
                    ].color;

                ctx.beginPath();

                ctx.arc(
                    px + 16,
                    py + 17,
                    7,
                    0,
                    Math.PI * 2
                );

                ctx.fill();

                ctx.beginPath();

                ctx.arc(
                    px + 33,
                    py + 31,
                    6,
                    0,
                    Math.PI * 2
                );

                ctx.fill();

                ctx.beginPath();

                ctx.arc(
                    px + 31,
                    py + 13,
                    4,
                    0,
                    Math.PI * 2
                );

                ctx.fill();
            }
        }
    }

    const groundY =
        TILE - cameraY;

    ctx.fillStyle =
        "#51934a";

    ctx.fillRect(
        0,
        groundY - 7,
        game.clientWidth,
        7
    );
}


/* =========================
   TORCH DRAWING
========================= */

function drawTorches() {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.font = "24px Arial";

    for (
        const torch
        of torches
    ) {
        const px =
            torch.x * TILE +
            TILE / 2;

        const py =
            torch.y * TILE +
            TILE / 2 -
            cameraY;

        ctx.fillText(
            "🔥",
            px,
            py
        );
    }

    ctx.textAlign = "left";
    ctx.textBaseline =
        "alphabetic";
}


/* =========================
   PLAYER DRAWING
========================= */

function drawPlayer() {
    const px =
        player.x * TILE +
        TILE / 2;

    const py =
        player.y * TILE +
        TILE / 2 -
        cameraY;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.font = "34px Arial";

    ctx.fillText(
        "👷",
        px,
        py
    );

    ctx.textAlign = "left";
    ctx.textBaseline =
        "alphabetic";
}


/* =========================
   DARKNESS
========================= */

function drawDarkness() {
    const height =
        game.clientHeight;

    const startRow =
        Math.max(
            1,
            Math.floor(
                cameraY / TILE
            ) - 2
        );

    const endRow =
        Math.min(
            WORLD_ROWS,
            startRow +
            Math.ceil(
                height / TILE
            ) +
            4
        );

    for (
        let y = startRow;
        y < endRow;
        y++
    ) {
        for (
            let x = 0;
            x < columns;
            x++
        ) {
            const light =
                tileLightLevel(
                    x,
                    y
                );

            const darkness =
                .94 -
                light * .86;

            if (
                darkness <= 0
            ) {
                continue;
            }

            ctx.fillStyle =
                `rgba(0,0,0,${darkness})`;

            ctx.fillRect(
                x * TILE,
                y * TILE -
                    cameraY,
                TILE + 1,
                TILE + 1
            );
        }
    }
}


/* =========================
   UI
========================= */

function updateUI() {
    const staminaPercent =
        Math.max(
            0,
            player.stamina /
            player.maxStamina *
            100
        );

    const bar =
        document.getElementById(
            "staminaBar"
        );

    bar.style.width =
        staminaPercent + "%";

    if (
        staminaPercent > 50
    ) {
        bar.style.background =
            "#63d471";
    }

    else if (
        staminaPercent > 25
    ) {
        bar.style.background =
            "#e0b83f";
    }

    else {
        bar.style.background =
            "#d95656";
    }

    document
        .getElementById(
            "coins"
        )
        .textContent =
        "🪙 " +
        player.money;

    document
        .getElementById(
            "depth"
        )
        .textContent =
        player.y +
        "m";

    document
        .getElementById(
            "bagAmount"
        )
        .textContent =
        getBagItems() +
        "/" +
        player.bagCapacity;

    document
        .getElementById(
            "torchCount"
        )
        .textContent =
        player.torches;

    document
        .getElementById(
            "surfacePanel"
        )
        .style.display =
        player.y === 0
            ? "block"
            : "none";

    updateBag();
}


/* =========================
   BACKPACK
========================= */

function updateBag() {
    const contents =
        document.getElementById(
            "bagContents"
        );

    const weight =
        getBagWeight();

    document
        .getElementById(
            "weightInfo"
        )
        .innerHTML =
        `Weight: <strong>${weight.toFixed(1)}</strong>
        &nbsp;•&nbsp;
        Stamina/action:
        <strong>${staminaCost().toFixed(1)}</strong>`;

    contents.innerHTML = "";

    let hasItems = false;

    for (
        const type
        in player.inventory
    ) {
        const amount =
            player.inventory[
                type
            ];

        if (amount <= 0) {
            continue;
        }

        hasItems = true;

        const ore =
            ores[type];

        const row =
            document.createElement(
                "div"
            );

        row.className =
            "bagRow";

        row.innerHTML = `
            <div class="oreName">

                <strong>
                    ${ore.name}
                    ×${amount}
                </strong>

                <div class="oreDetails">
                    ${ore.weight}
                    weight each
                    •
                    ${ore.value}
                    coins each
                </div>

            </div>

            <button
                class="drop"
                data-type="${type}"
            >
                Drop
            </button>
        `;

        contents.appendChild(
            row
        );
    }

    if (!hasItems) {
        contents.innerHTML =
            `<div class="emptyBag">
                Your backpack is empty.
            </div>`;
    }

    document
        .querySelectorAll(
            ".drop"
        )
        .forEach(button => {
            button.onclick =
                () => {
                    dropOre(
                        button
                            .dataset
                            .type
                    );
                };
        });
}

function dropOre(type) {
    if (
        player.inventory[type] <= 0
    ) {
        return;
    }

    player.inventory[type]--;

    showMessage(
        "Dropped " +
        ores[type].name
    );

    updateUI();
}


/* =========================
   MESSAGES
========================= */

let messageTimeout;

function showMessage(text) {
    const box =
        document.getElementById(
            "message"
        );

    box.textContent = text;

    box.classList.add(
        "show"
    );

    clearTimeout(
        messageTimeout
    );

    messageTimeout =
        setTimeout(() => {
            box.classList.remove(
                "show"
            );
        }, 1100);
}


/* =========================
   MOVEMENT BUTTONS
========================= */

function bindMoveButton(
    id,
    dx,
    dy
) {
    const button =
        document.getElementById(
            id
        );

    let timer = null;

    function start(event) {
        event.preventDefault();

        move(dx, dy);

        clearInterval(timer);

        timer =
            setInterval(
                () => {
                    move(
                        dx,
                        dy
                    );
                },
                75
            );
    }

    function stop() {
        clearInterval(timer);
        timer = null;
    }

    button.addEventListener(
        "pointerdown",
        start
    );

    button.addEventListener(
        "pointerup",
        stop
    );

    button.addEventListener(
        "pointercancel",
        stop
    );

    button.addEventListener(
        "pointerleave",
        stop
    );
}

bindMoveButton(
    "up",
    0,
    -1
);

bindMoveButton(
    "down",
    0,
    1
);

bindMoveButton(
    "left",
    -1,
    0
);

bindMoveButton(
    "right",
    1,
    0
);


/* =========================
   KEYBOARD
========================= */

document.addEventListener(
    "keydown",
    event => {
        if (
            document
                .getElementById(
                    "bagPanel"
                )
                .classList
                .contains(
                    "open"
                )
        ) {
            return;
        }

        const key =
            event.key
                .toLowerCase();

        if (
            key === "arrowup" ||
            key === "w"
        ) {
            move(0, -1);
        }

        if (
            key === "arrowdown" ||
            key === "s"
        ) {
            move(0, 1);
        }

        if (
            key === "arrowleft" ||
            key === "a"
        ) {
            move(-1, 0);
        }

        if (
            key === "arrowright" ||
            key === "d"
        ) {
            move(1, 0);
        }

        if (key === "t") {
            placeTorch();
        }

        if (key === "b") {
            toggleBag();
        }
    }
);


/* =========================
   SWIPE
========================= */

let swipeStartX = 0;
let swipeStartY = 0;

canvas.addEventListener(
    "pointerdown",
    event => {
        swipeStartX =
            event.clientX;

        swipeStartY =
            event.clientY;
    }
);

canvas.addEventListener(
    "pointerup",
    event => {
        const dx =
            event.clientX -
            swipeStartX;

        const dy =
            event.clientY -
            swipeStartY;

        if (
            Math.hypot(
                dx,
                dy
            ) < 25
        ) {
            return;
        }

        if (
            Math.abs(dx) >
            Math.abs(dy)
        ) {
            move(
                dx > 0
                    ? 1
                    : -1,
                0
            );
        }

        else {
            move(
                0,
                dy > 0
                    ? 1
                    : -1
            );
        }
    }
);


/* =========================
   BACKPACK BUTTON
========================= */

function toggleBag() {
    const panel =
        document.getElementById(
            "bagPanel"
        );

    panel.classList.toggle(
        "open"
    );

    updateBag();
}

document
    .getElementById(
        "bagButton"
    )
    .onclick =
    toggleBag;

document
    .getElementById(
        "closeBag"
    )
    .onclick =
    toggleBag;


/* =========================
   TORCH BUTTON
========================= */

document
    .getElementById(
        "torchButton"
    )
    .onclick =
    placeTorch;


/* =========================
   RESIZE
========================= */

function resize() {
    const ratio =
        window.devicePixelRatio ||
        1;

    const width =
        game.clientWidth;

    const height =
        game.clientHeight;

    canvas.width =
        width * ratio;

    canvas.height =
        height * ratio;

    canvas.style.width =
        width + "px";

    canvas.style.height =
        height + "px";

    ctx.setTransform(
        ratio,
        0,
        0,
        ratio,
        0,
        0
    );

    const newColumns =
        Math.max(
            7,
            Math.floor(
                width / TILE
            )
        );

    columns =
        newColumns % 2 === 0
            ? newColumns - 1
            : newColumns;

    if (!world.length) {
        generateWorld();
    }
}

window.addEventListener(
    "resize",
    resize
);


/* =========================
   START
========================= */

resize();
updateUI();
draw();

showMessage(
    "Dig. Explore. Don't get greedy."
);
