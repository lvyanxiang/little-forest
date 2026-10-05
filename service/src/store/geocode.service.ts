import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type GeocodeFailReason = 'no_key' | 'not_found' | 'request_failed' | 'quota';

export type GeocodeResult =
  | { ok: true; latitude: number; longitude: number }
  | { ok: false; reason: GeocodeFailReason };

export type ReverseGeocodeResult =
  | { ok: true; address: string }
  | { ok: false; reason: GeocodeFailReason };

function failReason(message?: string, status?: number): GeocodeFailReason {
  const text = message || '';
  if (text.includes('上限') || text.includes('配额') || status === 121) {
    return 'quota';
  }
  return 'not_found';
}

type TencentGeocodeResponse = {
  status: number;
  message?: string;
  result?: {
    address?: string;
    formatted_addresses?: {
      recommend?: string;
      rough?: string;
    };
    location?: {
      lat: number;
      lng: number;
    };
  };
};

@Injectable()
export class GeocodeService {
  private readonly logger = new Logger(GeocodeService.name);

  constructor(private readonly config: ConfigService) {}

  async fromAddress(address: string): Promise<GeocodeResult> {
    const key = this.config.get<string>('TENCENT_MAP_KEY')?.trim();
    if (!key) return { ok: false, reason: 'no_key' };

    const url = new URL('https://apis.map.qq.com/ws/geocoder/v1/');
    url.searchParams.set('address', address.trim());
    url.searchParams.set('key', key);

    try {
      const res = await fetch(url);
      const data = (await res.json()) as TencentGeocodeResponse;
      const lat = data.result?.location?.lat;
      const lng = data.result?.location?.lng;
      if (data.status !== 0 || typeof lat !== 'number' || typeof lng !== 'number') {
        this.logger.warn(`geocode missed: ${data.message || data.status}`);
        return { ok: false, reason: failReason(data.message, data.status) };
      }
      return { ok: true, latitude: lat, longitude: lng };
    } catch (err) {
      this.logger.warn(`geocode request failed: ${err}`);
      return { ok: false, reason: 'request_failed' };
    }
  }

  async fromCoords(latitude: number, longitude: number): Promise<ReverseGeocodeResult> {
    const key = this.config.get<string>('TENCENT_MAP_KEY')?.trim();
    if (!key) return { ok: false, reason: 'no_key' };

    const url = new URL('https://apis.map.qq.com/ws/geocoder/v1/');
    url.searchParams.set('location', `${latitude},${longitude}`);
    url.searchParams.set('key', key);
    url.searchParams.set('get_poi', '0');

    try {
      const res = await fetch(url);
      const data = (await res.json()) as TencentGeocodeResponse;
      const address =
        data.result?.formatted_addresses?.recommend ||
        data.result?.formatted_addresses?.rough ||
        data.result?.address;
      if (data.status !== 0 || !address) {
        this.logger.warn(`reverse geocode missed: ${data.message || data.status}`);
        return { ok: false, reason: failReason(data.message, data.status) };
      }
      return { ok: true, address };
    } catch (err) {
      this.logger.warn(`reverse geocode request failed: ${err}`);
      return { ok: false, reason: 'request_failed' };
    }
  }
}
