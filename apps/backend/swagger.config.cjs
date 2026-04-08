const swaggerAutogen = require('swagger-autogen')({
  openapi: '3.0.0',
  autoHeaders: true,
  autoQuery: true,
  autoBody: true
});

const doc = {
  info: {
    title: 'PhoAmThuc API',
    description: 'Auto-generated OpenAPI spec from Express routes.'
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Local'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    }
  }
};

const outputFile = './openapi.json';
const endpointsFiles = ['./src/index.ts'];

swaggerAutogen(outputFile, endpointsFiles, doc).then(() => {
  console.log('OpenAPI generated at apps/backend/openapi.json');
});
