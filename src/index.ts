import { ApolloServer } from "apollo-server";
import { GraphQLScalarType, Kind } from "graphql";
import { subscribeToFileUploads } from "./sqs";
import { verifyToken } from "./auth";
import {
  createQuiz,
  quiz,
  quizzes,
  completeQuiz,
} from "./resolvers/quizResolvers";
import typeDefs from "./gql";
import config from "./config";
import { users } from "./resolvers/userResolvers";

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
    quizzes,
    quiz,
    users,
  },
  Mutation: {
    createQuiz,
    completeQuiz,
  },
};

export interface QuizlordContext {
  email: string;
}

async function initialise() {
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    csrfPrevention: true,
    cors: {
      origin: [config.CLIENT_URL, "https://studio.apollographql.com"],
      credentials: true,
    },
    context: async ({ req }) => {
      const token = req.headers.authorization || "";

      const sanitisedToken = token.replace("Bearer ", "");

      const jwt = await verifyToken(sanitisedToken);

      const context: QuizlordContext = {
        email: (jwt as any)[`${config.CLIENT_URL}/email`] as string,
      };

      return context;
    },
  });

  subscribeToFileUploads();
  server.listen().then(({ url }) => {
    console.log(`🚀  Server ready at ${url}`);
  });
}

initialise()
  .then(() => {
    console.log("Server initialised sucessfully.");
  })
  .catch((err) => {
    console.error("Server encountered error initialising and had to shut down");
    console.error(err);
    process.exit(1);
  });
