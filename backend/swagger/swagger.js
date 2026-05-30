import swaggerJsdoc from 'swagger-jsdoc'

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Visit Ethiopia API',
      version: '1.0.0',
      description: 'API documentation for the Visit Ethiopia project',
    },
    servers: [
      {
        url:
          process.env.NODE_ENV === 'production'
            ? 'https://visit-ethiopia-backend-ku5l.vercel.app'
            : 'http://localhost:5000',
        description:
          process.env.NODE_ENV === 'production'
            ? 'Production server'
            : 'Local server',
      },
    ],
  },
  apis: ['./swagger/*.docs.js'],
}

const swaggerSpec = swaggerJsdoc(options)

export default swaggerSpec
