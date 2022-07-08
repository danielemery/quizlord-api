export function base64Encode(source: string) {
  return Buffer.from(source).toString("base64");
}

export function base64Decode(source: string) {
  return Buffer.from(source, "base64").toString("ascii");
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

export interface PagedResultWithoutNode<T> {
  edges: T[];
  pageInfo: {
    hasNextPage: boolean;
    startCursor?: string;
    endCursor?: string;
  };
}
