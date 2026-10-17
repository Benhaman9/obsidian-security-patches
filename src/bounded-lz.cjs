function createBoundedLZ(overrides = {}) {
  const defaults = { input: 16777216, output: 33554432, entries: 262144, dictionary: 67108864, work: 67108864 };
  const limits = { ...defaults, ...overrides };
  for (const key of Object.keys(defaults)) if (!Number.isSafeInteger(limits[key]) || limits[key] < 1 || limits[key] > defaults[key]) throw new RangeError('Invalid drawing decode budget');
  return function decode(length, resetValue, getNextValue) {
    const fail = () => { throw new RangeError('Compressed drawing decode budget exceeded or invalid input'); };
    if (!Number.isSafeInteger(length) || length < 0 || length > limits.input || !Number.isSafeInteger(resetValue) || resetValue < 1 || resetValue > 32768 || (resetValue & (resetValue - 1))) fail();
    let work = 0, dictionaryChars = 0, outputChars = 0;
    const dictionary = [0, 1, 2], output = [];
    const state = { value: getNextValue(0), position: resetValue, index: 1 };
    function bits(count) {
      if (count > 24) fail();
      let result = 0, power = 1;
      for (let i = 0; i < count; i++) {
        if (++work > limits.work || !Number.isInteger(state.value) || state.index > length + 1) fail();
        if (state.value & state.position) result += power;
        state.position >>= 1;
        if (!state.position) { state.position = resetValue; state.value = getNextValue(state.index++); }
        power *= 2;
      }
      return result;
    }
    function put(first, suffix = '') {
      const size = first.length + suffix.length;
      if (dictionary.length >= limits.entries || dictionaryChars + size > limits.dictionary) fail();
      dictionaryChars += size;
      dictionary.push(first + suffix);
    }
    function emit(value) {
      if (outputChars + value.length > limits.output) fail();
      outputChars += value.length;
      output.push(value);
    }
    let initial = bits(2), word;
    if (initial === 2) return '';
    if (initial === 0) word = String.fromCharCode(bits(8));
    else if (initial === 1) word = String.fromCharCode(bits(16));
    else fail();
    put(word);
    emit(word);
    let enlarge = 4, width = 3;
    while (true) {
      let code = bits(width);
      if (code === 0 || code === 1) {
        put(String.fromCharCode(bits(code === 0 ? 8 : 16)));
        code = dictionary.length - 1;
        enlarge--;
      } else if (code === 2) return output.join('');
      if (!enlarge) { enlarge = Math.pow(2, width); width++; }
      let entry = dictionary[code];
      if (typeof entry !== 'string') {
        if (code !== dictionary.length || outputChars + word.length + 1 > limits.output) fail();
        entry = word + word.charAt(0);
      }
      emit(entry);
      put(word, entry.charAt(0));
      word = entry;
      if (!--enlarge) { enlarge = Math.pow(2, width); width++; }
    }
  };
}
module.exports = createBoundedLZ;
