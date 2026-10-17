const factory = require('node:vm').runInThisContext(require('./regex-engine.cjs')());
const Engines = { legacy: factory(true), unicode: factory(false) };

// Native String algorithms supply replacement/capture/split semantics. Pattern
// execution always uses the pinned nonbacktracking engine, never a fallback.
class LinearRegex {
  static get [Symbol.species]() { return this; }
  constructor(pattern = '', flags) {
    if (pattern instanceof LinearRegex) {
      flags = flags === undefined ? pattern.flags : flags;
      pattern = pattern.source;
    }
    pattern = String(pattern);
    flags = String(flags === undefined ? '' : flags);
    if (/[^gimsuy]/.test(flags) || new Set(flags).size !== flags.length) throw new SyntaxError('Unsupported or duplicate regex flag');
    if (pattern.length > 2048) throw new RangeError('Regex pattern budget exceeded');
    this.source = pattern || '(?:)';
    this.flags = 'gimsuy'.split('').filter(f => flags.includes(f)).join('');
    this.global = flags.includes('g');
    this.ignoreCase = flags.includes('i');
    this.multiline = flags.includes('m');
    this.dotAll = flags.includes('s');
    this.unicode = flags.includes('u');
    this.sticky = flags.includes('y');
    this.lastIndex = 0;
    const RE2JS = this.unicode ? Engines.unicode : Engines.legacy;
    const options = (this.ignoreCase ? RE2JS.CASE_INSENSITIVE : 0) |
      (this.multiline ? RE2JS.MULTILINE : 0) | (this.dotAll ? RE2JS.DOTALL : 0);
    // Validate JavaScript grammar without executing the native pattern. The
    // bounded engine then rejects unsupported lookaround and backreferences.
    new RegExp(pattern, flags);
    let translated = '', inClass = false;
    const whitespace = '\\t\\n\\v\\f\\r \\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff';
    for (let i = 0; i < pattern.length; i++) {
      let ch = pattern[i];
      if (ch === '\\' && i + 1 < pattern.length) {
        const next = pattern[++i];
        if (next === 's') translated += inClass ? whitespace : '[' + whitespace + ']';
        else if (next === 'S' && !inClass) translated += '[^' + whitespace + ']';
        else if (next === 'S' && inClass) throw new SyntaxError('Unsupported complemented whitespace inside character class');
        else if (!this.unicode && next === 'u' && pattern[i + 1] === '{') throw new SyntaxError('Unsupported legacy Unicode escape');
        else if (!'dDwWbBfnrtv0xu\\/.*+?()[]{}|^$-'.includes(next)) throw new SyntaxError('Unsupported regex escape');
        else translated += '\\' + next;
      } else {
        if (ch === '[') inClass = true;
        if (ch === ']') inClass = false;
        if (ch === '.' && !inClass && !this.dotAll) translated += '[^\\n\\r\\u2028\\u2029]';
        else if (!this.unicode && ch.charCodeAt(0) >= 0xd800 && ch.charCodeAt(0) <= 0xdfff) translated += '\\u' + ch.charCodeAt(0).toString(16);
        else translated += ch;
      }
    }
    this.program = RE2JS.compile(RE2JS.translateRegExp(translated), options);
    if (this.program.programSize() > 10000 || this.program.groupCount() > 64) throw new RangeError('Regex program budget exceeded');
    this.matchCount = 0;
  }
  exec(value) {
    const input = String(value);
    if (input.length > 1024 * 1024 || this.program.programSize() * Math.max(1, input.length) > 64 * 1024 * 1024) throw new RangeError('Regex input/work budget exceeded');
    let start = this.global || this.sticky ? Math.max(0, Math.floor(Number(this.lastIndex) || 0)) : 0;
    if (start > input.length) { this.lastIndex = 0; return null; }
    if (!this.matcher || this.input !== input) { this.matcher = this.program.matcher(input); this.input = input; }
    const matcher = this.matcher;
    const found = matcher.find(start);
    if (!found || (this.sticky && matcher.start() !== start)) { if (this.global || this.sticky) this.lastIndex = 0; return null; }
    if (++this.matchCount > 10000) throw new RangeError('Regex match budget exceeded');
    const result = [];
    for (let i = 0; i <= matcher.groupCount(); i++) result.push(matcher.group(i) ?? undefined);
    result.index = matcher.start();
    result.input = input;
    const names = this.program.namedGroups();
    result.groups = Object.keys(names).length ? Object.fromEntries(Object.entries(names).map(([name, i]) => [name, result[i]])) : undefined;
    if (this.global || this.sticky) this.lastIndex = matcher.end();
    return result;
  }
  test(input) { this.matchCount = 0; return this.exec(input) !== null; }
  [Symbol.match](input) { this.matchCount = 0; return RegExp.prototype[Symbol.match].call(this, String(input)); }
  [Symbol.split](value, limit) {
    const input = String(value), maximum = limit === undefined ? 0xffffffff : Number(limit) >>> 0;
    if (!maximum) return [];
    if (input.length > 1024 * 1024 || this.program.programSize() * Math.max(1, input.length) > 64 * 1024 * 1024) throw new RangeError('Regex input/work budget exceeded');
    const matcher = this.program.matcher(input), result = [];
    if (!input.length) return matcher.find() ? [] : [''];
    let previous = 0, cursor = 0, matches = 0;
    while (cursor < input.length && matcher.find(cursor)) {
      const start = matcher.start(), end = matcher.end();
      if (start >= input.length) break;
      if (++matches > 10000) throw new RangeError('Regex split budget exceeded');
      if (end === previous) {
        cursor += this.unicode && input.codePointAt(cursor) > 0xffff ? 2 : 1;
        continue;
      }
      result.push(input.slice(previous, start));
      if (result.length >= maximum) return result;
      for (let i = 1; i <= matcher.groupCount(); i++) {
        result.push(matcher.group(i) ?? undefined);
        if (result.length >= maximum) return result;
      }
      previous = end;
      cursor = previous;
    }
    result.push(input.slice(previous));
    return result;
  }
  [Symbol.search](input) { this.matchCount = 0; return RegExp.prototype[Symbol.search].call(this, String(input)); }
  [Symbol.replace](input, replacement) {
    input = String(input);
    this.matchCount = 0;
    let produced = input.length;
    return RegExp.prototype[Symbol.replace].call(this, input, (...args) => {
      let value;
      if (typeof replacement === 'function') value = String(replacement(...args));
      else {
        const named = typeof args.at(-1) === 'object' ? args.at(-1) : undefined;
        const positionIndex = args.length - (named ? 3 : 2);
        const position = args[positionIndex], captures = args.slice(1, positionIndex);
        value = String(replacement).replace(/\$(\$|&|`|'|<[^>]*>|[0-9]{1,2})/g, (literal, token) => {
          if (token === '$') return '$';
          if (token === '&') return args[0];
          if (token === '`') return input.slice(0, position);
          if (token === "'") return input.slice(position + args[0].length);
          if (token[0] === '<') return named ? String(named[token.slice(1, -1)] ?? '') : literal;
          let index = Number(token);
          if (index > 0 && index <= captures.length) return captures[index - 1] ?? '';
          index = Number(token[0]);
          return token.length === 2 && index > 0 && index <= captures.length ? (captures[index - 1] ?? '') + token[1] : literal;
        });
      }
      produced += value.length;
      if (produced > 16 * 1024 * 1024) throw new RangeError('Regex replacement output budget exceeded');
      return value;
    });
  }
  toString() { return '/' + this.source + '/' + this.flags; }
}
module.exports = LinearRegex;
