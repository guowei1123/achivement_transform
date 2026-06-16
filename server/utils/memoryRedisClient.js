function createMemoryRedisClient() {
  const values = new Map();
  const sortedSets = new Map();

  const getSortedSet = (key) => {
    if (!sortedSets.has(key)) {
      sortedSets.set(key, new Map());
    }
    return sortedSets.get(key);
  };

  return {
    isMemoryFallback: true,

    async get(key) {
      return values.get(key) || null;
    },

    async set(key, value) {
      values.set(key, value);
      return 'OK';
    },

    async del(key) {
      const existed = values.delete(key);
      return existed ? 1 : 0;
    },

    async expire() {
      return 1;
    },

    async zAdd(key, entries = []) {
      const set = getSortedSet(key);
      for (const entry of entries) {
        set.set(entry.value, Number(entry.score || 0));
      }
      return entries.length;
    },

    async zRange(key, start, stop) {
      const entries = Array.from(getSortedSet(key).entries())
        .sort((a, b) => a[1] - b[1])
        .map(([value]) => value);

      const normalizedStop = stop < 0 ? entries.length + stop : stop;
      return entries.slice(start, normalizedStop + 1);
    },

    async zRem(key, value) {
      const set = getSortedSet(key);
      return set.delete(value) ? 1 : 0;
    },

    async quit() {
      values.clear();
      sortedSets.clear();
    },
  };
}

module.exports = {
  createMemoryRedisClient,
};
