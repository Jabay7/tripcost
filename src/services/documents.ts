import type { ExtractedDocument } from '../types';

/**
 * Turning a photographed document into a report entry.
 *
 * Two rules shape this file.
 *
 * First: the API key never ships in the app. A mobile bundle is distributed to
 * devices and can be unpacked, so extraction goes through a server proxy that
 * holds the key (see `server/`). The app sends base64 image bytes and gets
 * structured JSON back. There is no code path here that talks to Anthropic
 * directly, and there should not be one.
 *
 * Second: extraction proposes, the driver disposes. Nothing reaches the ledger
 * or the trip until it has been shown on the review screen and confirmed. A
 * model reading a crumpled tow bill at 0200 will sometimes read $1,150 as
 * $1,750, and the fix for that is a human glance, not a better prompt. The
 * review step is one tap, so it costs the driver a second and saves the books.
 */

export type CapturedDocument = {
  /** Base64-encoded file bytes, no data: prefix and no newlines. */
  base64: string;
  /** e.g. 'image/jpeg', 'image/png', 'application/pdf' */
  mediaType: string;
  /** Original filename, when the picker supplied one. */
  filename: string;
};

export interface DocumentExtractor {
  readonly name: string;
  readonly live: boolean;
  extract(doc: CapturedDocument): Promise<ExtractedDocument>;
}

// ---------------------------------------------------------------------------

/**
 * Offline stand-in.
 *
 * Returns a plausible tow bill so the capture → review → apply flow can be
 * built and demonstrated without a server or a key. It deliberately reports
 * `live: false` and carries a warning, so the review screen tells the driver
 * plainly that nothing was actually read off their photo.
 */
export class MockExtractor implements DocumentExtractor {
  readonly name = 'Sample extraction (offline)';
  readonly live = false;

  async extract(doc: CapturedDocument): Promise<ExtractedDocument> {
    // A little variety so the flow doesn't look hard-coded in a demo.
    const isPdf = doc.mediaType === 'application/pdf';

    if (isPdf) {
      return {
        kind: 'load',
        confidence: 'medium',
        summary: 'Rate confirmation — Dallas, TX to Chicago, IL, $2,585 flat',
        expense: null,
        load: {
          originCity: 'Dallas',
          originState: 'TX',
          destinationCity: 'Chicago',
          destinationState: 'IL',
          rate: 2585,
          rateMode: 'flat',
          weightLbs: 42000,
          commodity: 'Palletized dry goods',
          equipment: 'dry-van',
          pickupBy: '',
          deliverBy: '',
          referenceNumber: 'RC-884512',
          hazmat: null,
          broker: 'Sample Logistics LLC',
        },
        warnings: [
          'This is sample data, not a reading of your document. Connect the extraction server to process real paperwork.',
        ],
        provider: this.name,
        live: false,
      };
    }

    return {
      kind: 'expense',
      confidence: 'medium',
      summary: 'Tow invoice — Interstate Towing, $1,150.00',
      expense: {
        vendor: 'Interstate Towing & Recovery',
        date: new Date().toISOString(),
        total: 1150,
        category: 'tow',
        invoiceNumber: 'INV-44821',
        lineItems: [
          { description: 'Heavy-duty hook-up', amount: 450 },
          { description: 'Mileage, 22 mi @ $12/mi', amount: 264 },
          { description: 'Recovery labor, 2 hr', amount: 436 },
        ],
        gallons: null,
        pricePerGallon: null,
        looksReimbursable: false,
      },
      load: null,
      warnings: [
        'This is sample data, not a reading of your document. Connect the extraction server to process real paperwork.',
      ],
      provider: this.name,
      live: false,
    };
  }
}

// ---------------------------------------------------------------------------

/**
 * Live extraction through the server proxy.
 *
 * The proxy exposes one route, `POST /extract`, taking `{base64, mediaType,
 * filename}` and returning an `ExtractedDocument`. It is the only component
 * holding an Anthropic API key. See `server/index.mjs` for the Claude call
 * itself, including the JSON schema the response is constrained to.
 *
 * Point the app at it with EXPO_PUBLIC_API_BASE, e.g.
 *   EXPO_PUBLIC_API_BASE=http://192.168.1.20:8787 npm start
 */
export class ProxyExtractor implements DocumentExtractor {
  readonly name = 'Claude vision via server proxy';
  readonly live = true;

  constructor(private readonly apiBase: string) {}

  async extract(doc: CapturedDocument): Promise<ExtractedDocument> {
    const res = await fetch(`${this.apiBase.replace(/\/$/, '')}/extract`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(doc),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(
        `Extraction failed (${res.status}). ${detail.slice(0, 200) || 'Is the server running?'}`,
      );
    }

    const parsed = (await res.json()) as ExtractedDocument;
    return { ...parsed, provider: this.name, live: true };
  }
}

/**
 * Picks the live extractor when a server address is configured, and the
 * offline sample otherwise. Matches how the rest of the app degrades: it works
 * without any keys, and says so.
 */
export function defaultExtractor(): DocumentExtractor {
  const base = process.env.EXPO_PUBLIC_API_BASE;
  return base ? new ProxyExtractor(base) : new MockExtractor();
}
