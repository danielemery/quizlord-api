import { ApolloServer, gql } from "apollo-server";
import { GraphQLScalarType, Kind } from "graphql";
import { Quiz, QuizType } from "./models";
import { persistence } from "./persistence";
import { v4 as uuidv4 } from "uuid";
import { generateSignedUploadUrl } from "./s3";
import { subscribeToFileUploads } from "./sqs";

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
    createQuiz(
      type: QuizType!
      date: Date!
      fileName: String!
    ): CreateQuizResult
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
      { type, date, fileName }: { type: QuizType; date: Date; fileName: string }
    ): Promise<{ quiz: Quiz; uploadLink: string }> => {
      // Create quiz
      const created = await persistence.createQuiz({
        date,
        type,
        state: "PENDING_UPLOAD",
        imageLink: undefined,
      });
      // Generate file upload url
      const fileId = uuidv4();
      const { uploadLink, fileKey } = await generateSignedUploadUrl(
        fileId,
        fileName
      );
      // Associate the key with redis
      // TODO
      return {
        quiz: created,
        uploadLink,
      };
    },
  },
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
  csrfPrevention: true,
});

subscribeToFileUploads();
server.listen().then(({ url }) => {
  console.log(`🚀  Server ready at ${url}`);
});
