const cleanUri = (value) => {
  if (!value) return '';
  const uri =
    typeof value === 'string'
      ? value.trim()
      : value?.media_url || value?.url || value?.image_url || '';
  if (!uri || /example\.com|placeholder/i.test(uri)) return '';
  return String(uri).trim();
};

const mediaUri = (raw) =>
  cleanUri(raw) ||
  cleanUri(raw?.image) ||
  cleanUri(raw?.image_url) ||
  cleanUri(raw?.media_url) ||
  cleanUri(raw?.banner_image) ||
  cleanUri(raw?.cover_image);

/** Split long text into highlight-style bullet lines when possible. */
export const splitHighlightLines = (text) => {
  const value = String(text || '').trim();
  if (!value) return [];

  const byBreak = value
    .split(/\n+|•|●|◆|■|\u2022/)
    .map((s) => s.replace(/^[-–—\d.)\s]+/, '').trim())
    .filter(Boolean);

  if (byBreak.length > 1) return byBreak.slice(0, 8);

  const bySentence = value
    .split(/[.!?]+\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);

  if (bySentence.length > 1) return bySentence.slice(0, 6);
  return [value];
};

/** Normalize A+ / rich product marketing content from varied API shapes. */
export const extractAPlusBlocks = (product) => {
  if (!product) return [];
  const blocks = [];

  const pushBlock = (raw, index) => {
    if (!raw) return;
    if (typeof raw === 'string') {
      const uri = cleanUri(raw);
      if (uri) {
        blocks.push({ id: `aplus-img-${index}`, imageUri: uri });
        return;
      }
      const text = raw.trim();
      if (text) blocks.push({ id: `aplus-text-${index}`, body: text });
      return;
    }

    const imageUri = mediaUri(raw);
    const title = String(raw?.title || raw?.heading || raw?.name || '').trim();
    const body = String(
      raw?.description || raw?.body || raw?.content || raw?.text || raw?.html || '',
    ).trim();
    if (!imageUri && !title && !body) return;
    blocks.push({
      id: String(raw?.id ?? `aplus-${index}`),
      title: title || undefined,
      body: body || undefined,
      imageUri: imageUri || undefined,
    });
  };

  const candidates = [
    product?.a_plus_content,
    product?.a_plus,
    product?.aplus_content,
    product?.rich_content,
    product?.enhanced_content,
    product?.marketing_content,
  ];

  candidates.forEach((candidate) => {
    if (!candidate) return;
    if (Array.isArray(candidate)) {
      candidate.forEach(pushBlock);
      return;
    }
    if (Array.isArray(candidate?.blocks)) {
      candidate.blocks.forEach(pushBlock);
      return;
    }
    if (Array.isArray(candidate?.sections)) {
      candidate.sections.forEach(pushBlock);
      return;
    }
    if (Array.isArray(candidate?.images)) candidate.images.forEach(pushBlock);
    if (typeof candidate === 'object') pushBlock(candidate, blocks.length);
  });

  const seen = new Set();
  return blocks.filter((block) => {
    const key = `${block.imageUri || ''}|${block.title || ''}|${block.body || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
