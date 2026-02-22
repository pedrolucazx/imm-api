import type { FastifyInstance } from "fastify";
import { authController } from "./auth.controller.js";

export async function authRoutes(fastify: FastifyInstance) {
  // Register route
  fastify.post("/auth/register", {
    schema: {
      description: "Register a new user",
      tags: ["Authentication"],
      body: {
        type: "object",
        required: ["email", "password", "name"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string", minLength: 8, maxLength: 100 },
          name: { type: "string", minLength: 2, maxLength: 255 },
        },
      },
      response: {
        201: {
          description: "User successfully registered",
          type: "object",
          properties: {
            token: { type: "string" },
            user: {
              type: "object",
              properties: {
                id: { type: "string" },
                email: { type: "string" },
                name: { type: "string" },
              },
            },
          },
        },
        400: {
          description: "Bad request",
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
      },
    },
    handler: authController.register.bind(authController),
  });

  // Login route
  fastify.post("/auth/login", {
    schema: {
      description: "Login with email and password",
      tags: ["Authentication"],
      body: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string" },
        },
      },
      response: {
        200: {
          description: "Successfully logged in",
          type: "object",
          properties: {
            token: { type: "string" },
            user: {
              type: "object",
              properties: {
                id: { type: "string" },
                email: { type: "string" },
                name: { type: "string" },
              },
            },
          },
        },
        401: {
          description: "Unauthorized",
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
      },
    },
    handler: authController.login.bind(authController),
  });
}
