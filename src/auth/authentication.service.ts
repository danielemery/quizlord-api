import jwt, { JwtHeader, SigningKeyCallback, VerifyOptions } from 'jsonwebtoken';
import jwksClient, { RsaSigningKey } from 'jwks-rsa';

import config from '../config/config';

export class AuthenticationService {
  #client: jwksClient.JwksClient;
  #options: VerifyOptions;

  constructor() {
    this.#client = jwksClient({
      jwksUri: `https://${config.AUTH0_DOMAIN}/.well-known/jwks.json`,
    });
    this.#options = {
      algorithms: ['RS256'],
      audience: config.AUTH0_AUDIENCE,
      issuer: `https://${config.AUTH0_DOMAIN}/`,
    };
  }

  async verifyToken(token: string): Promise<string | jwt.Jwt | jwt.JwtPayload | undefined> {
    const boundGetKey = this.#getKey.bind(this);
    return new Promise((resolve, reject) => {
      jwt.verify(token, boundGetKey, this.#options, function (error, result) {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      });
    });
  }

  #getKey(header: JwtHeader, callback: SigningKeyCallback) {
    this.#client.getSigningKey(header.kid, function (err, key) {
      if (err) {
        console.error('Error loading jwt signing key');
        callback(err);
      } else {
        const signingKey = (key as RsaSigningKey).rsaPublicKey;
        callback(null, signingKey);
      }
    });
  }
}
