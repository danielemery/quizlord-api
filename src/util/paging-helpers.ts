export function base64Encode(source: string) {
  return Buffer.from(source).toString('base64');
}

export function base64Decode(source: string) {
  return Buffer.from(source, 'base64').toString('ascii');
}

export interface PagedResult<T> {
  edges: {
    cursor: string;
    node: T;
  }[];
  pageInfo: {
    hasNextPage: boolean;
    startCursor?: string;
    endCursor?: string;
  };
}

export function getPagedQuery(limit: number, after?: string) {
  return {
    take: limit + (after === undefined ? 1 : 2),
    ...(after && {
      cursor: {
        id: after,
      },
    }),
  };
}

export function slicePagedResults<T>(
  results: T[],
  limit: number,
  isUsingCursor: boolean,
): { data: T[]; hasMoreRows: boolean } {
  if (isUsingCursor) {
    if (results.length === limit + 2) {
      return {
        data: results.slice(1, limit + 1),
        hasMoreRows: true,
      };
    } else if (results.length > 1) {
      return {
        data: results.slice(1),
        hasMoreRows: false,
      };
    } else {
      return {
        data: [],
        hasMoreRows: false,
      };
    }
  }

  if (results.length === limit + 1) {
    return {
      data: results.slice(0, limit),
      hasMoreRows: true,
    };
  } else {
    return {
      data: results,
      hasMoreRows: false,
    };
  }
}
