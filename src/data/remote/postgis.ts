import type { LatLng } from '@/domain/geo';

/**
 * Lee columnas PostGIS tal como las devuelve la API de Supabase: GeoJSON ({ type, coordinates })
 * o EWKB en hexadecimal ("0101000020E6100000…"). Devuelve [lat, lng] o undefined si no la entiende.
 */
export function parsePoint(v: unknown): LatLng | undefined {
  const pts = parseCoords(v);
  return pts?.[0];
}

export function parseLine(v: unknown): LatLng[] | undefined {
  const pts = parseCoords(v);
  return pts && pts.length > 1 ? pts : undefined;
}

function parseCoords(v: unknown): LatLng[] | undefined {
  if (!v) return undefined;
  if (typeof v === 'object') return fromGeoJson(v as { type?: string; coordinates?: unknown });
  if (typeof v === 'string') {
    const s = v.trim();
    if (s.startsWith('{')) {
      try {
        return fromGeoJson(JSON.parse(s));
      } catch {
        return undefined;
      }
    }
    if (/^[0-9a-fA-F]+$/.test(s)) return fromEwkbHex(s);
  }
  return undefined;
}

function fromGeoJson(g: { type?: string; coordinates?: unknown }): LatLng[] | undefined {
  if (g.type === 'Point' && Array.isArray(g.coordinates)) {
    const [lng, lat] = g.coordinates as number[];
    return [[lat, lng]];
  }
  if (g.type === 'LineString' && Array.isArray(g.coordinates)) {
    return (g.coordinates as number[][]).map(([lng, lat]) => [lat, lng] as LatLng);
  }
  return undefined;
}

/** EWKB: Point (1) y LineString (2), con o sin SRID/Z/M. */
function fromEwkbHex(hex: string): LatLng[] | undefined {
  const bytes = new Uint8Array(hex.match(/../g)!.map((b) => parseInt(b, 16)));
  const view = new DataView(bytes.buffer);
  const le = view.getUint8(0) === 1;
  let off = 1;
  const type = view.getUint32(off, le);
  off += 4;
  const hasZ = (type & 0x80000000) !== 0;
  const hasM = (type & 0x40000000) !== 0;
  if (type & 0x20000000) off += 4; // SRID
  const dims = 2 + (hasZ ? 1 : 0) + (hasM ? 1 : 0);
  const point = (): LatLng => {
    const x = view.getFloat64(off, le);
    const y = view.getFloat64(off + 8, le);
    off += 8 * dims;
    return [y, x];
  };
  const base = type & 0xff;
  if (base === 1) return [point()];
  if (base === 2) {
    const n = view.getUint32(off, le);
    off += 4;
    return Array.from({ length: n }, point);
  }
  return undefined;
}
