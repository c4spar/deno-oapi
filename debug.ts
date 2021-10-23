let verbose = 0;

function debug(level: number) {
  return (...args: Array<unknown>): void => {
    if (verbose >= level) {
      console.error(...args);
    }
  };
}

export const log = {
  info: debug(0),
  debug: debug(1),
  debugVerbose: debug(2),
  debugUgly: debug(3),
  setVerbose: (level: number): void => {
    verbose = level;
  },
};
