import Joi from "joi";

interface QuizlordConfig {
  CLIENT_URL: string;
  DB_CONNECTION_STRING: string;
  AUTH0_AUDIENCE: string;
  AUTH0_DOMAIN: string;
  AWS_REGION: string;
  AWS_BUCKET_NAME: string;
  AWS_FILE_UPLOADED_SQS_QUEUE_URL: string;
  FILE_ACCESS_BASE_URL: string;
}

const schema = Joi.object<QuizlordConfig>()
  .keys({
    CLIENT_URL: Joi.string().required(),
    DB_CONNECTION_STRING: Joi.string().uri().required(),
    AUTH0_DOMAIN: Joi.string().required(),
    AUTH0_AUDIENCE: Joi.string().uri().required(),
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
    console.error("Unexpected error parsing environment variables...");
  }
  process.exit(1);
}

export default config.value;
