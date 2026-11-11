export function verifyInlineCode(html) {
  if (/\son\w+\s*=/i.test(html)) throw new Error('Inline scripts violate the content security policy.');
  for (const [, attributes, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (!body.trim()) continue;
    if (!/\btype\s*=\s*(["'])application\/ld\+json\1/i.test(attributes)) {
      throw new Error('Inline scripts violate the content security policy.');
    }
    JSON.parse(body);
  }
}
