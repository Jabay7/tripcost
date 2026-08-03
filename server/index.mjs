/**
 * TripCost extraction server.
 *
 * The one component that holds an Anthropic API key. A phone app cannot: its
 * bundle ships to devices and can be unpacked, so anything embedded in it is
 * public. The app sends document bytes here; this process calls Claude and
 * returns structured JSON.
 *
 * Run it:
 *   export ANTHROPIC_API_KEY=sk-ant-...
 *   node server/index.mjs
 *
 * Then point the app at it (use your machine's LAN IP so a phone can reach it):
 *   EXPO_PUBLIC_API_BASE=http://192.168.1.20:8787 npm start
 */
import Anthropic from '@anthropic-ai/sdk';
import { createServer } from 'node:http';

const PORT = Number(process.env.PORT ?? 8787);

/** Anthropic caps a request at 32 MB; stay well under it. */
const MAX_BYTES = 12 * 1024 * 1024;

const ALLOWED_MEDIA = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
]);

const client = new Anthropic(); // Reads ANTHROPIC_API_KEY from the environment.

/**
 * The shape Claude must return.
 *
 * Structured outputs constrain generation to this schema, so the response
 * parses every time — no regex over prose, no "sometimes it wraps the JSON in
 * a code fence". Every object sets additionalProperties:false and lists every
 * key in `required`, which the API requires; fields that may genuinely be
 * absent are typed as nullable rather than omitted.
 */
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'confidence', 'summary', 'expense', 'load', 'warnings'],
  properties: {
    kind: {
      type: 'string',
      enum: ['expense', 'fuel', 'scale', 'load', 'unknown'],
      description:
        'expense = money already spent (invoice, tow bill, repair order, lumper receipt). ' +
        'fuel = a fuel receipt showing gallons. scale = a CAT scale weight ticket. ' +
        'load = a bill of lading, rate confirmation or load tender describing freight not yet hauled. ' +
        'unknown = anything else, or unreadable.',
    },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    summary: {
      type: 'string',
      description: 'One short line a driver can read to confirm the right document was captured.',
    },
    expense: {
      type: ['object', 'null'],
      additionalProperties: false,
      required: [
        'vendor', 'date', 'total', 'category', 'invoiceNumber',
        'lineItems', 'gallons', 'pricePerGallon', 'looksReimbursable',
      ],
      properties: {
        vendor: { type: 'string' },
        date: {
          type: 'string',
          description: 'ISO-8601 date from the document, or an empty string if none is shown.',
        },
        total: { type: 'number', description: 'Grand total actually charged.' },
        category: {
          type: 'string',
          enum: [
            'tow', 'tire', 'breakdown', 'roadside', 'fine', 'lodging',
            'permit', 'fuel', 'labor', 'claim', 'other',
          ],
        },
        invoiceNumber: { type: 'string' },
        lineItems: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['description', 'amount'],
            properties: {
              description: { type: 'string' },
              amount: { type: 'number' },
            },
          },
        },
        gallons: { type: ['number', 'null'] },
        pricePerGallon: { type: ['number', 'null'] },
        looksReimbursable: {
          type: 'boolean',
          description:
            'True only when the document itself indicates a broker or shipper reimburses it — ' +
            'lumper receipts and detention invoices typically do. Do not guess from the vendor name.',
        },
      },
    },
    load: {
      type: ['object', 'null'],
      additionalProperties: false,
      required: [
        'originCity', 'originState', 'destinationCity', 'destinationState',
        'rate', 'rateMode', 'weightLbs', 'commodity', 'equipment',
        'pickupBy', 'deliverBy', 'referenceNumber', 'hazmat', 'broker',
      ],
      properties: {
        originCity: { type: 'string' },
        originState: { type: 'string', description: 'Two-letter USPS abbreviation.' },
        destinationCity: { type: 'string' },
        destinationState: { type: 'string', description: 'Two-letter USPS abbreviation.' },
        rate: {
          type: ['number', 'null'],
          description: 'Linehaul rate if stated. Rate confirmations state one; plain BOLs do not.',
        },
        rateMode: { type: ['string', 'null'], enum: ['flat', 'per-mile', null] },
        weightLbs: { type: ['number', 'null'] },
        commodity: { type: 'string' },
        equipment: {
          type: ['string', 'null'],
          enum: ['dry-van', 'reefer', 'flatbed', 'tanker', 'hopper', null],
        },
        pickupBy: { type: 'string', description: 'ISO-8601 timestamp, or empty string.' },
        deliverBy: { type: 'string', description: 'ISO-8601 timestamp, or empty string.' },
        referenceNumber: {
          type: 'string',
          description: 'BOL number, PO number or load number — whichever the document carries.',
        },
        hazmat: {
          type: ['string', 'null'],
          enum: [
            '1-explosives', '2-gases', '3-flammable-liquid', '4-flammable-solid',
            '5-oxidizer', '6-toxic', '7-radioactive', '8-corrosive', '9-misc', null,
          ],
        },
        broker: { type: 'string' },
      },
    },
    warnings: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Anything unreadable, ambiguous, or worth a second look before this is written to the books.',
    },
  },
};

const SYSTEM = `You read trucking paperwork and return structured data.

Documents you will see: tow invoices, roadside repair orders, tire bills, fuel
receipts, lumper receipts, scale tickets, citations, motel folios, bills of
lading, rate confirmations, and load tenders.

Rules:

- Report only what the document actually shows. If a field is not on the page,
  return an empty string or null. Never infer a plausible value, and never carry
  a number over from a different line because it looks about right.
- The total is the amount actually charged after taxes, fees and discounts — not
  a subtotal, not an estimate, not a quoted range.
- Distinguish money already spent from freight not yet hauled. An invoice or
  receipt is "expense" (or "fuel"/"scale" where those fit). A bill of lading,
  rate confirmation or load tender is "load" — it describes work ahead, and its
  dollar figure is revenue, not cost.
- Put every doubt in warnings: a smudged digit, a total that does not match the
  line items, two candidate dates, a handwritten amendment. A driver will read
  these before anything is saved, so be specific about what to check.
- Set confidence honestly. A crisp printed invoice is high. A phone photo at an
  angle in poor light with one unclear digit is low, even if you have a guess.
- If the image is not trucking paperwork at all, return kind "unknown" and say
  so in the summary rather than forcing a match.`;

// ---------------------------------------------------------------------------

function send(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BYTES) {
        reject(new Error('Document too large. Keep uploads under 12 MB.'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function extract({ base64, mediaType, filename }) {
  // PDFs go in a document block; images in an image block. Same request shape
  // otherwise — the model reads both.
  const source = { type: 'base64', media_type: mediaType, data: base64 };
  const fileBlock =
    mediaType === 'application/pdf'
      ? { type: 'document', source }
      : { type: 'image', source };

  const response = await client.messages.create({
    model: 'claude-opus-5',
    max_tokens: 16000,
    system: SYSTEM,
    output_config: {
      format: { type: 'json_schema', schema: SCHEMA },
    },
    messages: [
      {
        role: 'user',
        content: [
          fileBlock,
          {
            type: 'text',
            text:
              `Extract this document${filename ? ` (${filename})` : ''}. ` +
              'Return only what is legible on the page.',
          },
        ],
      },
    ],
  });

  if (response.stop_reason === 'refusal') {
    throw new Error('The request was declined. Try a different document.');
  }
  if (response.stop_reason === 'max_tokens') {
    throw new Error('The document was too long to read in one pass. Try a single page.');
  }

  const text = response.content.find((b) => b.type === 'text')?.text;
  if (!text) throw new Error('No content returned from the model.');

  const parsed = JSON.parse(text);

  // Guard the one thing that would corrupt the books: a total that is not a
  // usable number. Everything else is the driver's to review.
  if (parsed.expense && !Number.isFinite(parsed.expense.total)) {
    parsed.expense.total = 0;
    parsed.warnings = [
      ...(parsed.warnings ?? []),
      'The total could not be read as a number. Enter it by hand before saving.',
    ];
    parsed.confidence = 'low';
  }

  return parsed;
}

// ---------------------------------------------------------------------------

const server = createServer(async (req, res) => {
  // The app is served from a device, not a browser origin, but a permissive
  // CORS header keeps the Expo web target working during development.
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-headers', 'content-type');
  res.setHeader('access-control-allow-methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    send(res, 200, { ok: true, model: 'claude-opus-5' });
    return;
  }

  if (req.method !== 'POST' || req.url !== '/extract') {
    send(res, 404, { error: 'Not found. POST /extract or GET /health.' });
    return;
  }

  try {
    const raw = await readBody(req);
    const body = JSON.parse(raw);

    if (typeof body.base64 !== 'string' || body.base64.length === 0) {
      send(res, 400, { error: 'Missing base64 document bytes.' });
      return;
    }
    if (!ALLOWED_MEDIA.has(body.mediaType)) {
      send(res, 400, {
        error: `Unsupported type ${body.mediaType}. Send a JPEG, PNG, GIF, WebP or PDF.`,
      });
      return;
    }

    const result = await extract(body);
    send(res, 200, result);
  } catch (err) {
    const status =
      err?.status === 401 ? 401
      : err?.status === 429 ? 429
      : err instanceof SyntaxError ? 400
      : 500;
    console.error('[extract]', err?.message ?? err);
    send(res, status, { error: err?.message ?? 'Extraction failed.' });
  }
});

if (!process.env.ANTHROPIC_API_KEY) {
  console.error(
    'ANTHROPIC_API_KEY is not set. Export it before starting:\n' +
      '  export ANTHROPIC_API_KEY=sk-ant-...',
  );
  process.exit(1);
}

server.listen(PORT, () => {
  console.log(`TripCost extraction server on http://localhost:${PORT}`);
  console.log('Point the app at it with EXPO_PUBLIC_API_BASE=http://<your-lan-ip>:' + PORT);
});
