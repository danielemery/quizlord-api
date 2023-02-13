import jwt, { JwtHeader, SigningKeyCallback, VerifyOptions } from 'jsonwebtoken';
import jwksClient, { RsaSigningKey } from 'jwks-rsa';

import config from './config';

const client = jwksClient({
  jwksUri: `https://${config.AUTH0_DOMAIN}/.well-known/jwks.json`,
});

function getKey(header: JwtHeader, callback: SigningKeyCallback) {
  client.getSigningKey(header.kid, function (err, key) {
    if (err) {
      console.error('Error loading jwt signing key');
      callback(err);
    } else {
      const signingKey = (key as RsaSigningKey).rsaPublicKey;
      callback(null, signingKey);
    }
  });
}

const options: VerifyOptions = {
  algorithms: ['RS256'],
  audience: config.AUTH0_AUDIENCE,
  issuer: `https://${config.AUTH0_DOMAIN}/`,
};

export async function verifyToken(token: string): Promise<string | jwt.Jwt | jwt.JwtPayload | undefined> {
  return new Promise((resolve, reject) => {
    jwt.verify(token, getKey, options, function (error, result) {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
}
