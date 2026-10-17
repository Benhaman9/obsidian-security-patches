function matrixBudget(dimensions) {
  if (!Array.isArray(dimensions) || dimensions.length > 8) throw new RangeError('Matrix rank exceeds safety budget');
  let prefix = 1, slots = 0;
  for (const value of dimensions) {
    const size = typeof value === 'number' ? value : value && typeof value.toNumber === 'function' ? value.toNumber() : NaN;
    if (!Number.isSafeInteger(size) || size < 0 || size > 10000) throw new RangeError('Matrix dimension exceeds safety budget');
    if (size && prefix > 10000 / size) throw new RangeError('Matrix element budget exceeded');
    prefix *= size;
    slots += prefix;
    if (slots > 20000) throw new RangeError('Matrix allocation budget exceeded');
  }
}
module.exports = matrixBudget;
