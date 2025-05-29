import { loadFilesSync } from '@graphql-tools/load-files';
import { mergeTypeDefs } from '@graphql-tools/merge';
import path from 'path';

// Define the paths to the GraphQL files.
// It's important to load schema.graphql first as it contains base definitions.
const baseSchemaPath = path.join(__dirname, 'schema.graphql');
const domainSchemaPaths = [
  path.join(__dirname, 'activity/activity.graphql'),
  path.join(__dirname, 'quiz/quiz.graphql'),
  path.join(__dirname, 'statistics/statistics.graphql'),
  path.join(__dirname, 'user/user.graphql'),
];

// Load the base schema and domain-specific schemas.
// loadFilesSync returns an array of DocumentNode | string based on the input.
// We'll ensure they are loaded correctly.
const baseTypeDefs = loadFilesSync(baseSchemaPath);
const domainTypeDefs = domainSchemaPaths.flatMap(p => loadFilesSync(p));

// Merge the type definitions.
// mergeTypeDefs can take an array of sources (DocumentNode, strings, etc.).
const typeDefs = mergeTypeDefs([...baseTypeDefs, ...domainTypeDefs]);

// The 'typeDefs' is likely a DocumentNode, which is generally what Apollo Server expects.
// If it were a string, and the rest of the application expected a gql tag,
// we would do:
// import gql from 'graphql-tag';
// export default gql(typeDefs);
// However, mergeTypeDefs usually produces a DocumentNode.

export default typeDefs;
