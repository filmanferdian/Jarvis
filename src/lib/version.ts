export const VERSION = {
  major: 1,
  sprint: 7,
  iteration: 0,
  get string() {
    return `${this.major}.${this.sprint}.${this.iteration}`;
  },
};
