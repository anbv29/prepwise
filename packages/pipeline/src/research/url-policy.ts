import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

export interface ResolvedAddress {
  address: string;
  family: 4 | 6;
}

export type HostResolver = (hostname: string) => Promise<readonly ResolvedAddress[]>;

export interface UrlPolicyOptions {
  allowPrivateNetworks?: boolean;
  resolveHost?: HostResolver;
}

export class UnsafeResearchUrlError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'UnsafeResearchUrlError';
    this.code = code;
  }
}

const blockedAddresses = new BlockList();

for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  blockedAddresses.addSubnet(network, prefix, 'ipv4');
}

for (const [network, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
  ['2001:db8::', 32],
] as const) {
  blockedAddresses.addSubnet(network, prefix, 'ipv6');
}

function normalizedHostname(hostname: string) {
  return hostname
    .replace(/^\[|\]$/gu, '')
    .replace(/\.$/u, '')
    .toLowerCase();
}

function isBlockedAddress(address: string, family: 4 | 6) {
  if (family === 6 && address.toLowerCase().startsWith('::ffff:')) {
    const mappedIpv4 = address.slice('::ffff:'.length);
    return isIP(mappedIpv4) === 4 && blockedAddresses.check(mappedIpv4, 'ipv4');
  }

  return blockedAddresses.check(address, family === 4 ? 'ipv4' : 'ipv6');
}

const defaultResolver: HostResolver = async (hostname) => {
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  return addresses
    .filter(({ family }) => family === 4 || family === 6)
    .map(({ address, family }) => ({ address, family: family as 4 | 6 }));
};

export async function resolveResearchHost(
  rawHostname: string,
  options: UrlPolicyOptions = {},
): Promise<readonly ResolvedAddress[]> {
  const hostname = normalizedHostname(rawHostname);
  const ipFamily = isIP(hostname);
  let addresses: readonly ResolvedAddress[];

  if (ipFamily === 4 || ipFamily === 6) {
    addresses = [{ address: hostname, family: ipFamily }];
  } else {
    try {
      addresses = await (options.resolveHost ?? defaultResolver)(hostname);
    } catch {
      throw new UnsafeResearchUrlError(
        'HOST_RESOLUTION_FAILED',
        'The research hostname could not be resolved.',
      );
    }
  }

  if (addresses.length === 0) {
    throw new UnsafeResearchUrlError(
      'HOST_RESOLUTION_FAILED',
      'The research hostname did not resolve to an address.',
    );
  }

  if (
    !options.allowPrivateNetworks &&
    addresses.some(({ address, family }) => isBlockedAddress(address, family))
  ) {
    throw new UnsafeResearchUrlError(
      'PRIVATE_NETWORK_ADDRESS',
      'The research hostname resolves to a private or reserved address.',
    );
  }

  return addresses;
}

export async function validateResearchUrl(
  rawUrl: string,
  options: UrlPolicyOptions = {},
): Promise<URL> {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeResearchUrlError('INVALID_URL', 'Research URL is not a valid absolute URL.');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new UnsafeResearchUrlError(
      'UNSUPPORTED_PROTOCOL',
      'Research URLs must use HTTP or HTTPS.',
    );
  }

  if (url.username || url.password) {
    throw new UnsafeResearchUrlError(
      'URL_CREDENTIALS_NOT_ALLOWED',
      'Research URLs cannot contain credentials.',
    );
  }

  if (url.port && !options.allowPrivateNetworks) {
    throw new UnsafeResearchUrlError(
      'NON_STANDARD_PORT',
      'Research URLs cannot use non-standard ports.',
    );
  }

  const hostname = normalizedHostname(url.hostname);

  if (
    !hostname ||
    (!options.allowPrivateNetworks && (hostname === 'localhost' || hostname.endsWith('.localhost')))
  ) {
    throw new UnsafeResearchUrlError('LOCAL_HOSTNAME', 'Local hostnames cannot be researched.');
  }

  await resolveResearchHost(hostname, options);

  url.hash = '';
  return url;
}
