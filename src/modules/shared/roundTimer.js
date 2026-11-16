// Round timer for games. One interval, idempotent stop(), so a screen's
// cleanup function is just `timer.stop()`.
//
//   const timer = createRoundTimer({ seconds: 60, onTick: (s) => paint(s), onEnd: finish });
//   timer.start();  timer.pause();  timer.resume();  timer.stop();
//
// onTick runs after every second that passes (with the seconds left);
// onEnd runs once, when the time reaches 0 (never after stop()).

export function createRoundTimer({ seconds, onTick = () => {}, onEnd = () => {} }) {
  let left = seconds;
  let id = null;
  let finished = false;

  function clear() {
    if (id !== null) clearInterval(id);
    id = null;
  }

  function tick() {
    left--;
    if (left <= 0) {
      left = 0;
      clear();
      finished = true;
      onTick(0);
      onEnd();
    } else {
      onTick(left);
    }
  }

  function run() {
    if (id === null && !finished) id = setInterval(tick, 1000);
  }

  return {
    start: run,
    pause: clear,
    resume: run,
    stop() {
      clear();
      finished = true;
    },
    remaining: () => left,
  };
}
