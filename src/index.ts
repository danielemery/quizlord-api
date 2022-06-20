import { ApolloServer, gql } from "apollo-server";
import { GraphQLScalarType, Kind } from "graphql";
import { Quiz, QuizType } from "./models";
import { persistence } from "./persistence";

const typeDefs = gql`
  scalar Date

  enum QuizType {
    SHARK
    BRAINWAVES
  }

  enum QuizState {
    PENDING_UPLOAD
    READY
  }

  type PageInfo {
    hasPreviousPage: Boolean
    hasNextPage: Boolean
    startCursor: String
    endCursor: String
  }

  type Quiz {
    type: QuizType!
    state: QuizState!
    date: Date!
    imageLink: String
  }

  type QuizEdge {
    node: Quiz
    cursor: String
  }

  type QuizConnection {
    edges: [QuizEdge]!
    pageInfo: PageInfo!
  }

  type CreateQuizResult {
    quiz: Quiz!
    uploadLink: String!
  }

  type Query {
    quizzes(first: Int, after: String): QuizConnection
  }

  type Mutation {
    createQuiz(type: QuizType!, date: Date!): CreateQuizResult
  }
`;

const dateScalar = new GraphQLScalarType({
  name: "Date",
  description: "Date custom scalar type",
  serialize(value) {
    return (value as Date).toISOString();
  },
  parseValue(value) {
    return new Date(value as string); // Convert incoming ISO string to Date
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) {
      return new Date(ast.value);
    }
    return null; // Invalid hard-coded value (not an integer)
  },
});

const resolvers = {
  Date: dateScalar,
  Query: {
    quizzes: async (first: number, after: string) => {
      const data = await persistence.getQuizzes();
      const result = {
        edges: data.map((quiz) => ({
          node: quiz,
          cursor: "asdfsadfg",
        })),
        pageInfo: {
          hasNextPage: false,
          hasPreviousPage: false,
          startCursor: "sdfhjkhsdf",
        },
      };
      return result;
    },
  },
  Mutation: {
    createQuiz: async (
      _: any,
      { type, date }: { type: QuizType; date: Date }
    ): Promise<{ quiz: Quiz; uploadLink: string }> => {
      // Create quiz
      const created = await persistence.createQuiz({
        date,
        type,
        state: "PENDING_UPLOAD",
        imageLink: undefined,
      });
      // Generate file upload url
      return {
        quiz: created,
        uploadLink: "this_will_be_an_s3_upload_link",
      };
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
