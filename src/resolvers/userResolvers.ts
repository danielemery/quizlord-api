import axios from 'axios';
// import { QuizlordContext } from '..';
import config from '../config';
import { User } from '../models';
import { MemoryCache } from './cache';
import { PagedResultWithoutNode } from './helpers';

const userResolverCache = new MemoryCache();
// function mockResult() {
//   return Promise.resolve({
//     data: {
//       access_token: "FROM_AUTH_0",
//       scope: "read:users",
//       expires_in: 86400,
//       token_type: "Bearer",
//     },
//   });
// }

const AUTH0_USER_CACHE_KEY = 'AUTH0_USER_CACHE';

export async function users(
  _: unknown,
  { first = 100, after }: { first: number; after?: string },
): // context: QuizlordContext,
Promise<PagedResultWithoutNode<User>> {
  let token = await userResolverCache.getItem(AUTH0_USER_CACHE_KEY);
  if (!token) {
    console.log('Refreshing auth token');
    const response = await axios.post(
      `https://${config.AUTH0_DOMAIN}/oauth/token`,
      {
        client_id: config.AUTH0_MANAGEMENT_CLIENT_ID,
        client_secret: config.AUTH0_MANAGEMENT_CLIENT_SECRET,
        audience: `https://${config.AUTH0_DOMAIN}/api/v2/`,
        grant_type: 'client_credentials',
      },
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );
    // rol_sqsNfIGENpvx4530
    // const response = await mockResult();
    const { data } = response;
    token = data.access_token;
    userResolverCache.setItem(AUTH0_USER_CACHE_KEY, data.access_token, data.expires_in);
    console.log('Auth token refreshed successfully');
  } else {
    console.log('Using existing auth token');
  }

  try {
    const query = `take=${first}${after ? `&from=${after}` : ''}`;
    const users = await axios.get(
      `https://${config.AUTH0_DOMAIN}/api/v2/roles/${config.AUTH0_USER_ROLE_ID}/users?${query}`,
      {
        headers: {
          authorization: `Bearer ${token}`,
        },
      },
    );

    const userData: { users: UserData[]; next?: string } = users.data;
    const hasNextPage = !!userData.next;

    return {
      edges: userData.users,
      pageInfo: {
        hasNextPage,
        startCursor: after,
        endCursor: userData.next,
      },
    };
  } catch (err) {
    console.error(err);
    throw new Error('Unable to query auth0 for user list');
  }
}

interface UserData {
  email: string;
}
