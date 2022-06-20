import { ApolloServer, gql } from "apollo-server";
import { GraphQLScalarType, Kind } from "graphql";

interface Quiz {
  type: QuizType;
  date: Date;
  imageLink: string;
}

type QuizType = "SHARK" | "BRAINWAVES";

const typeDefs = gql`
  scalar Date

  enum QuizType {
    SHARK
    BRAINWAVES
  }

  # https://relay.dev/graphql/connections.htm#sec-undefined.PageInfo
  type PageInfo {
    hasPreviousPage: Boolean
    hasNextPage: Boolean
    startCursor: String
    endCursor: String
  }

  type Quiz {
    type: QuizType
    date: Date
    imageLink: String
  }

  type QuizEdge {
    node: Quiz
    cursor: String
  }

  type QuizConnection {
    edges: [QuizEdge]
    pageInfo: PageInfo
  }

  type Query {
    quizzes(first: Int, after: String): QuizConnection
  }
`;

const sampleQuizzes: Quiz[] = [
  {
    type: "SHARK",
    date: new Date("2022-06-13"),
    imageLink: "",
  },
];

const dateScalar = new GraphQLScalarType({
  name: "Date",
  description: "Date custom scalar type",
  serialize(value) {
    return (value as Date).getTime(); // Convert outgoing Date to integer for JSON
  },
  parseValue(value) {
    return new Date(value as number); // Convert incoming integer to Date
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.INT) {
      return new Date(parseInt(ast.value, 10)); // Convert hard-coded AST string to integer and then to Date
    }
    return null; // Invalid hard-coded value (not an integer)
  },
});

const resolvers = {
  Date: dateScalar,
  Query: {
    quizzes: (first: number, after: string) => {
      console.log(first, after);
      const result = {
        edges: sampleQuizzes.map((quiz) => ({
          node: quiz,
          cursor: "asdfsadfg",
        })),
        pageInfo: {
          hasNextPage: false,
          hasPreviousPage: false,
          startCursor: "sdfhjkhsdf",
        },
      };
      console.log(result);
      return result;
    },
  },
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
  csrfPrevention: true,
});

server.listen().then(({ url }) => {
  console.log(`🚀  Server ready at ${url}`);
});
