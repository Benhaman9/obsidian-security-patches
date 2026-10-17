function tableRangeBudget(rowStart, rowEnd, columnStart, columnEnd) {
  if (![rowStart, rowEnd, columnStart, columnEnd].every(Number.isSafeInteger)) return new RangeError('Table range indices must be safe integers');
  const rows = Math.abs(rowEnd - rowStart), columns = Math.abs(columnEnd - columnStart);
  if (!Number.isSafeInteger(rows) || !Number.isSafeInteger(columns) || rows > 10000 || columns > 10000 ||
      (columns && rows > 10000 / columns)) return new RangeError('Table formula range budget exceeded');
  return null;
}
module.exports = tableRangeBudget;
