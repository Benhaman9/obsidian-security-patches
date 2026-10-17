// Reconstruct approved inert HTML/SVG; never adopt nodes from imported markup.
function safeSetInnerHTML(el, html) {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const tags = new Set('div span p br strong b em i code pre a ul ol li table thead tbody tfoot tr td th caption svg g path circle ellipse rect line polyline polygon defs clippath mask lineargradient radialgradient stop title desc use'.split(' '));
  const attrs = new Set('class id title role aria-label aria-hidden width height viewbox fill stroke stroke-width stroke-linecap stroke-linejoin stroke-dasharray fill-rule clip-rule opacity fill-opacity stroke-opacity d x y x1 y1 x2 y2 cx cy r rx ry points transform preserveaspectratio colspan rowspan scope offset gradientunits gradienttransform stop-color stop-opacity clip-path mask'.split(' '));
  const svgNS = 'http://www.w3.org/2000/svg';
  function copy(node, svg) {
    if (node.nodeType === 3) return el.ownerDocument.createTextNode(node.textContent || '');
    if (node.nodeType !== 1) return null;
    const tag = node.localName.toLowerCase();
    if (!tags.has(tag)) return null;
    svg = svg || tag === 'svg';
    const clean = svg ? el.ownerDocument.createElementNS(svgNS, node.localName) : el.ownerDocument.createElement(tag);
    for (const attr of Array.from(node.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value;
      if (name === 'style') {
        // Preserve local color picker styling, never resource URLs or legacy code.
        for (const property of Array.from(node.style)) {
          if (!/^(color|fill|stroke|stroke-width|background-color|width|height|min-width|max-width|margin(-[a-z]+)?|padding(-[a-z]+)?|border(-[a-z]+)?|display|text-align|font(-[a-z]+)?|vertical-align|opacity)$/.test(property)) continue;
          const v = node.style.getPropertyValue(property);
          if (!/url\s*\(|expression\s*\(|[<>@\\]/i.test(v)) clean.style.setProperty(property, v);
        }
      } else if (name === 'href' || name === 'xlink:href') {
        if (svg ? /^#[a-z0-9_-]+$/i.test(value) : /^(https?:\/\/|mailto:|#[a-z0-9_-]+$)/i.test(value)) {
          clean.setAttribute(svg ? 'href' : name, value);
          if (!svg) clean.setAttribute('rel', 'noopener noreferrer');
        }
      } else if (attrs.has(name) && !/url\s*\(/i.test(value)) {
        clean.setAttribute(attr.name, value);
      } else if (attrs.has(name) && /^url\(#[a-z0-9_-]+\)$/i.test(value)) {
        clean.setAttribute(attr.name, value);
      }
    }
    for (const child of Array.from(node.childNodes)) {
      const next = copy(child, svg);
      if (next) clean.appendChild(next);
    }
    return clean;
  }
  el.textContent = '';
  for (const child of Array.from(parsed.body.childNodes)) {
    const clean = copy(child, false);
    if (clean) el.appendChild(clean);
  }
}
module.exports = safeSetInnerHTML;
