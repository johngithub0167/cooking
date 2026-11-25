/**
 * 以字符串为种子的确定性伪随机（BE-014）
 *
 * 用途：同一天（同一 seed）对同一候选池打乱，结果稳定可复现；
 * 换一批靠 exclude 改变候选池，结果自然不同。
 * 采用 xmur3 生成种子 + mulberry32 生成序列，纯 JS 无依赖。
 */

/** 把字符串散列成 32 位种子 */
function hashSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/**
 * 返回一个 [0,1) 伪随机函数；相同 seed 序列完全一致。
 * @param {string} seed 种子字符串（如 YYYY-MM-DD）
 */
function seedRandom(seed) {
  const seedFn = hashSeed(String(seed));
  let a = seedFn();
  return function random() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 用给定种子确定性地打乱数组（返回新数组，不改原数组） */
function shuffleWithSeed(array, seed) {
  const result = array.slice();
  const random = seedRandom(seed);
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = result[i];
    result[i] = result[j];
    result[j] = tmp;
  }
  return result;
}

module.exports = { seedRandom, shuffleWithSeed };
