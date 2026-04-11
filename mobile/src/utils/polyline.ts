export function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0, lat = 0, lon = 0;
  while (index < encoded.length) {
    let shift = 0, result = 0, byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0; result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lon += result & 1 ? ~(result >> 1) : result >> 1;

    points.push([lat / 1e5, lon / 1e5]);
  }
  return points;
}

export function encodePolyline(coords: [number, number][]): string {
  let encoded = '';
  let prevLat = 0, prevLon = 0;
  for (const [lat, lon] of coords) {
    encoded += encodeVal(Math.round((lat - prevLat) * 1e5));
    encoded += encodeVal(Math.round((lon - prevLon) * 1e5));
    prevLat = lat; prevLon = lon;
  }
  return encoded;
}

function encodeVal(v: number): string {
  v = v < 0 ? ~(v << 1) : v << 1;
  let s = '';
  while (v >= 0x20) { s += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5; }
  s += String.fromCharCode(v + 63);
  return s;
}
