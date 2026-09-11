import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, generators, Issuer } from 'openid-client';
import { PrismaService } from '../../prisma/prisma.service';
import { USS_DOMAIN_REGEX } from '../../common/domain';
import { AuthService } from './auth.service';

export const OAUTH_STATE_COOKIE = 'uss_oauth_state';

const DISCOVERY_TIMEOUT_MS = 10_000;
const DISCOVERY_MAX_RETRIES = 3;
const DISCOVERY_BASE_DELAY_MS = 200;

export interface OAuthVerifierState {
  state: string;
  codeVerifier: string;
  nonce: string;
}

export interface AuthorizationUrlResult {
  url: string;
  verifier: OAuthVerifierState;
}

@Injectable()
export class OAuthService {
  private clientPromise: Promise<Client> | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  private issuerUrl(): string {
    const tenant = this.config.get<string>('MICROSOFT_TENANT_ID');
    return `https://login.microsoftonline.com/${tenant}/v2.0`;
  }

  // Cliente OIDC resuelto por discovery real del tenant (no endpoints a mano).
  // Azure publica rutas /oauth2/v2.0/* que un `new Issuer` hardcodeado en
  // /v2.0/* rompía con 404. El discovery elimina esa clase de bug de raíz.
  private async discoverClient(): Promise<Client> {
    const issuer = await this.withTimeout(
      Issuer.discover(this.issuerUrl()),
      DISCOVERY_TIMEOUT_MS,
    );
    return new issuer.Client({
      client_id: this.config.get<string>('MICROSOFT_CLIENT_ID') ?? '',
      client_secret: this.config.get<string>('MICROSOFT_CLIENT_SECRET'),
      redirect_uris: [this.config.get<string>('MICROSOFT_REDIRECT_URI') ?? ''],
      token_endpoint_auth_method: 'client_secret_post',
      response_types: ['code'],
    });
  }

  // Lazy + self-healing: la API arranca aunque el IdP esté caído y cada uso
  // reintenta si el discovery falló la vez anterior. Solo se cachea el éxito.
  private getClient(): Promise<Client> {
    if (!this.clientPromise) {
      this.clientPromise = this.discoverClientWithRetry().catch((error) => {
        this.clientPromise = null;
        throw error;
      });
    }
    return this.clientPromise;
  }

  private async discoverClientWithRetry(): Promise<Client> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= DISCOVERY_MAX_RETRIES; attempt += 1) {
      try {
        return await this.discoverClient();
      } catch (error) {
        lastError = error;
        if (attempt < DISCOVERY_MAX_RETRIES) {
          await this.sleep(DISCOVERY_BASE_DELAY_MS * 2 ** (attempt - 1));
        }
      }
    }
    throw new ServiceUnavailableException(
      `No se pudo contactar el proveedor OAuth (intentos: ${DISCOVERY_MAX_RETRIES})`,
      { cause: lastError },
    );
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout tras ${ms}ms`)), ms),
      ),
    ]);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async buildAuthorizationUrl(): Promise<AuthorizationUrlResult> {
    const client = await this.getClient();
    const codeVerifier = generators.codeVerifier();
    const codeChallenge = generators.codeChallenge(codeVerifier);
    const state = generators.state();
    const nonce = generators.nonce();

    const url = client.authorizationUrl({
      scope: 'openid profile email',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
      nonce,
      response_mode: 'query',
    });

    return { url, verifier: { state, codeVerifier, nonce } };
  }

  async callback(
    params: Record<string, unknown>,
    verifier: OAuthVerifierState,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const client = await this.getClient();
    const tokenSet = await client.callback(
      this.config.get<string>('MICROSOFT_REDIRECT_URI') ?? '',
      params,
      { state: verifier.state, code_verifier: verifier.codeVerifier, nonce: verifier.nonce },
    );

    const claims = tokenSet.claims();
    const email = String(claims.email ?? claims.preferred_username ?? '');
    if (!email || !USS_DOMAIN_REGEX.test(email)) {
      throw new UnauthorizedException('Email fuera del dominio @uss.cl');
    }

    const outlookId = String(claims.oid ?? claims.sub ?? '');
    const name = String(claims.name ?? email.split('@')[0]);

    const user = await this.prisma.user.upsert({
      where: { email },
      update: { name, outlookId },
      create: { email, name, outlookId, role: 'student' },
    });

    return this.auth.issueTokens(user);
  }
}