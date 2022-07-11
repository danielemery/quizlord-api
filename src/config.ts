import Joi from 'joi';

interface QuizlordConfig {
  NODE_ENV: string;
  CLIENT_URL: string;
  DB_CONNECTION_STRING: string;
  AUTH0_AUDIENCE: string;
  AUTH0_DOMAIN: string;
  AUTH0_MANAGEMENT_CLIENT_ID: string;
  AUTH0_MANAGEMENT_CLIENT_SECRET: string;
  AUTH0_USER_ROLE_ID: string;
  AUTH0_ADMIN_ROLE_ID: string;
  AWS_REGION: string;
  AWS_BUCKET_NAME: string;
  AWS_FILE_UPLOADED_SQS_QUEUE_URL: string;
  FILE_ACCESS_BASE_URL: string;
}

const schema = Joi.object<QuizlordConfig>()
  .keys({
    NODE_ENV: Joi.string().default('development'),
    CLIENT_URL: Joi.string().required(),
    DB_CONNECTION_STRING: Joi.string().uri().required(),
    AUTH0_DOMAIN: Joi.string().required(),
    AUTH0_AUDIENCE: Joi.string().uri().required(),
    AUTH0_MANAGEMENT_CLIENT_ID: Joi.string().required(),
    AUTH0_MANAGEMENT_CLIENT_SECRET: Joi.string().required(),
    AUTH0_USER_ROLE_ID: Joi.string().required(),
    AUTH0_ADMIN_ROLE_ID: Joi.string().required(),
    AWS_REGION: Joi.string().required(),
    AWS_BUCKET_NAME: Joi.string().required(),
    AWS_FILE_UPLOADED_SQS_QUEUE_URL: Joi.string().required(),
    FILE_ACCESS_BASE_URL: Joi.string().required(),
  })
  .required()
  .unknown(true);

const config = schema.validate(process.env, { stripUnknown: true });

if (config.error || config.value === undefined) {
  if (config.error) {
    console.error(config.error.message);
  } else {
    console.error('Unexpected error parsing environment variables...');
  }
  process.exit(1);
}

export default config.value;
