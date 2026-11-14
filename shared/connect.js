
/* =========================================
   1. GAME SETTINGS
========================================= */

const packets = [
    "10100110",
    "01101001",
    "11001010",
    "00110101",
    "10011100"
];

const timerSpeeds = [1000, 900, 800, 700, 600];
const wrongBitPenalty = 3;

const cameraCosts = {
    temperature: {
        cost: 100,
        power: 5
    },
    "standard-camera": {
        cost: 200,
        power: 10
    },
    "hd-camera": {
        cost: 350,
        power: 20
    }
};


/* =========================================
   2. GAME STATE
========================================= */

let currentPacket = 0;
let currentBit = 0;
let mistakes = 0;
let timeLeft = 60;
let timer = null;
let gameRunning = false;

let selectedCamera = "hd-camera";


/* =========================================
   3. HTML ELEMENTS
========================================= */

const $ = id => document.getElementById(id);

const zeroButton = $("input-zero");
const oneButton = $("input-one");
const feedback = $("encoding-feedback");


/* =========================================
   4. EQUIPMENT SELECTION
========================================= */

// Select a camera
document.querySelectorAll(".equipment-card").forEach(button => {
    button.addEventListener("click", () => {

        // Remove previous selection
        document.querySelectorAll(".equipment-card").forEach(b => {
            b.classList.remove("selected");
            b.setAttribute("aria-pressed", "false");
        });

        // Highlight selected camera
        button.classList.add("selected");
        button.setAttribute("aria-pressed", "true");

        selectedCamera = button.dataset.equipment;
    });
});


// Confirm selected equipment
$("confirm-equipment").addEventListener("click", () => {

    const c = cameraCosts[selectedCamera];

    // Calculate remaining budget
    $("budget").textContent =
        `${1000 - (c.cost + 350 + 200)} CR`;

    // Calculate total power usage
    $("power").textContent =
        `${c.power + 20 + 20} / 80 W`;

    // Move to encoding screen
    document.querySelector(".equipment-selection").hidden = true;
    $("encoding-game").hidden = false;

    render();
});


/* =========================================
   5. RENDER GAME SCREEN
========================================= */

function render() {

    // Update packet number
    $("packet-number").textContent =
        `${Math.min(currentPacket + 1, packets.length)} / ${packets.length}`;

    // Update time
    $("time-left").textContent = `${timeLeft}s`;

    // Update mistakes
    $("mistakes").textContent = mistakes;

    // Update completed packets
    $("packets-completed").textContent =
        Math.min(currentPacket, packets.length);


    // Calculate total number of bits
    const totalBits = packets.reduce(
        (n, p) => n + p.length,
        0
    );

    // Calculate completed bits
    const done =
        packets
            .slice(0, currentPacket)
            .reduce((n, p) => n + p.length, 0)
        + currentBit;

    // Update progress bar
    $("progress-fill").style.width =
        `${100 * done / totalBits}%`;


    // Display binary message
    const target = $("target-message");

    target.replaceChildren();

    const pattern =
        packets[Math.min(currentPacket, packets.length - 1)];

    [...pattern].forEach((bit, i) => {

        const cell = document.createElement("span");

        cell.className =
            "bit" +
            (i < currentBit
                ? " correct"
                : i === currentBit && gameRunning
                    ? " active"
                    : "");

        cell.textContent = bit;

        target.append(cell);
    });
}


/* =========================================
   6. TIMER
========================================= */

function startTimer() {

    clearInterval(timer);

    timer = setInterval(() => {

        if (!gameRunning) return;

        // Decrease remaining time
        timeLeft = Math.max(0, timeLeft - 1);

        render();

        // Check time limit
        if (timeLeft === 0) {
            endEncodingGame(false, "Time expired.");
        }

    }, timerSpeeds[currentPacket]);
}


/* =========================================
   7. START ENCODING GAME
========================================= */

function startEncodingGame() {

    clearInterval(timer);

    // Reset game state
    currentPacket = 0;
    currentBit = 0;
    mistakes = 0;
    timeLeft = 60;
    gameRunning = true;

    // Enable input buttons
    zeroButton.disabled = false;
    oneButton.disabled = false;

    feedback.textContent = "Encode the highlighted bit!";

    render();
    startTimer();
}


/* =========================================
   8. HANDLE ENCODING INPUT
========================================= */

function handleEncodingInput(bit) {

    if (!gameRunning) return;

    const correctBit = packets[currentPacket][currentBit];

    if (bit === correctBit) {

        // Correct input
        currentBit++;

        feedback.textContent = "Correct!";

        // Check whether current packet is complete
        if (currentBit === packets[currentPacket].length) {

            currentPacket++;
            currentBit = 0;

            // All packets completed
            if (currentPacket === packets.length) {
                endEncodingGame(true);
                return;
            }

            feedback.textContent =
                "Packet complete! Timer speed increased.";

            // Increase timer speed
            startTimer();
        }

    } else {

        // Wrong input
        mistakes++;

        // Deduct time penalty
        timeLeft = Math.max(
            0,
            timeLeft - wrongBitPenalty
        );

        feedback.textContent =
            `Wrong bit! −${wrongBitPenalty}s`;

        // Check failure conditions
        if (mistakes >= 5 || timeLeft === 0) {

            endEncodingGame(
                false,
                mistakes >= 5
                    ? "Too many errors."
                    : "Time expired."
            );

            return;
        }
    }

    render();
}


/* =========================================
   9. END ENCODING GAME
========================================= */

function endEncodingGame(success, reason = "") {

    gameRunning = false;

    // Stop timer
    clearInterval(timer);
    timer = null;

    // Disable input buttons
    zeroButton.disabled = true;
    oneButton.disabled = true;

    // Display result
    feedback.textContent = success
        ? "ENCODING SUCCESSFUL — Data ready for transmission!"
        : `MISSION FAILED — ${reason} Try again.`;

    render();

    // Notify next game stage
    if (success) {

        window.dispatchEvent(
            new CustomEvent("encodingComplete", {
                detail: {
                    camera: selectedCamera,
                    timeRemaining: timeLeft,
                    mistakes: mistakes
                }
            })
        );
    }
}


/* =========================================
   10. BUTTON EVENTS
========================================= */

// O button = Binary 0
zeroButton.addEventListener("click", () => {
    handleEncodingInput("0");
});

// X button = Binary 1
oneButton.addEventListener("click", () => {
    handleEncodingInput("1");
});

// Start game
$("start-encoding").addEventListener(
    "click",
    startEncodingGame
);

// Restart game
$("restart-encoding").addEventListener(
    "click",
    startEncodingGame
);


/* =========================================
   11. KEYBOARD INPUT
========================================= */

document.addEventListener("keydown", e => {

    // Ignore input when game is not running
    if (!gameRunning) return;

    // Prevent repeated or modified key input
    if (
        e.repeat ||
        e.altKey ||
        e.ctrlKey ||
        e.metaKey
    ) {
        return;
    }

    const key = e.key.toLowerCase();

    // O key = Binary 0
    if (key === "o") {
        handleEncodingInput("0");
    }

    // X key = Binary 1
    if (key === "x") {
        handleEncodingInput("1");
    }
});
